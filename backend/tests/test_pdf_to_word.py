"""Tests for the formatting-preserving PDF -> Word converter (no DB, no network)."""

import zipfile
from pathlib import Path

import fitz
import pytest
from docx import Document
from docx.shared import Pt

from app.processors.document import pdf_to_word_converter as mod
from app.processors.document.pdf_to_word_converter import (
    PDFToWordConverter,
    analyze_text_layer,
    has_text_layer,
    normalize_docx_fonts,
    normalize_font_name,
)


# ---------------------------------------------------------------- font names
@pytest.mark.parametrize(
    "raw, expected",
    [
        ("ABCDEF+Calibri", ("Calibri", False, False)),
        ("ABCDEF+Calibri,Bold", ("Calibri", True, False)),
        ("TimesNewRomanPSMT", ("Times New Roman", False, False)),
        ("TimesNewRomanPS-BoldItalicMT", ("Times New Roman", True, True)),
        ("Arial-BoldMT", ("Arial", True, False)),
        ("Arial-ItalicMT", ("Arial", False, True)),
        ("ArialMT", ("Arial", False, False)),
        ("Calibri,BoldItalic", ("Calibri", True, True)),
        ("XYZABC+Helvetica-Oblique", ("Arial", False, True)),
        ("Times-Roman", ("Times New Roman", False, False)),
        ("CourierNewPS-BoldMT", ("Courier New", True, False)),
        ("SegoeUI-Bold", ("Segoe UI", True, False)),
        ("LiberationSerif-Italic", ("Liberation Serif", False, True)),
        ("ArialBold", ("Arial", True, False)),
        ("Liberation Sans", ("Liberation Sans", False, False)),
        ("Carlito", ("Carlito", False, False)),
    ],
)
def test_normalize_font_name(raw, expected):
    assert normalize_font_name(raw) == expected


def test_normalize_font_name_empty():
    assert normalize_font_name("") == ("", False, False)
    assert normalize_font_name(None) == (None, False, False)


def test_normalize_docx_fonts_rewrites_all_scripts_and_moves_style(tmp_path):
    doc = Document()
    run = doc.add_paragraph().add_run("hello")
    rfonts = run._r.get_or_add_rPr().get_or_add_rFonts()
    w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(w + attr, "ABCDEF+Calibri,Bold")
    path = tmp_path / "x.docx"
    doc.save(path)

    assert normalize_docx_fonts(path) >= 4  # template styles may also be touched (Courier)

    out = Document(str(path))
    r = out.paragraphs[0].runs[0]
    assert r.font.name == "Calibri"
    assert r.bold is True and not r.italic
    xml = zipfile.ZipFile(path).read("word/document.xml").decode()
    assert "ABCDEF" not in xml and ",Bold" not in xml
    for attr in ("eastAsia", "cs"):
        assert f'w:{attr}="Calibri"' in xml


# ------------------------------------------------------------- text layer
def _text_pdf(path: Path, pages: int = 1) -> Path:
    pdf = fitz.open()
    for i in range(pages):
        page = pdf.new_page()
        page.insert_text((72, 100), "A real text layer with enough characters.", fontsize=12)
    pdf.save(path)
    return path


def _scanned_pdf(path: Path, pages: int = 1) -> Path:
    src = fitz.open()
    p = src.new_page()
    p.insert_text((72, 100), "Rendered into an image below", fontsize=20)
    png = p.get_pixmap(dpi=72).tobytes("png")
    pdf = fitz.open()
    for _ in range(pages):
        page = pdf.new_page()
        page.insert_image(page.rect, stream=png)
    pdf.save(path)
    return path


def test_text_layer_detection(tmp_path):
    text = _text_pdf(tmp_path / "t.pdf", 2)
    scan = _scanned_pdf(tmp_path / "s.pdf", 2)
    assert analyze_text_layer(text) == (2, 2)
    assert analyze_text_layer(scan) == (0, 2)
    assert has_text_layer(text) is True
    assert has_text_layer(scan) is False


def test_mixed_document_threshold(tmp_path):
    # 2 text pages + 1 scan -> majority text -> layout path; 1 + 2 -> OCR path.
    a = fitz.open()
    a.insert_pdf(fitz.open(_text_pdf(tmp_path / "t.pdf", 2)))
    a.insert_pdf(fitz.open(_scanned_pdf(tmp_path / "s.pdf", 1)))
    a.save(tmp_path / "m1.pdf")
    b = fitz.open()
    b.insert_pdf(fitz.open(tmp_path / "t.pdf"), to_page=0)
    b.insert_pdf(fitz.open(tmp_path / "s.pdf"))
    b.insert_pdf(fitz.open(_scanned_pdf(tmp_path / "s2.pdf", 1)))
    b.save(tmp_path / "m2.pdf")
    assert has_text_layer(tmp_path / "m1.pdf") is True
    assert has_text_layer(tmp_path / "m2.pdf") is False


# ------------------------------------------------------------ end to end
def _formatted_pdf(path: Path) -> Path:
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 90), "Big Bold Heading", fontname="hebo", fontsize=24)
    page.insert_text((72, 130), "Plain serif paragraph with several words in it.", fontname="tiro", fontsize=12)
    page.insert_text((72, 160), "Italic sans line of text for the test.", fontname="heit", fontsize=11)
    # A ruled 2x2 table.
    x0, y0, cw, rh = 72, 200, 150, 28
    for r in range(3):
        page.draw_line((x0, y0 + r * rh), (x0 + 2 * cw, y0 + r * rh))
    for c in range(3):
        page.draw_line((x0 + c * cw, y0), (x0 + c * cw, y0 + 2 * rh))
    for r in range(2):
        for c in range(2):
            page.insert_text((x0 + c * cw + 8, y0 + r * rh + 18), f"cell{r}{c}", fontname="helv", fontsize=11)
    pdf.save(path)
    return path


async def test_end_to_end_formatting_survives(tmp_path):
    src = _formatted_pdf(tmp_path / "f.pdf")
    out = tmp_path / "f.docx"
    await PDFToWordConverter(tmp_path).execute(src, out)

    doc = Document(str(out))
    runs = {r.text.strip(): r for p in doc.paragraphs for r in p.runs if r.text.strip()}

    heading = next(r for t, r in runs.items() if t.startswith("Big Bold"))
    assert heading.font.name == "Arial"  # Helvetica-Bold -> real family
    assert heading.bold is True
    assert heading.font.size.pt == pytest.approx(24, abs=1)

    body = next(r for t, r in runs.items() if t.startswith("Plain serif"))
    assert body.font.name == "Times New Roman"
    assert not body.bold
    assert body.font.size.pt == pytest.approx(12, abs=1)

    italic = next(r for t, r in runs.items() if t.startswith("Italic sans"))
    assert italic.italic is True

    assert len(doc.tables) == 1
    cells = [c.text.strip() for row in doc.tables[0].rows for c in row.cells]
    assert cells == ["cell00", "cell01", "cell10", "cell11"]

    # No raw PostScript names left in the XML.
    xml = zipfile.ZipFile(out).read("word/document.xml").decode()
    assert "Helvetica" not in xml and "Times-Roman" not in xml


# ---------------------------------------------------------------- fallback
class _StubOCR:
    def __init__(self):
        self.calls = []

    async def execute(self, file, output_path, lang="eng", quality="standard"):
        self.calls.append((lang, quality))
        Path(output_path).write_bytes(b"ocr")
        return output_path


async def test_layout_failure_falls_back_to_ocr(tmp_path, monkeypatch):
    src = _text_pdf(tmp_path / "t.pdf")

    def boom(file, output_path):
        output_path.write_bytes(b"partial")
        raise RuntimeError("pdf2docx exploded")

    monkeypatch.setattr(PDFToWordConverter, "_convert_layout", staticmethod(boom))
    conv = PDFToWordConverter(tmp_path)
    conv.ocr_converter = _StubOCR()
    out = tmp_path / "o.docx"
    await conv.execute(src, out, lang="ind", quality="high")
    assert conv.ocr_converter.calls == [("ind", "high")]
    assert out.read_bytes() == b"ocr"


async def test_scanned_pdf_uses_ocr_with_lang_and_quality(tmp_path, monkeypatch):
    src = _scanned_pdf(tmp_path / "s.pdf")
    called = []
    monkeypatch.setattr(PDFToWordConverter, "_convert_layout", staticmethod(lambda f, o: called.append(1)))
    conv = PDFToWordConverter(tmp_path)
    conv.ocr_converter = _StubOCR()
    await conv.execute(src, tmp_path / "o.docx", lang="deu", quality="draft")
    assert not called
    assert conv.ocr_converter.calls == [("deu", "draft")]


# ================================================== hardening (real-world PDFs)
import copy  # noqa: E402

import pikepdf  # noqa: E402
from docx.oxml import parse_xml  # noqa: E402
from docx.oxml.ns import nsdecls, qn  # noqa: E402

from app.core.exceptions import ProcessingError  # noqa: E402
from app.processors.document.pdf_to_word_converter import (  # noqa: E402
    PASSWORD_MESSAGE,
    apply_script_properties,
    check_pdf_openable,
    convert_lists,
    fix_hyperlinks,
    merge_column_sections,
    merge_split_paragraphs,
    postprocess_docx,
    set_document_defaults,
    _fix_rtl_line_edges,
)

NS = nsdecls("w", "r")


def _convert(tmp_path, pdf_path):
    import asyncio

    out = tmp_path / "out.docx"
    asyncio.run(PDFToWordConverter(tmp_path).execute(pdf_path, out))
    return out


# ------------------------------------------------------------ encryption
def _encrypted(tmp_path, user="", owner="owner-secret"):
    src = _text_pdf(tmp_path / "plain.pdf")
    dst = tmp_path / ("user.pdf" if user else "owner.pdf")
    with pikepdf.open(src) as pdf:
        pdf.save(dst, encryption=pikepdf.Encryption(
            user=user, owner=owner, R=6, allow=pikepdf.Permissions(extract=False, modify_other=False)))
    return dst


async def test_user_password_pdf_gives_clear_error(tmp_path):
    pdf = _encrypted(tmp_path, user="open-sesame")
    with pytest.raises(ProcessingError) as exc:
        await PDFToWordConverter(tmp_path).execute(pdf, tmp_path / "x.docx")
    assert "password-protected" in str(exc.value.message) and "Unlock" in str(exc.value.message)
    assert str(exc.value.message) == PASSWORD_MESSAGE
    with pytest.raises(ProcessingError):
        check_pdf_openable(pdf)


async def test_owner_password_only_pdf_converts(tmp_path):
    pdf = _encrypted(tmp_path, user="")
    out = tmp_path / "x.docx"
    await PDFToWordConverter(tmp_path).execute(pdf, out)
    assert any("A real text layer" in p.text for p in Document(str(out)).paragraphs)


# ------------------------------------------------ pdf2docx patches (real PDFs)
def test_space_span_between_formats_is_kept(tmp_path):
    pdf = fitz.open()
    page = pdf.new_page()
    x = 72
    for text, font in (("Hello", "hebo"), (" ", "helv"), ("World", "hebo"), (" ", "helv"),
                       ("again and some more words to make the line longer.", "helv")):
        page.insert_text((x, 100), text, fontname=font, fontsize=12)
        x += fitz.get_text_length(text, fontname=font, fontsize=12)
    pdf.save(tmp_path / "s.pdf")
    doc = Document(str(_convert(tmp_path, tmp_path / "s.pdf")))
    assert any("Hello World again" in p.text for p in doc.paragraphs)


def test_superscript_and_subscript_get_baseline_shift(tmp_path):
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "Energy of the system E = mc", fontname="helv", fontsize=12)
    x = 72 + fitz.get_text_length("Energy of the system E = mc", fontname="helv", fontsize=12)
    page.insert_text((x, 95), "2", fontname="helv", fontsize=7)       # raised
    page.insert_text((x + 6, 100), " and H", fontname="helv", fontsize=12)
    x2 = x + 6 + fitz.get_text_length(" and H", fontname="helv", fontsize=12)
    page.insert_text((x2, 102), "2", fontname="helv", fontsize=7)     # lowered
    page.insert_text((x2 + 6, 100), "O.", fontname="helv", fontsize=12)
    pdf.save(tmp_path / "s.pdf")
    doc = Document(str(_convert(tmp_path, tmp_path / "s.pdf")))
    runs = [r for p in doc.paragraphs for r in p.runs if r.text.strip() == "2"]
    assert len(runs) == 2
    assert runs[0].font.superscript is True
    assert runs[1].font.subscript is True
    assert runs[0].font.size.pt == pytest.approx(12, abs=1)  # Word shrinks it itself


def test_two_column_page_becomes_one_multicolumn_section(tmp_path):
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((200, 70), "Two column title", fontname="hebo", fontsize=20)
    lorem = "The quick brown fox jumps over the lazy dog while the committee reviews figures. " * 14
    page.insert_textbox(fitz.Rect(72, 110, 285, 700), "LEFTCOL " + lorem, fontname="tiro", fontsize=11)
    page.insert_textbox(fitz.Rect(310, 110, 523, 700), "RIGHTCOL " + lorem, fontname="tiro", fontsize=11)
    pdf.save(tmp_path / "c.pdf")
    out = _convert(tmp_path, tmp_path / "c.pdf")
    xml = zipfile.ZipFile(out).read("word/document.xml").decode()
    assert 'w:val="nextColumn"' not in xml          # no per-column sections left
    assert 'w:type="column"' in xml                 # explicit column break instead
    text = " ".join(p.text for p in Document(str(out)).paragraphs)
    assert text.index("LEFTCOL") < text.index("RIGHTCOL")  # reading order


# ------------------------------------------------- DOCX post-processing units
def _docx_with(body_xml: str, tmp_path: Path) -> Path:
    doc = Document()
    body = doc.element.body
    for child in list(body):
        body.remove(child)
    for el in parse_xml(f"<w:body {NS}>{body_xml}</w:body>"):
        body.append(el)
    path = tmp_path / "p.docx"
    doc.save(path)
    return path


def _para(text, jc=None, before=0, left=362, sz=22, font="Carlito", after=None):
    jc_xml = f'<w:jc w:val="{jc}"/>' if jc else ""
    after_xml = f' w:after="{after}"' if after is not None else ""
    return (f'<w:p><w:pPr><w:spacing w:line="280" w:lineRule="exact" w:before="{before}"{after_xml}/>'
            f'<w:ind w:left="{left}" w:right="0" w:firstLine="0"/>{jc_xml}</w:pPr>'
            f'<w:r><w:rPr><w:rFonts w:ascii="{font}"/><w:sz w:val="{sz}"/></w:rPr><w:t xml:space="preserve">{text}</w:t></w:r></w:p>')


def test_justified_paragraph_split_is_merged(tmp_path):
    xml = (_para("First lines of a justified paragraph that is long.", "both", 200)
           + _para("and its short last line.", "left", 42, after=240)
           + _para("A genuinely new paragraph.", "left", 200))
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert merge_split_paragraphs(doc.element.body) == 1
    texts = [p.text for p in doc.paragraphs]
    assert texts == ["First lines of a justified paragraph that is long. and its short last line.",
                     "A genuinely new paragraph."]
    assert "JUSTIFY" in str(doc.paragraphs[0].alignment)
    assert doc.paragraphs[0].paragraph_format.space_after.twips == 240  # spacing of the tail kept


def test_split_merge_leaves_real_paragraphs_alone(tmp_path):
    xml = (_para("Justified paragraph one.", "both", 200)
           + _para("Real next paragraph with spacing.", "left", 200)       # big gap
           + _para("Justified again.", "both", 200)
           + _para("Different font follows.", "left", 20, font="Arial")    # other font
           + _para("Justified third.", "both", 200)
           + _para("Indented differently.", "left", 20, left=900))         # other indent
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert merge_split_paragraphs(doc.element.body) == 0
    assert len(doc.paragraphs) == 6


def test_column_sections_merge_unit(tmp_path):
    sect = lambda typ: (f'<w:sectPr><w:type w:val="{typ}"/><w:pgSz w:w="12240" w:h="15840"/>'  # noqa: E731
                        f'<w:cols w:num="2" w:equalWidth="0"><w:col w:w="4700" w:space="0"/><w:col w:w="4600" w:space="0"/></w:cols></w:sectPr>')
    xml = (f"<w:p><w:r><w:t>title</w:t></w:r></w:p>"
           f"<w:p><w:pPr>{sect('continuous')}</w:pPr><w:r><w:t>col one</w:t></w:r></w:p>"
           f"<w:p><w:r><w:t>col two</w:t></w:r></w:p>"
           f"<w:sectPr><w:type w:val=\"nextColumn\"/><w:pgSz w:w=\"12240\" w:h=\"15840\"/>"
           f"<w:cols w:num=\"2\"><w:col w:w=\"4700\"/><w:col w:w=\"4600\"/></w:cols></w:sectPr>")
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert merge_column_sections(doc.element.body) == 1
    sects = list(doc.element.body.iter(qn("w:sectPr")))
    assert len(sects) == 1
    assert sects[0].find(qn("w:type")).get(qn("w:val")) == "continuous"
    assert 'w:type="column"' in doc.element.body.xml


def test_lists_become_real_numbering(tmp_path):
    tab = "<w:r><w:tab/></w:r>"
    def item(label, text, left):
        return (f'<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="{left + 360}"/></w:tabs>'
                f'<w:ind w:left="{left}" w:right="0" w:firstLine="0"/></w:pPr>'
                f'<w:r><w:rPr><w:rFonts w:ascii="Open Symbol"/><w:sz w:val="22"/></w:rPr><w:t>{label}</w:t></w:r>{tab}'
                f'<w:r><w:rPr><w:rFonts w:ascii="Carlito"/><w:sz w:val="22"/></w:rPr><w:t>{text}</w:t></w:r></w:p>')
    xml = (item("", "bullet one", 362) + item("", "bullet two", 362) + item("", "nested", 722)
           + item("1.", "first", 362) + item("2.", "second", 362) + _para("Plain paragraph after."))
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert convert_lists(doc) == 5
    paras = doc.paragraphs
    assert [p.text for p in paras[:5]] == ["bullet one", "bullet two", "nested", "first", "second"]
    num_ids = {p._p.pPr.numPr.numId.val for p in paras[:5]}
    assert len(num_ids) == 2  # one bullet list, one numbered list
    assert paras[2]._p.pPr.numPr.ilvl.val == 1  # deeper indent -> nested level
    assert paras[0]._p.pPr.numPr.ilvl.val == 0
    assert paras[5]._p.pPr is None or paras[5]._p.pPr.numPr is None
    xml_num = doc.part.numbering_part.element.xml
    assert 'w:numFmt w:val="decimal"' in xml_num and 'w:numFmt w:val="bullet"' in xml_num
    assert "" in xml_num and 'w:ascii="Symbol"' in xml_num


def test_lone_numbered_paragraph_is_not_a_list(tmp_path):
    xml = ('<w:p><w:r><w:t>2.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>Results</w:t></w:r></w:p>' + _para("Body text."))
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert convert_lists(doc) == 0


def test_hyperlink_nested_in_run_is_hoisted(tmp_path):
    xml = ('<w:p><w:r><w:rPr><w:rFonts w:ascii="Carlito"/><w:color w:val="0000FF"/><w:sz w:val="22"/><w:u w:val="single"/></w:rPr>'
           '<w:hyperlink r:id="rId9" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>example.com</w:t></w:r></w:hyperlink></w:r>'
           '<w:r><w:t> after</w:t></w:r></w:p>')
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert fix_hyperlinks(doc.element.body) == 1
    p = doc.paragraphs[0]._p
    assert [c.tag.split("}")[1] for c in p] == ["hyperlink", "r"]
    inner_rpr = p[0].find(qn("w:r")).find(qn("w:rPr"))
    tags = [c.tag.split("}")[1] for c in inner_rpr]
    assert tags[0] == "rStyle" and {"rFonts", "color", "sz", "u"} <= set(tags)


def test_rtl_paragraph_and_complex_script_runs(tmp_path):
    ar = "هذا نص عربي للاختبار"
    xml = (f'<w:p><w:pPr><w:spacing w:before="0"/><w:ind w:left="0" w:right="400"/><w:jc w:val="right"/></w:pPr>'
           f'<w:r><w:rPr><w:rFonts w:ascii="Noto Naskh Arabic" w:hAnsi="Noto Naskh Arabic"/><w:b/><w:sz w:val="26"/></w:rPr><w:t>{ar}</w:t></w:r></w:p>'
           f'<w:p><w:r><w:rPr><w:rFonts w:ascii="Droid Sans Fallback"/><w:sz w:val="26"/></w:rPr><w:t>中文测试</w:t></w:r></w:p>'
           f'<w:p><w:r><w:rPr><w:rFonts w:ascii="Noto Looped Thai"/><w:sz w:val="26"/></w:rPr><w:t>ทดสอบภาษาไทย</w:t></w:r></w:p>'
           f'<w:p><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>Plain English</w:t></w:r></w:p>')
    doc = Document(str(_docx_with(xml, tmp_path)))
    apply_script_properties(doc.element.body)
    arabic, chinese, thai, english = [p._p for p in doc.paragraphs]
    assert arabic.pPr.find(qn("w:bidi")) is not None
    assert arabic.pPr.find(qn("w:jc")).get(qn("w:val")) == "left"      # visually right under bidi
    assert arabic.pPr.find(qn("w:ind")).get(qn("w:left")) == "400"     # right indent became start indent
    rpr = arabic.find(qn("w:r")).find(qn("w:rPr"))
    assert rpr.find(qn("w:rtl")) is not None
    assert rpr.find(qn("w:rFonts")).get(qn("w:cs")) == "Noto Naskh Arabic"
    assert rpr.find(qn("w:szCs")).get(qn("w:val")) == "26" and rpr.find(qn("w:bCs")) is not None
    assert rpr.find(qn("w:lang")).get(qn("w:bidi")) == "ar-SA"
    assert chinese.find(qn("w:r")).find(qn("w:rPr")).find(qn("w:lang")).get(qn("w:eastAsia")) == "zh-CN"
    thai_rpr = thai.find(qn("w:r")).find(qn("w:rPr"))
    assert thai_rpr.find(qn("w:rFonts")).get(qn("w:cs")) == "Noto Looped Thai"
    assert thai_rpr.find(qn("w:rtl")) is None and thai.find(qn("w:pPr")) is None
    assert english.find(qn("w:pPr")) is None


def test_rtl_line_edge_punctuation_moves_to_line_end():
    class Ch:
        def __init__(self, c):
            self.c = c

    class Sp:
        def __init__(self, s):
            self.chars = [Ch(c) for c in s]

        @property
        def text(self):
            return "".join(c.c for c in self.chars)

    a = Sp(".هذا نص ")
    _fix_rtl_line_edges([a])
    assert a.text == "هذا نص. "
    b, c = Sp(" الشركة"), Sp("PDFGlide 2026")
    _fix_rtl_line_edges([b, c])
    assert (b.text, c.text) == ("الشركة ", "PDFGlide 2026")


def test_document_defaults_follow_dominant_font(tmp_path):
    xml = _para("Dominant body text " * 20, font="Georgia", sz=24) + _para("small", font="Arial", sz=16)
    doc = Document(str(_docx_with(xml, tmp_path)))
    assert set_document_defaults(doc) == ("Georgia", 12)
    dd = doc.styles.element.find(qn("w:docDefaults"))
    rf = dd.find(qn("w:rPrDefault")).find(qn("w:rPr")).find(qn("w:rFonts"))
    assert rf.get(qn("w:ascii")) == "Georgia" and rf.get(qn("w:asciiTheme")) is None
    assert dd.find(qn("w:rPrDefault")).find(qn("w:rPr")).find(qn("w:sz")).get(qn("w:val")) == "24"
    sp = dd.find(qn("w:pPrDefault")).find(qn("w:pPr")).find(qn("w:spacing"))
    assert sp.get(qn("w:after")) == "0"


def test_postprocess_isolates_step_failures(tmp_path, monkeypatch):
    path = _docx_with(_para("Hello world."), tmp_path)
    monkeypatch.setattr(mod, "merge_split_paragraphs", lambda body: 1 / 0)
    stats = postprocess_docx(path)
    assert "merged_paragraphs" not in stats and "defaults" in stats
    assert Document(str(path)).paragraphs[0].text == "Hello world."


# ---------------------------------------------------- real subset-prefixed names
def test_subset_prefixed_names_end_up_as_real_families(tmp_path):
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 100), "Heading in Helvetica bold", fontname="hebo", fontsize=18)
    page.insert_text((72, 140), "Body in Times roman text here.", fontname="tiro", fontsize=12)
    pdf.save(tmp_path / "base.pdf")
    renames = {"Helvetica-Bold": "ABCDEF+Arial-BoldMT", "Times-Roman": "GHIJKL+TimesNewRomanPSMT"}
    with pikepdf.open(tmp_path / "base.pdf") as p:
        hits = 0
        for obj in p.objects:
            if isinstance(obj, pikepdf.Dictionary) and "/BaseFont" in obj:
                old = str(obj.BaseFont)[1:]
                if old in renames:
                    obj.BaseFont = pikepdf.Name("/" + renames[old])
                    hits += 1
        assert hits == 2
        p.save(tmp_path / "subset.pdf")
    assert {f[3] for f in fitz.open(tmp_path / "subset.pdf")[0].get_fonts()} == set(renames.values())
    out = _convert(tmp_path, tmp_path / "subset.pdf")
    runs = {r.text.strip(): r for p in Document(str(out)).paragraphs for r in p.runs if r.text.strip()}
    head = next(r for t, r in runs.items() if t.startswith("Heading"))
    body = next(r for t, r in runs.items() if t.startswith("Body"))
    assert head.font.name == "Arial" and head.bold is True
    assert body.font.name == "Times New Roman" and not body.bold
    xml = zipfile.ZipFile(out).read("word/document.xml").decode()
    assert "ABCDEF" not in xml and "GHIJKL" not in xml and "MT" not in xml.replace("MTWO", "")


def test_normalize_font_name_strips_trailing_regular():
    assert normalize_font_name("Noto Looped Thai Regular") == ("Noto Looped Thai", False, False)
    assert normalize_font_name("Times New Roman") == ("Times New Roman", False, False)
