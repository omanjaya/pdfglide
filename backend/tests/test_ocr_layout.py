"""Tests for the layout-aware OCR converter (no DB, no network).

Pure geometry is tested on synthetic data without Tesseract; one end-to-end test renders a tiny
scan and is skipped when Tesseract is not installed.
"""

import asyncio
import shutil

import cv2
import fitz
import numpy as np
import pytest
from docx import Document
from PIL import Image, ImageDraw, ImageFont

from app.processors.document import ocr_layout_converter as m
from app.processors.document.ocr_layout_converter import (
    Line,
    OCRLayoutConverter,
    Word,
    assign_columns,
    dehyphenate_join,
    detect_marker,
    detect_tables,
    find_columns,
    find_picture_regions,
    infer_alignment,
    join_words,
    order_items,
    snap_size,
    snap_sizes_to_body,
    split_lines_at_gutters,
    split_paragraphs,
    split_tab_segments,
)

DPI = 200.0


def mk_line(text, x0, y, x1, par="p1", size_pt=12.0, col=0, h=33):
    """A synthetic OCR line: words spread evenly over [x0, x1]; baseline = y + h."""
    words = text.split()
    step = (x1 - x0) / max(len(words), 1)
    ws = [Word(t, x0 + i * step, y, x0 + i * step + step * 0.85, y + h, 95, size_pt * DPI / 72 * m.FSIZE_TO_EM)
          for i, t in enumerate(words)]
    ws[-1].x1 = x1
    return Line(ws, x0, y, x1, y + h, base=y + h * 0.8, par=par, block=par, size_pt=size_pt, dpi=DPI, col=col)


PITCH = 12 * 1.2 * DPI / 72          # px between baselines of a normal 12 pt paragraph


# ----------------------------------------------------------------- text helpers
@pytest.mark.parametrize(
    "prev, nxt, expected",
    [
        ("an interna-", "tional treaty", "an international treaty"),      # split word: drop hyphen
        ("the year 1990-", "2000 period", "the year 1990-2000 period"),   # digits: keep
        ("Smith-", "Jones agreed", "Smith-Jones agreed"),                  # capital: keep
        ("plain end", "next line", "plain end next line"),
        ("trailing dash -", "continues", "trailing dash - continues"),
        ("中文第一行", "第二行", "中文第一行第二行"),                        # CJK: no space
    ],
)
def test_dehyphenate_join(prev, nxt, expected):
    assert dehyphenate_join(prev, nxt) == expected


def test_join_words_cjk_and_latin():
    assert join_words(["Hello", "world"]) == "Hello world"
    assert join_words(["你好", "世界"]) == "你好世界"
    assert join_words(["ab", "你好", "cd"]) == "ab 你好 cd"


def test_snap_size_and_body_collapse():
    assert snap_size(11.8) == 12
    assert snap_size(23.4) == 24
    assert snap_size(10.1) == 10
    body, sizes = snap_sizes_to_body([11.6, 12.2, 11.4, 12.1, 24.0, 16.2], [100, 120, 90, 80, 20, 25])
    assert body == 12
    assert sizes == [12, 12, 12, 12, 24, 16]        # noisy 11.x/12.x collapse to the body size


def test_split_tab_segments():
    a = mk_line("Chapter one", 100, 100, 400)
    b = mk_line("12", 1400, 100, 1450)
    segs = split_tab_segments(a.words + b.words, a.em_px)
    assert [len(s) for s in segs] == [2, 1]
    assert len(split_tab_segments(mk_line("a b c d e", 100, 100, 700).words, a.em_px)) == 1


# -------------------------------------------------------------------- alignment
COL = (200.0, 1500.0)


def test_alignment_justified_left_center_right():
    just = [(200, 1500)] * 4 + [(200, 700)]
    ragged = [(200, 1490), (200, 1400), (201, 1470), (200, 1350), (200, 800)]
    assert infer_alignment(just, *COL) == "justify"
    assert infer_alignment(ragged, *COL) == "left"
    assert infer_alignment([(600, 1100)], *COL) == "center"
    assert infer_alignment([(1200, 1500)], *COL) == "right"
    assert infer_alignment([(200, 600)], *COL) == "left"
    centred = [(300, 1400), (420, 1280), (350, 1350)]
    assert infer_alignment(centred, *COL) == "center"
    righted = [(900, 1500), (1100, 1500), (700, 1501)]
    assert infer_alignment(righted, *COL) == "right"


def test_alignment_first_line_indent_is_still_justified():
    ext = [(260, 1500), (200, 1500), (200, 1499), (200, 1500), (200, 900)]
    assert infer_alignment(ext, *COL) == "justify"


def test_alignment_two_line_paragraph_needs_justified_page():
    two = [(200, 1500), (200, 800)]
    assert infer_alignment(two, *COL) == "left"
    assert infer_alignment(two, *COL, justified_prior=True) == "justify"


# ------------------------------------------------------------ paragraph grouping
def body_lines(n, y0, par="p1", x0=200, x1=1500, last=900):
    out = []
    for i in range(n):
        out.append(mk_line("word " * 12, x0, y0 + i * PITCH, last if i == n - 1 else x1, par=par))
    return out


def test_lines_merge_into_paragraphs_by_gap_and_short_line():
    p1 = body_lines(4, 300, "p1")
    # blank-line spacing between paragraphs (8 pt extra)
    p2 = body_lines(3, 300 + 4 * PITCH + 8 * DPI / 72, "p2")
    lines = p1 + p2
    paras = split_paragraphs(lines, [(200, 1500)])
    assert [len(p) for p in paras] == [4, 3]


def test_short_line_ends_paragraph_without_spacing():
    # same Tesseract paragraph id, no extra spacing, but the 4th line is short -> next line starts a new one
    lines = body_lines(4, 300, "p1") + body_lines(3, 300 + 4 * PITCH, "p1")
    paras = split_paragraphs(lines, [(200, 1500)])
    assert [len(p) for p in paras] == [4, 3]


def test_size_change_starts_new_paragraph():
    head = mk_line("Big heading", 200, 200, 700, "h", size_pt=24, h=66)
    head.base = 200 + 66 * 0.8
    lines = [head] + body_lines(3, 330, "p1")
    paras = split_paragraphs(lines, [(200, 1500)])
    assert [len(p) for p in paras] == [1, 3]


def test_list_items_split_and_marker_detection():
    items = []
    for i, t in enumerate(["Expand the north", "Hire forty agents", "Reduce waste"]):
        ln = mk_line("e " + t, 217, 900 + i * PITCH, 800, "p1")
        ln.words[0].x1 = ln.words[0].x0 + 8          # small glyph = bullet 'e'
        ln.words[0].y0 = ln.words[0].y1 - 14
        ln.words[1].x0 = ln.words[0].x1 + 40
        items.append(ln)
    assert detect_marker(items[0], 200)[0] == "bullet"
    plain = mk_line("e of the matter is simple", 200, 900, 1400)
    assert detect_marker(plain, 200) is None               # a real word 'e' of normal height
    num = mk_line("1. First point", 200, 900, 900)
    num.words[0].x1 = num.words[0].x0 + 20
    num.words[1].x0 = num.words[0].x1 + 15
    assert detect_marker(num, 200)[0] == "number"
    assert [len(p) for p in split_paragraphs(items, [(200, 1500)])] == [1, 1, 1]


# ---------------------------------------------------------------------- columns
def two_column_lines():
    lines = []
    for i in range(10):
        lines.append(mk_line("left column words " * 3, 200, 300 + i * PITCH, 780))
        lines.append(mk_line("right column words " * 3, 920, 300 + i * PITCH, 1500))
    return lines


def test_find_columns_two_and_single():
    cols = find_columns(two_column_lines(), 1700)
    assert len(cols) == 2
    assert cols[0][1] < 800 and cols[1][0] > 900
    assert len(find_columns(body_lines(12, 300), 1700)) == 1


def test_reading_order_left_column_then_right_with_full_width_header():
    lines = two_column_lines()
    head = mk_line("Full width title across", 200, 150, 1500)
    lines.append(head)
    cols = find_columns(lines, 1700)
    assert len(cols) == 2
    lines = split_lines_at_gutters(lines, cols)
    assign_columns(lines, cols)
    ordered = order_items(lines, 2)
    assert ordered[0].text.startswith("Full width")
    texts = [l.text.split()[0] for l in ordered[1:]]
    assert texts == ["left"] * 10 + ["right"] * 10


def test_split_lines_at_gutter():
    joined = mk_line("aaa bbb ccc", 200, 300, 780)
    other = mk_line("ddd eee fff", 920, 300, 1500)
    merged = Line(joined.words + other.words, 200, 300, 1500, 333, 326, "p", "b", 12.0, DPI)
    filler = two_column_lines()
    cols = find_columns(filler, 1700)
    parts = split_lines_at_gutters([merged], cols)
    assert [p.text for p in parts] == ["aaa bbb ccc", "ddd eee fff"]


# -------------------------------------------------------------- table detection
def grid_image(rows=3, cols=3, box=(150, 200, 1050, 560), hair=False):
    img = np.full((900, 1200), 255, np.uint8)
    x0, y0, x1, y1 = box
    col = 120 if hair else 0
    xs = np.linspace(x0, x1, cols + 1).astype(int)
    ys = np.linspace(y0, y1, rows + 1).astype(int)
    for y in ys:
        cv2.line(img, (x0, y), (x1, y), col, 1 if hair else 2)
    for x in xs:
        cv2.line(img, (x, y0), (x, y1), col, 1 if hair else 2)
    for r in range(rows):                       # text-like blobs inside cells
        for c in range(cols):
            cv2.rectangle(img, (xs[c] + 20, ys[r] + 20), (xs[c] + 90, ys[r] + 40), 60, -1)
    return img, xs, ys


@pytest.mark.parametrize("hair", [False, True])
def test_detect_ruled_table_grid(hair):
    img, xs, ys = grid_image(hair=hair)
    grids, mask = detect_tables(img, DPI)
    assert len(grids) == 1
    g = grids[0]
    assert len(g.xs) == 4 and len(g.ys) == 4
    assert all(abs(a - b) <= 3 for a, b in zip(g.xs, xs))
    assert all(abs(a - b) <= 3 for a, b in zip(g.ys, ys))
    assert mask.any()


def test_no_table_for_plain_text_single_box_or_underline():
    img = np.full((900, 1200), 255, np.uint8)
    for i in range(6):                                           # text-like lines
        cv2.rectangle(img, (150, 100 + i * 50), (1000, 125 + i * 50), 80, -1)
    assert detect_tables(img, DPI)[0] == []
    box = np.full((900, 1200), 255, np.uint8)
    cv2.rectangle(box, (150, 200), (1000, 500), 0, 2)            # one bordered box = 1 cell
    assert detect_tables(box, DPI)[0] == []
    ul = np.full((900, 1200), 255, np.uint8)
    cv2.line(ul, (150, 300), (900, 300), 0, 2)                   # signature line
    assert detect_tables(ul, DPI)[0] == []


def test_filled_picture_next_to_table_is_not_a_table():
    img, _, _ = grid_image()
    cv2.rectangle(img, (150, 600), (700, 860), 90, -1)           # dark block touching nothing
    grids, _ = detect_tables(img, DPI)
    assert len(grids) == 1 and grids[0].y1 < 600


# ---------------------------------------------------------------- picture finder
def test_find_picture_regions_ignores_text_and_finds_blob():
    img = np.full((900, 1200), 255, np.uint8)
    grad = np.tile(np.linspace(60, 160, 300, dtype=np.uint8), (200, 1))
    img[300:500, 400:700] = grad
    words = [(100, 100, 300, 130), (320, 100, 520, 130)]
    for (a, b, c, d) in words:
        cv2.rectangle(img, (a, b), (c, d), 40, -1)                # "text" boxes are excluded via `boxes`
    pics = find_picture_regions(img, words, DPI)
    assert len(pics) == 1
    p = pics[0]
    assert 380 <= p.x0 <= 420 and 680 <= p.x1 <= 720 and 280 <= p.y0 <= 320 and 480 <= p.y1 <= 520


# ------------------------------------------------------------------ end to end
needs_tesseract = pytest.mark.skipif(shutil.which("tesseract") is None, reason="tesseract not installed")


def _font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


@needs_tesseract
def test_end_to_end_scanned_page(tmp_path):
    dpi = 200
    w, h = int(8.5 * dpi), int(11 * dpi)
    img = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(img)
    title_f, body_f = _font(int(24 * dpi / 72)), _font(int(12 * dpi / 72))
    d.text((w // 2, 250), "Quarterly Report", font=title_f, fill=0, anchor="mm")
    text = ("The committee reviewed the results of the last quarter and agreed that "
            "revenue grew steadily across every region while costs stayed under control.").split()
    y, line, lines = 400, "", []
    for word in text:
        trial = (line + " " + word).strip()
        if d.textlength(trial, font=body_f) > w - 2 * 200:
            lines.append(line)
            line = word
        else:
            line = trial
    lines.append(line)
    for ln in lines:
        d.text((200, y), ln, font=body_f, fill=0)
        y += int(12 * 1.25 * dpi / 72)
    buf = Image.new("RGB", img.size)
    buf.paste(img)
    pdf = fitz.open()
    page = pdf.new_page(width=612, height=792)
    import io
    b = io.BytesIO()
    buf.save(b, "PNG")
    page.insert_image(page.rect, stream=b.getvalue())
    src = tmp_path / "scan.pdf"
    pdf.save(src)
    out = tmp_path / "out.docx"
    conv = OCRLayoutConverter(tmp_path / "work")
    result = asyncio.run(conv.execute(src, out, "eng", "standard"))
    assert result == out and out.exists()
    doc = Document(str(out))
    sec = doc.sections[0]
    assert round(sec.page_width.pt) == 612 and round(sec.page_height.pt) == 792
    paras = [p for p in doc.paragraphs if p.text.strip()]
    # one title + ONE flowing body paragraph (not one paragraph per line)
    assert len(paras) == 2, [p.text for p in paras]
    assert "Quarterly" in paras[0].text and paras[0].style.name.startswith("Heading")
    assert "revenue grew steadily" in paras[1].text
    assert max(r.font.size.pt for r in paras[0].runs if r.font.size) > 18


@needs_tesseract
def test_blank_and_photo_pages_do_not_crash(tmp_path):
    pdf = fitz.open()
    for kind in ("blank", "photo"):
        arr = np.full((600, 500), 255, np.uint8)
        if kind == "photo":
            yy, xx = np.mgrid[0:600, 0:500]
            arr = (128 + 60 * np.sin(xx / 7.0) + 60 * np.cos(yy / 5.0)).astype(np.uint8)
        ok, png = cv2.imencode(".png", arr)
        page = pdf.new_page(width=400, height=480)
        page.insert_image(page.rect, stream=png.tobytes())
    src = tmp_path / "x.pdf"
    pdf.save(src)
    out = tmp_path / "x.docx"
    asyncio.run(OCRLayoutConverter(tmp_path / "w").execute(src, out))
    doc = Document(str(out))
    assert len(doc.sections) == 2
    assert round(doc.sections[0].page_width.pt) == 400 and round(doc.sections[0].page_height.pt) == 480
    assert len(doc.inline_shapes) == 1            # the photo page became a picture, blank stayed empty
