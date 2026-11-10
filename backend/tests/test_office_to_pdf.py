"""Office -> PDF conversion robustness (LibreOffice). No DB, no network."""

import asyncio
import zipfile
from pathlib import Path

import pytest

from app.core.exceptions import ProcessingError
from app.processors.document.office_converter import (
    OfficeConverter,
    _fit_xlsx_to_page_width,
    find_libreoffice,
)
from app.processors.document.pptx_converter import PowerPointToPDFConverter

needs_soffice = pytest.mark.skipif(find_libreoffice() is None, reason="LibreOffice not installed")


def _docx(path: Path, text: str = "Hello PDFGlide") -> Path:
    from docx import Document

    d = Document()
    d.add_paragraph(text)
    d.save(path)
    return path


def _xlsx(path: Path, cols: int = 30) -> Path:
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    for r in range(1, 5):
        for c in range(1, cols + 1):
            ws.cell(r, c, f"r{r}c{c}")
    wb.save(path)
    return path


def _pages(pdf: Path) -> int:
    import pikepdf

    with pikepdf.open(pdf) as p:
        return len(p.pages)


def test_fit_to_width_patch_adds_page_setup(tmp_path):
    from lxml import etree

    src = _xlsx(tmp_path / "a.xlsx")
    dst = tmp_path / "b.xlsx"
    assert _fit_xlsx_to_page_width(src, dst) is True
    with zipfile.ZipFile(dst) as z:
        root = etree.fromstring(z.read("xl/worksheets/sheet1.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    assert root.find("m:sheetPr/m:pageSetUpPr", ns).get("fitToPage") == "1"
    setup = root.find("m:pageSetup", ns)
    assert (setup.get("fitToWidth"), setup.get("fitToHeight")) == ("1", "0")
    # schema order: sheetPr first, pageSetup after pageMargins
    names = [etree.QName(e).localname for e in root]
    assert names[0] == "sheetPr" and names.index("pageSetup") > names.index("pageMargins")


def test_fit_to_width_patch_respects_existing_scale(tmp_path):
    import openpyxl

    wb = openpyxl.Workbook()
    wb.active["A1"] = 1
    wb.active.page_setup.scale = 50
    wb.save(tmp_path / "a.xlsx")
    assert _fit_xlsx_to_page_width(tmp_path / "a.xlsx", tmp_path / "b.xlsx") is False
    assert not (tmp_path / "b.xlsx").exists()


def test_fit_to_width_patch_survives_garbage(tmp_path):
    bad = tmp_path / "bad.xlsx"
    bad.write_bytes(b"not a zip")
    assert _fit_xlsx_to_page_width(bad, tmp_path / "out.xlsx") is False


@needs_soffice
async def test_docx_to_pdf_and_cleanup(tmp_path):
    out = tmp_path / "out.pdf"
    res = await OfficeConverter(tmp_path / "work").to_pdf(_docx(tmp_path / "in.docx"), out)
    assert res == out and out.read_bytes().startswith(b"%PDF")
    assert not list((tmp_path / "work").glob("*.pdf"))  # nothing left in shared dir


@needs_soffice
async def test_unicode_filename(tmp_path):
    src = _docx(tmp_path / "laporan bulan Januari 你好 (final).docx")
    out = tmp_path / "o.pdf"
    await OfficeConverter(tmp_path).to_pdf(src, out)
    assert out.stat().st_size > 0


@needs_soffice
async def test_concurrent_conversions_do_not_collide(tmp_path):
    srcs = [_docx(tmp_path / f"d{i}.docx", f"doc {i}") for i in range(3)]
    srcs.append(_xlsx(tmp_path / "x.xlsx", cols=3))
    conv = OfficeConverter(tmp_path)
    outs = [tmp_path / f"o{i}.pdf" for i in range(len(srcs))]
    await asyncio.gather(*[conv.to_pdf(s, o) for s, o in zip(srcs, outs)])
    assert all(o.read_bytes().startswith(b"%PDF") for o in outs)


@needs_soffice
async def test_wide_sheet_fits_page_width(tmp_path):
    out = tmp_path / "x.pdf"
    await OfficeConverter(tmp_path).to_pdf(_xlsx(tmp_path / "wide.xlsx", cols=40), out)
    assert _pages(out) == 1  # unpatched LibreOffice splits 40 columns over several pages


@needs_soffice
async def test_pptx_to_pdf(tmp_path):
    from pptx import Presentation

    p = Presentation()
    p.slides.add_slide(p.slide_layouts[6])
    p.save(tmp_path / "s.pptx")
    out = tmp_path / "s.pdf"
    await PowerPointToPDFConverter(tmp_path).execute(tmp_path / "s.pptx", out)
    assert _pages(out) == 1


@needs_soffice
async def test_corrupt_file_raises_processing_error(tmp_path):
    bad = tmp_path / "bad.docx"
    bad.write_bytes(b"this is not a docx")
    with pytest.raises(ProcessingError):
        await OfficeConverter(tmp_path).to_pdf(bad, tmp_path / "o.pdf")
    assert not (tmp_path / "o.pdf").exists()


@needs_soffice
async def test_timeout_raises_and_cleans_up(tmp_path):
    from app.processors.document.office_converter import libreoffice_to_pdf

    with pytest.raises(ProcessingError, match="timed out"):
        await libreoffice_to_pdf(_docx(tmp_path / "in.docx"), tmp_path / "o.pdf", timeout=0.05)


async def test_missing_input(tmp_path):
    if find_libreoffice() is None:
        pytest.skip("LibreOffice not installed")
    with pytest.raises(ProcessingError):
        await OfficeConverter(tmp_path).to_pdf(tmp_path / "nope.docx", tmp_path / "o.pdf")
