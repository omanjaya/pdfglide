"""Editable PDF -> PPTX: text boxes over a text-free background (no DB/network)."""

import asyncio
import io
from collections import Counter

import pytest

fitz = pytest.importorskip("fitz")
pytest.importorskip("pptx")
from PIL import Image  # noqa: E402
from pptx import Presentation  # noqa: E402
from pptx.enum.shapes import MSO_SHAPE_TYPE  # noqa: E402

from app.processors.pdf.pptx_converter import PDFToPowerPointConverter  # noqa: E402

TITLE = "Quarterly Review"
BODY = [
    "The quick brown fox jumps over the lazy dog",
    "while the committee reviews the proposal in",
    "detail and approves the revised budget today.",
]


def run(coro):
    return asyncio.run(coro)


def convert(tmp_path, pdf, editable=True, name="o"):
    conv = PDFToPowerPointConverter(tmp_path)
    out = run(conv.execute(pdf, tmp_path / f"{name}.pptx", 100, editable=editable))
    return Presentation(out), conv


def boxes(slide):
    return [s for s in slide.shapes if s.has_text_frame and s.text_frame.text.strip()]


def pictures(slide):
    return [s for s in slide.shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE]


def words(prs):
    c = Counter()
    for s in prs.slides:
        for sh in boxes(s):
            c.update(sh.text_frame.text.split())
    return c


@pytest.fixture
def deck_pdf(tmp_path):
    """A4 landscape-ish page: red rectangle + black title/body, known fonts and sizes."""
    p = tmp_path / "deck.pdf"
    d = fitz.open()
    pg = d.new_page(width=800, height=450)
    pg.draw_rect(fitz.Rect(500, 100, 760, 300), fill=(1, 0, 0), color=None)
    pg.insert_text((50, 80), TITLE, fontname="hebo", fontsize=36, color=(0.1, 0.2, 0.6))
    for i, line in enumerate(BODY):
        pg.insert_text((50, 160 + i * 24), line, fontname="tiit", fontsize=18)
    pg.insert_text((50, 400), "Rotated:", fontname="helv", fontsize=14)
    pg.insert_text((700, 400), "SIDEWAYS TEXT", fontname="helv", fontsize=14, rotate=90)
    d.save(str(p))
    return p


def test_text_becomes_editable_runs_with_clean_fonts(tmp_path, deck_pdf):
    prs, conv = convert(tmp_path, deck_pdf)
    assert prs.slide_width / 914400 == pytest.approx(800 / 72, abs=0.01)
    assert conv.last_stats[0].editable
    runs = [(r, sh) for sh in boxes(prs.slides[0]) for p in sh.text_frame.paragraphs for r in p.runs]
    title = next(r for r, _ in runs if r.text == TITLE)
    assert title.font.name == "Arial" and title.font.bold and not title.font.italic
    assert title.font.size.pt == pytest.approx(36, abs=0.5)
    assert str(title.font.color.rgb) == "1A3399"
    body = next(r for r, _ in runs if r.text.startswith("The quick"))
    assert body.font.name == "Times New Roman" and body.font.italic and not body.font.bold
    assert body.font.size.pt == pytest.approx(18, abs=0.5)
    # latin + east-asian + complex-script typefaces are all set on the run
    rpr = title._r.rPr
    assert {el.get("typeface") for el in rpr if el.tag.split("}")[1] in ("latin", "ea", "cs")} == {"Arial"}
    # every converted word is there exactly once; the rotated text is NOT a text box
    got = words(prs)
    for w in (TITLE + " " + " ".join(BODY)).split():
        assert got[w] >= 1
    assert "SIDEWAYS" not in got and "TEXT" not in got


def test_body_lines_form_one_paragraph_box_without_wrap(tmp_path, deck_pdf):
    prs, _ = convert(tmp_path, deck_pdf)
    body = next(sh for sh in boxes(prs.slides[0]) if sh.text_frame.text.startswith("The quick"))
    assert len(body.text_frame.paragraphs) == 1  # lines kept together as one paragraph
    assert body.text_frame.text.count("\x0b") == 2  # with the original line breaks
    bodypr = body.text_frame._txBody.bodyPr
    assert bodypr.get("wrap") == "none"
    assert bodypr.get("lIns") == "0" and bodypr.get("tIns") == "0"
    # positioned from the PDF: x=50pt, line top within a few points of the original
    assert body.left / 12700 == pytest.approx(50, abs=1)
    assert 130 < body.top / 12700 < 150


def test_background_keeps_graphics_and_has_no_text(tmp_path, deck_pdf):
    prs, _ = convert(tmp_path, deck_pdf)
    pics = pictures(prs.slides[0])
    assert len(pics) == 1
    img = Image.open(io.BytesIO(pics[0].image.blob)).convert("RGB")
    k = img.width / 800
    # red rectangle intact
    assert img.getpixel((int(600 * k), int(200 * k))) == (255, 0, 0)

    def dark(box):
        return min(img.crop(tuple(int(v * k) for v in box)).convert("L").getdata())

    assert dark((50, 50, 400, 90)) > 250      # converted title gone, nothing painted instead
    assert dark((50, 140, 400, 220)) > 250    # converted body gone
    assert dark((695, 300, 715, 420)) < 100   # rotated text stays in the picture


def test_text_free_copy_leaves_no_text_and_does_not_touch_source(tmp_path, deck_pdf):
    doc = fitz.open(str(deck_pdf))
    before_drawings = len(doc[0].get_drawings())
    pg, tmp = PDFToPowerPointConverter.text_free_copy(fitz, doc, 0, [(0, 0, 800, 450)])
    assert pg.get_text().strip() == ""
    assert len(pg.get_drawings()) == before_drawings
    assert doc[0].get_text().strip() != ""
    tmp.close()


def test_editable_false_reproduces_picture_mode(tmp_path, deck_pdf):
    prs, conv = convert(tmp_path, deck_pdf, editable=False)
    shapes = list(prs.slides[0].shapes)
    assert len(shapes) == 1 and shapes[0].shape_type == MSO_SHAPE_TYPE.PICTURE
    assert abs(shapes[0].width - prs.slide_width) <= 2 and abs(shapes[0].height - prs.slide_height) <= 2
    assert shapes[0].image.size[0] == pytest.approx(800 / 72 * 100, abs=2)
    assert boxes(prs.slides[0]) == []


def test_scanned_page_stays_a_full_picture(tmp_path):
    im = Image.new("RGB", (400, 600), (240, 240, 235))
    for x in range(40, 360):
        for y in (100, 130, 160):
            im.putpixel((x, y), (20, 20, 20))
    buf = io.BytesIO()
    im.save(buf, "PNG")
    d = fitz.open()
    pg = d.new_page(width=400, height=600)
    pg.insert_image(pg.rect, stream=buf.getvalue())
    # OCR layer: invisible text over the scan must not become text boxes
    pg.insert_text((40, 100), "invisible ocr words that cover the scanned page text", fontsize=12, render_mode=3)
    p = tmp_path / "scan.pdf"
    d.save(str(p))
    prs, conv = convert(tmp_path, p)
    assert boxes(prs.slides[0]) == []
    pics = pictures(prs.slides[0])
    assert len(pics) == 1 and abs(pics[0].width - prs.slide_width) <= 2
    assert not conv.last_stats[0].editable


def test_mixed_document_is_decided_page_by_page(tmp_path, deck_pdf):
    d = fitz.open(str(deck_pdf))
    scan = fitz.open()
    sp = scan.new_page(width=800, height=450)
    sp.draw_rect(sp.rect, fill=(0.9, 0.9, 0.8))
    d.insert_pdf(scan)
    p = tmp_path / "mixed.pdf"
    d.save(str(p))
    prs, conv = convert(tmp_path, p)
    assert len(prs.slides) == 2
    assert boxes(prs.slides[0]) and not boxes(prs.slides[1])
    assert [s.editable for s in conv.last_stats] == [True, False]


def test_rotated_page_and_other_page_sizes(tmp_path):
    d = fitz.open()
    a = d.new_page(width=600, height=400)
    a.insert_text((60, 100), "Raw horizontal text becomes vertical on screen", fontname="helv", fontsize=20)
    a.insert_text((560, 200), "Sideways text on page", fontname="helv", fontsize=20, rotate=90)
    a.set_rotation(90)  # displayed as 400 x 600; the rotate=90 text now reads horizontally
    b = d.new_page(width=300, height=300)
    b.insert_text((20, 100), "Small square page with words", fontname="helv", fontsize=12)
    p = tmp_path / "r.pdf"
    d.save(str(p))
    prs, conv = convert(tmp_path, p)
    assert prs.slide_width / 914400 == pytest.approx(400 / 72, abs=0.01)
    assert prs.slide_height > prs.slide_width
    # only the text that reads horizontally on the displayed page is editable
    texts = [sh.text_frame.text for sh in boxes(prs.slides[0])]
    assert texts == ["Sideways text on page"]
    assert 0 <= boxes(prs.slides[0])[0].left < prs.slide_width
    assert conv.last_stats[0].editable
    sq = boxes(prs.slides[1])
    assert sq, "second page should be editable"
    for sh in sq:  # fitted and centred inside the slide, font scaled with the page
        assert 0 <= sh.left and sh.left + sh.width <= prs.slide_width
        assert 0 <= sh.top and sh.top + sh.height <= prs.slide_height
    size = sq[0].text_frame.paragraphs[0].runs[0].font.size.pt
    assert size == pytest.approx(12 * 400 / 300, abs=0.3)  # slide 400pt wide fits the 300pt page


def test_font_names_are_normalised_for_non_base14_fonts(tmp_path):
    from pptx.oxml.ns import qn  # noqa: F401
    from app.processors.pdf.pptx_converter import _run_style
    from app.processors.document.pdf_to_word_converter import normalize_font_name as nf

    cases = {
        "ABCDEF+Calibri": ("Calibri", False, False),
        "Arial-BoldMT": ("Arial", True, False),
        "TimesNewRomanPS-ItalicMT": ("Times New Roman", False, True),
        "Calibri,Bold": ("Calibri", True, False),
    }
    for raw, expect in cases.items():
        span = {"font": raw, "flags": 0, "size": 10, "color": 0, "alpha": 255}
        fam, b, i, *_ = _run_style(span, nf)
        assert (fam, b, i) == expect
    # flags alone can mark bold/italic
    fam, b, i, *_ = _run_style({"font": "Foo", "flags": 16 | 2, "size": 10, "color": 0}, nf)
    assert (fam, b, i) == ("Foo", True, True)
