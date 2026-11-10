"""Fidelity tests for PDF conversions (PPTX, Excel, images, images->PDF, PDF/A).

Fixtures are generated in-process with known ground truth; no DB/network.
"""

import asyncio
import io
import shutil
import subprocess

import pytest

fitz = pytest.importorskip("fitz")
pytest.importorskip("reportlab")
from PIL import Image  # noqa: E402
from reportlab.lib.pagesizes import A4, landscape, letter  # noqa: E402
from reportlab.pdfgen import canvas  # noqa: E402

from app.processors.pdf.converter import ImageToPDFConverter, PDFToImageConverter  # noqa: E402
from app.processors.pdf.pdfa_converter import PDFToPDFAConverter  # noqa: E402
from app.processors.pdf.pptx_converter import PDFToPowerPointConverter  # noqa: E402
from app.processors.pdf.table_extractor import PDFTableExtractor, parse_number  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def _grid(c, rows, y0=780, cw=(150, 100, 100), rh=24, x0=50):
    for r, row in enumerate(rows):
        for ci, v in enumerate(row):
            x, y = x0 + sum(cw[:ci]), y0 - r * rh
            c.rect(x, y - rh, cw[ci], rh)
            c.setFont("Helvetica-Bold" if r == 0 else "Helvetica", 11)
            c.drawString(x + 4, y - 16, str(v))


@pytest.fixture
def table_pdf(tmp_path):
    p = tmp_path / "table.pdf"
    c = canvas.Canvas(str(p), pagesize=A4)
    _grid(c, [["Item", "Qty", "Price"]] + [[f"Product {i}", i * 3, f"{i * 1234.5:,.2f}"] for i in range(1, 6)])
    c.showPage()  # page 2: continuation with repeated header
    _grid(c, [["Item", "Qty", "Price"]] + [[f"Product {i}", i * 3, f"{i * 1234.5:,.2f}"] for i in range(6, 9)])
    c.showPage()
    c.drawString(50, 780, "No table here")
    c.save()
    return p


@pytest.fixture
def mixed_pdf(tmp_path):
    p = tmp_path / "mixed.pdf"
    c = canvas.Canvas(str(p), pagesize=A4)
    for size in (A4, landscape(letter), (300, 500)):
        c.setPageSize(size)
        c.drawString(40, size[1] - 60, "x")
        c.showPage()
    c.save()
    return p


def test_parse_number():
    assert parse_number("1,234.50") == 1234.5
    assert parse_number("1.234,50") == 1234.5
    assert parse_number("1.234.567") == 1234567
    assert parse_number("12") == 12 and isinstance(parse_number("12"), int)
    assert parse_number("(5)") == -5
    assert parse_number("007") is None
    assert parse_number("12 kg") is None
    assert parse_number("") is None


def test_tables_numbers_and_continuation(tmp_path, table_pdf):
    import openpyxl

    out = run(PDFTableExtractor(tmp_path).execute(table_pdf, tmp_path / "o.xlsx", "all"))
    wb = openpyxl.load_workbook(out)
    assert len(wb.sheetnames) == 1  # page 2 continues page 1
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    assert rows[0] == ("Item", "Qty", "Price")  # no stray 0,1,2 header row
    assert rows[1] == ("Product 1", 3, 1234.5)  # numbers are numbers
    assert len(rows) == 1 + 5 + 3  # repeated header dropped
    assert ws["A1"].font.bold


def test_table_merged_cells(tmp_path):
    import openpyxl

    p = tmp_path / "m.pdf"
    c = canvas.Canvas(str(p), pagesize=A4)
    cw = (100, 100, 100)
    # header spanning columns 1-2, then two normal rows
    c.rect(50, 756, 200, 24)
    c.drawString(54, 764, "Group")
    c.rect(250, 756, 100, 24)
    c.drawString(254, 764, "Total")
    for r, row in enumerate([["a", "b", "1"], ["c", "d", "2"]], start=1):
        for i, v in enumerate(row):
            c.rect(50 + 100 * i, 756 - 24 * r, cw[i], 24)
            c.drawString(54 + 100 * i, 764 - 24 * r, v)
    c.save()
    out = run(PDFTableExtractor(tmp_path).execute(p, tmp_path / "o.xlsx", "all"))
    ws = openpyxl.load_workbook(out).active
    assert "A1:B1" in [str(r) for r in ws.merged_cells.ranges]
    assert ws["A1"].value == "Group" and ws["C1"].value == "Total"


def test_no_table_gives_clear_error(tmp_path):
    from app.core.exceptions import ProcessingError

    p = tmp_path / "t.pdf"
    c = canvas.Canvas(str(p))
    c.drawString(50, 700, "just text")
    c.save()
    with pytest.raises(ProcessingError):
        run(PDFTableExtractor(tmp_path).execute(p, tmp_path / "o.xlsx", "all"))


def test_pptx_slide_matches_page_and_is_sharp(tmp_path, mixed_pdf):
    from pptx import Presentation

    out = run(PDFToPowerPointConverter(tmp_path).execute(mixed_pdf, tmp_path / "o.pptx", 150))
    prs = Presentation(out)
    assert len(prs.slides) == 3
    assert prs.slide_width / 914400 == pytest.approx(595.28 / 72, abs=0.01)
    assert prs.slide_height / 914400 == pytest.approx(841.89 / 72, abs=0.01)
    pic = list(prs.slides[0].shapes)[0]
    # first page fills the slide exactly (allow 1-EMU rounding)
    assert pic.left <= 1 and pic.top <= 1
    assert abs(pic.width - prs.slide_width) <= 2 and abs(pic.height - prs.slide_height) <= 2
    assert pic.image.size[0] == pytest.approx(595.28 / 72 * 150, abs=2)  # real 150 dpi
    # other pages keep their own aspect ratio (no stretching)
    for s, (w, h) in zip(list(prs.slides)[1:], [(792, 612), (300, 500)]):
        p = list(s.shapes)[0]
        assert p.width / p.height == pytest.approx(w / h, rel=0.01)


def test_pptx_rotated_page_uses_displayed_orientation(tmp_path, mixed_pdf):
    from pptx import Presentation

    d = fitz.open(str(mixed_pdf))
    d[0].set_rotation(90)
    rot = tmp_path / "rot.pdf"
    d.save(str(rot))
    prs = Presentation(run(PDFToPowerPointConverter(tmp_path).execute(rot, tmp_path / "r.pptx", 100)))
    assert prs.slide_width > prs.slide_height


def test_pdf_to_images_dpi_rgb_rotation(tmp_path, mixed_pdf):
    d = fitz.open(str(mixed_pdf))
    d[0].set_rotation(90)
    src = tmp_path / "rot.pdf"
    d.save(str(src))
    conv = PDFToImageConverter(tmp_path)
    jpgs = run(conv.execute(src, "jpg", 144))
    assert len(jpgs) == 3
    with Image.open(jpgs[0]) as im:
        assert im.format == "JPEG" and im.mode == "RGB"
        assert im.size == (1684, 1191)  # rotated A4 landscape at 144 dpi
    with Image.open(jpgs[2]) as im:
        assert im.size == (600, 1000)
    pngs = run(conv.execute(src, "png", 72))
    with Image.open(pngs[1]) as im:
        assert im.format == "PNG" and im.size == (792, 612)


def test_pdf_to_jpg_flattens_transparency_on_white(tmp_path):
    p = tmp_path / "t.pdf"
    d = fitz.open()
    pg = d.new_page(width=100, height=100)
    buf = io.BytesIO()
    Image.new("RGBA", (10, 10), (0, 0, 0, 0)).save(buf, "PNG")  # fully transparent black
    pg.insert_image(fitz.Rect(0, 0, 100, 100), stream=buf.getvalue())
    d.save(str(p))
    out = run(PDFToImageConverter(tmp_path).execute(p, "jpg", 72))[0]
    with Image.open(out) as im:
        assert im.getpixel((50, 50)) == pytest.approx((255, 255, 255), abs=3)


def _page_info(pdf):
    d = fitz.open(str(pdf))
    pg = d[0]
    return pg.rect, d.get_page_images(0), pg.get_pixmap(dpi=36)


def test_images_to_pdf_exif_rotation(tmp_path):
    im = Image.new("RGB", (400, 200), (255, 255, 255))
    im.paste((255, 0, 0), (0, 0, 200, 200))  # left half red
    ex = Image.Exif()
    ex[274] = 6  # needs 90 degrees clockwise -> portrait
    f = tmp_path / "e.jpg"
    im.save(f, exif=ex)
    out = run(ImageToPDFConverter(tmp_path).execute([f], tmp_path / "o.pdf"))
    rect, _, pix = _page_info(out)
    assert rect.height > rect.width
    # after rotating 90 cw the red half is at the top
    assert pix.pixel(pix.width // 2, 2)[0] > 200 and pix.pixel(pix.width // 2, 2)[1] < 60
    assert pix.pixel(pix.width // 2, pix.height - 3)[1] > 200


def test_images_to_pdf_jpeg_not_recompressed(tmp_path):
    f = tmp_path / "p.jpg"
    Image.effect_noise((300, 200), 60).convert("RGB").save(f, quality=95)
    out = run(ImageToPDFConverter(tmp_path).execute([f], tmp_path / "o.pdf"))
    d = fitz.open(str(out))
    xref = d.get_page_images(0)[0][0]
    assert d.extract_image(xref)["image"] == f.read_bytes()  # byte-identical


def test_images_to_pdf_odd_modes(tmp_path):
    files = []
    a = Image.new("RGBA", (200, 100), (0, 0, 255, 0))
    a.paste((0, 0, 255, 255), (0, 0, 100, 100))
    files.append(tmp_path / "a.png"); a.save(files[-1])
    files.append(tmp_path / "c.jpg"); Image.new("CMYK", (200, 100), (0, 255, 255, 0)).save(files[-1])
    files.append(tmp_path / "g.png"); Image.new("I;16", (200, 100), 40000).save(files[-1])
    files.append(tmp_path / "p.png"); Image.new("P", (200, 100)).save(files[-1])
    out = run(ImageToPDFConverter(tmp_path).execute(files, tmp_path / "o.pdf"))
    d = fitz.open(str(out))
    assert d.page_count == 4
    px = [pg.get_pixmap(dpi=36) for pg in d]
    assert px[0].pixel(2, 2)[2] > 200 and px[0].pixel(px[0].width - 3, 2) == (255, 255, 255)  # alpha -> white
    assert px[1].pixel(5, 5)[0] > 200 and px[1].pixel(5, 5)[1] < 80  # CMYK red stays red
    g = px[2].pixel(5, 5)
    assert 120 < g[0] < 180 and g[0] == g[1]  # 40000/65535 ~ 0.61 gray, not clipped to white
    for pg in d:  # page size = pixels at 150 dpi
        assert pg.rect.width == pytest.approx(96, abs=1)


def test_images_to_pdf_large_image_page_capped(tmp_path):
    f = tmp_path / "big.png"
    Image.new("RGB", (3000, 4000), (10, 200, 30)).save(f)
    out = run(ImageToPDFConverter(tmp_path).execute([f], tmp_path / "o.pdf"))
    rect, imgs, _ = _page_info(out)
    assert max(rect.width, rect.height) <= 1192
    assert rect.width / rect.height == pytest.approx(0.75, rel=0.01)
    assert (imgs[0][2], imgs[0][3]) == (3000, 4000)  # full resolution kept


@pytest.mark.skipif(shutil.which("gs") is None, reason="Ghostscript not installed")
@pytest.mark.parametrize("level", ["1b", "2b", "3b"])
def test_pdfa_has_output_intent_fonts_and_id(tmp_path, table_pdf, level):
    import pikepdf

    out = run(PDFToPDFAConverter(tmp_path).execute(table_pdf, tmp_path / "a.pdf", level))
    with pikepdf.open(out) as pdf:
        intents = pdf.Root.get("/OutputIntents")
        assert intents is not None and len(intents) == 1
        assert str(intents[0].S) == "/GTS_PDFA1"
        assert "/DestOutputProfile" in intents[0]
        with pdf.open_metadata() as m:
            assert m["pdfaid:part"] == level[0] and m["pdfaid:conformance"] == "B"
        for page in pdf.pages:
            for f in page.Resources.get("/Font", {}).values():
                desc = f.get("/FontDescriptor")
                assert desc is not None and any(k in desc for k in ("/FontFile", "/FontFile2", "/FontFile3"))
    assert not list(tmp_path.glob("PDFA_def*"))  # temp definition file cleaned up
    assert fitz.open(str(out)).page_count == 3
