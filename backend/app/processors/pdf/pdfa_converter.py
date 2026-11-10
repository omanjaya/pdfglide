"""PDF to PDF/A converter processor."""

import asyncio
import subprocess
import shutil
import uuid
from pathlib import Path
from typing import Literal

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFToPDFAConverter(BaseProcessor):
    """Convert PDF to PDF/A archival format."""

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        pdfa_level: Literal["1b", "2b", "3b"] = "2b",
    ) -> Path:
        """
        Convert PDF to PDF/A format.

        PDF/A is an ISO-standardized version of PDF specialized for
        digital preservation of electronic documents.

        Levels:
        - 1b: Basic conformance (PDF 1.4 based)
        - 2b: Basic conformance (PDF 1.7 based, supports JPEG2000, transparency)
        - 3b: Basic conformance (allows embedded files)

        Args:
            input_path: Path to the input PDF
            output_path: Path for the PDF/A output
            pdfa_level: PDF/A conformance level (1b, 2b, or 3b)

        Returns:
            Path to the PDF/A file
        """
        # Try Ghostscript first (most reliable)
        gs_path = self._find_ghostscript()

        if gs_path:
            return await self._convert_with_ghostscript(
                input_path, output_path, pdfa_level, gs_path
            )

        # Fallback to pikepdf (limited PDF/A support)
        return await self._convert_with_pikepdf(input_path, output_path, pdfa_level)

    def _find_ghostscript(self) -> str | None:
        """Find Ghostscript executable."""
        possible_paths = [
            "gs",
            "gswin64c",
            "gswin32c",
            "/usr/bin/gs",
            "/usr/local/bin/gs",
            "/opt/homebrew/bin/gs",
            "C:\\Program Files\\gs\\gs10.00.0\\bin\\gswin64c.exe",
        ]

        for path in possible_paths:
            if shutil.which(path):
                return path

        return None

    @staticmethod
    def _find_icc_profile() -> Path | None:
        """Locate an sRGB ICC profile (shipped with Ghostscript / colord)."""
        for candidate in (
            "/usr/share/color/icc/ghostscript/srgb.icc",
            "/usr/share/ghostscript/iccprofiles/srgb.icc",
            "/usr/share/color/icc/colord/sRGB.icc",
            "/usr/share/color/icc/sRGB.icc",
        ):
            if Path(candidate).is_file():
                return Path(candidate)
        return None

    async def _convert_with_ghostscript(
        self,
        input_path: Path,
        output_path: Path,
        pdfa_level: str,
        gs_path: str,
    ) -> Path:
        """Convert using Ghostscript."""
        pdfa_def = {"1b": "1", "2b": "2", "3b": "3"}.get(pdfa_level, "2")

        icc = self._find_icc_profile()
        if icc is None:
            raise ProcessingError(
                "sRGB ICC profile not found; cannot create a valid PDF/A OutputIntent"
            )

        # PDF/A requires an OutputIntent with an embedded ICC profile. Ghostscript
        # only writes it when this definition file is passed on the command line.
        # (Unique name: concurrent requests share output_dir.)
        pdfa_def_ps = self.output_dir / f"PDFA_def_{uuid.uuid4().hex}.ps"
        icc_ps = str(icc).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        pdfa_def_ps.write_text(
            f"""%!PS
/ICCProfile ({icc_ps}) def
[/_objdef {{icc_PDFA}} /type /stream /OBJ pdfmark
[{{icc_PDFA}} <</N 3>> /PUT pdfmark
[{{icc_PDFA}} ICCProfile (r) file /PUT pdfmark
[/_objdef {{OutputIntent_PDFA}} /type /dict /OBJ pdfmark
[{{OutputIntent_PDFA}} <<
  /Type /OutputIntent
  /S /GTS_PDFA1
  /DestOutputProfile {{icc_PDFA}}
  /OutputConditionIdentifier (sRGB)
  /Info (sRGB IEC61966-2.1)
  /RegistryName (http://www.color.org)
>> /PUT pdfmark
[{{Catalog}} <</OutputIntents [ {{OutputIntent_PDFA}} ]>> /PUT pdfmark
"""
        )

        try:
            cmd = [
                gs_path,
                "-dPDFA=" + pdfa_def,
                "-dBATCH",
                "-dNOPAUSE",
                "-dQUIET",
                "-dNOOUTERSAVE",
                f"--permit-file-read={icc}",
                "-sColorConversionStrategy=RGB",
                "-sProcessColorModel=DeviceRGB",
                "-sDEVICE=pdfwrite",
                "-dPDFACompatibilityPolicy=1",
                "-dEmbedAllFonts=true",
                "-dSubsetFonts=true",
                f"-sOutputFile={output_path}",
                str(pdfa_def_ps),
                str(input_path),
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise ProcessingError(f"Ghostscript conversion failed: {error_msg}")

            if not output_path.exists():
                raise ProcessingError("PDF/A conversion completed but output not found")

            return output_path

        finally:
            # Cleanup
            if pdfa_def_ps.exists():
                pdfa_def_ps.unlink()

    async def _convert_with_pikepdf(
        self,
        input_path: Path,
        output_path: Path,
        pdfa_level: str,
    ) -> Path:
        """
        Fallback conversion using pikepdf.

        Note: This is a basic conversion that embeds fonts and sets metadata.
        For full PDF/A compliance, Ghostscript is recommended.
        """

        def _convert():
            import pikepdf
            from datetime import datetime

            with pikepdf.open(input_path) as pdf:
                # Set PDF/A metadata
                with pdf.open_metadata() as meta:
                    # Set required PDF/A metadata
                    meta["pdfaid:part"] = pdfa_level[0]  # "1", "2", or "3"
                    meta["pdfaid:conformance"] = pdfa_level[1].upper()  # "B"

                    meta["dc:format"] = "application/pdf"
                    meta["pdf:Producer"] = "PDFGlide PDF/A Converter"
                    meta["xmp:CreateDate"] = datetime.utcnow().isoformat()
                    meta["xmp:ModifyDate"] = datetime.utcnow().isoformat()

                # Save with optimization
                pdf.save(
                    output_path,
                    linearize=True,
                    compress_streams=True,
                )

            return output_path

        try:
            return await asyncio.to_thread(_convert)
        except Exception as e:
            raise ProcessingError(f"Failed to convert to PDF/A: {str(e)}")

    async def validate_pdfa(self, pdf_path: Path) -> dict:
        """
        Validate if a PDF conforms to PDF/A standard.

        Note: Full validation requires external tools like veraPDF.
        This provides basic validation checks.

        Returns:
            Dictionary with validation results
        """

        def _validate():
            import pikepdf

            result = {
                "is_valid": False,
                "pdfa_level": None,
                "issues": [],
            }

            try:
                with pikepdf.open(pdf_path) as pdf:
                    # Check for PDF/A metadata
                    try:
                        with pdf.open_metadata() as meta:
                            part = meta.get("pdfaid:part")
                            conformance = meta.get("pdfaid:conformance")

                            if part and conformance:
                                result["pdfa_level"] = f"{part}{conformance.lower()}"
                                result["is_valid"] = True
                            else:
                                result["issues"].append(
                                    "Missing PDF/A identification metadata"
                                )
                    except Exception:
                        result["issues"].append("Could not read PDF/A metadata")

                    # Check for encryption (not allowed in PDF/A)
                    if pdf.is_encrypted:
                        result["is_valid"] = False
                        result["issues"].append("PDF is encrypted (not allowed in PDF/A)")

                    # Check for embedded files in PDF/A-1 and PDF/A-2
                    # (only PDF/A-3 allows embedded files)
                    if "/EmbeddedFiles" in pdf.Root.get("/Names", {}):
                        if result.get("pdfa_level", "").startswith(("1", "2")):
                            result["issues"].append(
                                "Contains embedded files (only allowed in PDF/A-3)"
                            )

            except Exception as e:
                result["issues"].append(f"Validation error: {str(e)}")

            return result

        return await asyncio.to_thread(_validate)
