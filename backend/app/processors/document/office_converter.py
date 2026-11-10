"""Office document converter processor."""

import asyncio
import logging
import os
import shutil
import signal
import tempfile
import zipfile
from pathlib import Path


from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError

logger = logging.getLogger(__name__)

# Hard limit for one LibreOffice run (seconds). Override with PDFGLIDE_SOFFICE_TIMEOUT.
SOFFICE_TIMEOUT = int(os.environ.get("PDFGLIDE_SOFFICE_TIMEOUT", "180"))

# Which LibreOffice PDF export filter to use per input type. Naming the filter
# lets us pass export options (the plain "pdf" target takes defaults only).
_EXPORT_FILTER = {
    ".doc": "writer_pdf_Export", ".docx": "writer_pdf_Export", ".docm": "writer_pdf_Export",
    ".dot": "writer_pdf_Export", ".dotx": "writer_pdf_Export", ".odt": "writer_pdf_Export",
    ".rtf": "writer_pdf_Export", ".txt": "writer_pdf_Export",
    ".xls": "calc_pdf_Export", ".xlsx": "calc_pdf_Export", ".xlsm": "calc_pdf_Export",
    ".ods": "calc_pdf_Export", ".csv": "calc_pdf_Export",
    ".ppt": "impress_pdf_Export", ".pptx": "impress_pdf_Export", ".pps": "impress_pdf_Export",
    ".ppsx": "impress_pdf_Export", ".odp": "impress_pdf_Export",
}

# Fonts are always embedded (subset) by LibreOffice. Images: no downsampling and
# near-lossless JPEG so pictures do not visibly degrade.
_EXPORT_OPTIONS = (
    '{"Quality":{"type":"long","value":"95"},'
    '"ReduceImageResolution":{"type":"boolean","value":"false"},'
    '"ExportBookmarks":{"type":"boolean","value":"true"}}'
)

_ZIP_FORMATS = {".docx", ".docm", ".dotx", ".xlsx", ".xlsm", ".pptx", ".ppsx", ".odt", ".ods", ".odp"}
_XLSX_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
# Child order of <worksheet> per the OOXML schema (used to insert elements legally).
_SHEET_ORDER = [
    "sheetPr", "dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "sheetCalcPr",
    "sheetProtection", "protectedRanges", "scenarios", "autoFilter", "sortState",
    "dataConsolidate", "customSheetViews", "mergeCells", "phoneticPr", "conditionalFormatting",
    "dataValidations", "hyperlinks", "printOptions", "pageMargins", "pageSetup", "headerFooter",
    "rowBreaks", "colBreaks", "customProperties", "cellWatches", "ignoredErrors", "smartTags",
    "drawing", "legacyDrawing", "legacyDrawingHF", "picture", "oleObjects", "controls",
    "webPublishItems", "tableParts", "extLst",
]


def find_libreoffice() -> str | None:
    """Return the LibreOffice executable, or None."""
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    for path in (
        "/usr/bin/soffice",
        "/usr/lib/libreoffice/program/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
    ):
        if Path(path).exists():
            return path
    return None


def _fit_xlsx_to_page_width(src: Path, dst: Path) -> bool:
    """
    Write a copy of ``src`` where every worksheet that has no explicit scaling
    gets "fit all columns on one page wide" (as many pages tall as needed).

    Without this a wide sheet is cut into column strips over many pages.
    Fit-to-width only ever shrinks, never enlarges. Sheets that already set a
    scale or fit-to-page are left alone. Returns False (and writes nothing) on
    any problem, so the caller converts the untouched original.
    """
    try:
        from lxml import etree

        with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
            changed = False
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename.startswith("xl/worksheets/") and item.filename.endswith(".xml"):
                    root = etree.fromstring(data)
                    if root.tag == f"{{{_XLSX_NS}}}worksheet" and _patch_sheet(root, etree):
                        data = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
                        changed = True
                zout.writestr(item, data)
        if not changed:
            dst.unlink(missing_ok=True)
        return changed
    except Exception as exc:  # corrupt/unusual file: let LibreOffice deal with the original
        logger.warning("xlsx page-fit patch skipped: %s", exc)
        dst.unlink(missing_ok=True)
        return False


def _patch_sheet(root, etree) -> bool:
    ns = f"{{{_XLSX_NS}}}"

    def child(name):
        return root.find(ns + name)

    sheet_pr = child("sheetPr")
    page_setup_pr = sheet_pr.find(ns + "pageSetUpPr") if sheet_pr is not None else None
    page_setup = child("pageSetup")
    if page_setup_pr is not None and page_setup_pr.get("fitToPage") in ("1", "true"):
        return False
    if page_setup is not None and page_setup.get("scale") not in (None, "100"):
        return False
    if child("colBreaks") is not None:  # author placed manual page breaks: respect them
        return False

    def insert(el):
        idx = _SHEET_ORDER.index(etree.QName(el).localname)
        for pos, existing in enumerate(root):
            name = etree.QName(existing).localname
            if name in _SHEET_ORDER and _SHEET_ORDER.index(name) > idx:
                root.insert(pos, el)
                return
        root.append(el)

    if sheet_pr is None:
        sheet_pr = etree.Element(ns + "sheetPr")
        insert(sheet_pr)
    if page_setup_pr is None:
        page_setup_pr = etree.SubElement(sheet_pr, ns + "pageSetUpPr")  # last child, as schema requires
    page_setup_pr.set("fitToPage", "1")
    if page_setup is None:
        page_setup = etree.Element(ns + "pageSetup")
        insert(page_setup)
    page_setup.set("fitToWidth", "1")
    page_setup.set("fitToHeight", "0")
    return True


async def _kill_group(proc: asyncio.subprocess.Process) -> None:
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        proc.kill()
    try:
        await asyncio.wait_for(proc.wait(), 10)
    except asyncio.TimeoutError:
        pass


async def libreoffice_to_pdf(file: Path, output_path: Path, timeout: int | None = None) -> Path:
    """
    Convert ``file`` to ``output_path`` (PDF) with headless LibreOffice.

    Every call gets its own throw-away user profile and working directory, so
    concurrent conversions never share a profile lock, a stale lock file or
    an output name. The process runs in its own session and is killed
    (with its children) on timeout. All temp data is removed afterwards.

    Raises:
        ProcessingError: LibreOffice missing, timed out, failed or produced no PDF.
    """
    file = Path(file)
    output_path = Path(output_path)
    soffice = find_libreoffice()
    if not soffice:
        raise ProcessingError("LibreOffice not found. Please install LibreOffice.")
    if not file.is_file():
        raise ProcessingError(f"Input file not found: {file.name}")

    timeout = timeout or SOFFICE_TIMEOUT
    suffix = file.suffix.lower()
    # LibreOffice happily renders a corrupt/mislabelled OOXML/ODF file as a plain-text dump
    # of the zip bytes; refuse instead of returning a garbage PDF.
    if suffix in _ZIP_FORMATS and not zipfile.is_zipfile(file):
        raise ProcessingError(
            f"This {suffix} file is corrupt or not a real {suffix} document."
        )
    work = Path(tempfile.mkdtemp(prefix="pdfglide-lo-"))
    try:
        out_dir = work / "out"
        out_dir.mkdir()
        # Neutral ASCII name: odd characters in user file names can confuse the CLI.
        src = work / f"input{suffix}"
        if suffix in (".xlsx", ".xlsm") and _fit_xlsx_to_page_width(file, src):
            pass
        else:
            shutil.copyfile(file, src)

        flt = _EXPORT_FILTER.get(suffix)
        target = f"pdf:{flt}:{_EXPORT_OPTIONS}" if flt else "pdf"
        profile = work / "profile"
        cmd = [
            soffice,
            f"-env:UserInstallation={profile.as_uri()}",
            "--headless", "--invisible", "--nologo", "--norestore", "--nodefault", "--nolockcheck",
            "--convert-to", target,
            "--outdir", str(out_dir),
            str(src),
        ]
        env = {**os.environ, "HOME": str(work)}
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
                start_new_session=True,
            )
        except OSError as exc:
            raise ProcessingError(f"Could not start LibreOffice: {exc}")

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout)
        except asyncio.TimeoutError:
            await _kill_group(proc)
            raise ProcessingError(
                f"Conversion timed out after {timeout}s. The document may be too large or complex."
            )
        except asyncio.CancelledError:
            await _kill_group(proc)
            raise

        pdfs = sorted(out_dir.glob("*.pdf"))
        if proc.returncode != 0 or not pdfs:
            detail = (stderr or stdout or b"").decode(errors="replace").strip()[-500:]
            logger.error("LibreOffice failed (rc=%s) for %s: %s", proc.returncode, file.name, detail)
            raise ProcessingError(
                "Could not convert this document to PDF. The file may be corrupt, "
                "password-protected or in an unsupported format."
            )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(pdfs[0]), str(output_path))
        return output_path
    finally:
        shutil.rmtree(work, ignore_errors=True)


class OfficeConverter(BaseProcessor):
    """Convert office documents using LibreOffice."""

    async def execute(self, file: Path, output_path: Path, conversion_type: str = "to_pdf") -> Path:
        """
        Execute document conversion.

        Args:
            file: Input file path
            output_path: Output file path
            conversion_type: Type of conversion ('to_pdf' or 'pdf_to_docx')

        Returns:
            Path to converted file
        """
        if conversion_type == "pdf_to_docx":
            return await self.pdf_to_docx(file, output_path)
        return await self.to_pdf(file, output_path)

    async def to_pdf(self, file: Path, output_path: Path) -> Path:
        """
        Convert a Word / Excel / PowerPoint / OpenDocument file to PDF.

        Runs LibreOffice with a private profile, a timeout and a private
        output directory (see :func:`libreoffice_to_pdf`).

        Args:
            file: Input document file path
            output_path: Output PDF file path

        Returns:
            Path to converted PDF
        """
        return await libreoffice_to_pdf(file, output_path)

    async def pdf_to_docx(self, file: Path, output_path: Path) -> Path:
        """
        Convert PDF to Word document.

        Args:
            file: Input PDF file path
            output_path: Output DOCX file path

        Returns:
            Path to converted DOCX
        """
        try:
            from pdf2docx import Converter

            # Run blocking conversion in thread pool
            def _convert():
                cv = Converter(str(file))
                cv.convert(str(output_path))
                cv.close()

            await asyncio.to_thread(_convert)

            return output_path

        except ImportError:
            raise ProcessingError("pdf2docx package not installed")
        except Exception as e:
            raise ProcessingError(f"Failed to convert PDF to Word: {str(e)}")

    def _find_libreoffice(self) -> str | None:
        """Find LibreOffice executable."""
        return find_libreoffice()
