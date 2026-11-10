"""Formatting-preserving PDF to Word converter.

Strategy
--------
* PDFs that carry a real text layer are converted with ``pdf2docx`` (layout
  analysis keeps fonts, sizes, bold/italic, colours, alignment, tables, images,
  page size and margins). The produced DOCX is then post-processed so that font
  names are real family names Word can resolve.
* PDFs without a usable text layer (scans) go through the OCR converter.
* Mixed documents: if at least ``MIN_TEXT_PAGE_RATIO`` of the pages have a text
  layer the whole file takes the layout path (scanned pages are kept as page
  images, so nothing is lost visually); otherwise the whole file is OCR'd.
* Any failure of the layout path falls back to OCR (and is logged).
"""

import asyncio
import copy
import logging
import re
import threading
import zipfile
from pathlib import Path
from typing import Optional, Tuple

from app.core.exceptions import ProcessingError
from app.processors.base import BaseProcessor
from app.processors.document.simple_ocr_converter import SimpleOCRConverter
from app.processors.document.ocr_layout_converter import OCRLayoutConverter

logger = logging.getLogger(__name__)

# A page "has a text layer" when it holds at least this many non-whitespace chars.
MIN_CHARS_PER_PAGE = 20
# Share of pages with a text layer needed to use the layout-preserving path.
MIN_TEXT_PAGE_RATIO = 0.5

# pdf2docx settings (defaults of 0.5.9 unless listed here).
PDF2DOCX_SETTINGS = {
    # Sequential: parsing 100 text pages takes seconds, and worker processes would
    # compete with request handling on a shared 4-CPU host (see tests/measurements).
    "multi_processing": False,
    # A page pdf2docx cannot parse is skipped (and logged) instead of failing the file.
    "ignore_page_error": True,
    # Keep the PDF's own words: never delete hyphens at line ends.
    "delete_end_line_hyphen": False,
}

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_FONT_ATTRS = ("ascii", "hAnsi", "eastAsia", "cs")

# PostScript / PDF base names -> family names Word knows.
_FAMILY_MAP = {
    "timesnewroman": "Times New Roman",
    "times": "Times New Roman",
    "timesroman": "Times New Roman",
    "arial": "Arial",
    "helvetica": "Arial",
    "couriernew": "Courier New",
    "courier": "Courier New",
    "symbol": "Symbol",
    "calibri": "Calibri",
    "cambria": "Cambria",
    "verdana": "Verdana",
    "tahoma": "Tahoma",
    "georgia": "Georgia",
    "trebuchetms": "Trebuchet MS",
    "segoeui": "Segoe UI",
    "msgothic": "MS Gothic",
    "mspgothic": "MS PGothic",
    "msmincho": "MS Mincho",
    "simsun": "SimSun",
    "simhei": "SimHei",
    "malgungothic": "Malgun Gothic",
    "palatinolinotype": "Palatino Linotype",
    "bookantiqua": "Book Antiqua",
    "centurygothic": "Century Gothic",
    "lucidaconsole": "Lucida Console",
}

_STYLE_TOKENS = {"bold": "b", "italic": "i", "oblique": "i", "bd": "b", "it": "i",
                 "regular": "", "roman": "", "normal": "", "book": "", "medium": ""}
_SUBSET_RE = re.compile(r"^[A-Z]{6}\+")
_PS_SUFFIX_RE = re.compile(r"(PSMT|MT|PS)$")


def normalize_font_name(raw: Optional[str]) -> Tuple[Optional[str], bool, bool]:
    """Turn a PDF font name into ``(family, bold, italic)``.

    ``ABCDEF+Calibri,Bold`` -> ``("Calibri", True, False)``;
    ``TimesNewRomanPS-BoldItalicMT`` -> ``("Times New Roman", True, True)``.
    """
    if not raw or not raw.strip():
        return raw, False, False
    name = _SUBSET_RE.sub("", raw.strip())
    bold = italic = False

    if "," in name:
        family, _, style = name.partition(",")
    elif "-" in name:
        family, _, style = name.partition("-")
    else:
        family, style = name, ""
    family = family.strip()

    # Style may be glued to the family: "ArialBold", "CalibriBoldItalic".
    if not style:
        m = re.match(r"^(.*?[a-z0-9])((?:Bold|Italic|Oblique)+)$", family)
        if m:
            family, style = m.group(1), m.group(2)

    style = _PS_SUFFIX_RE.sub("", style.strip())
    for tok in re.findall(r"Bold|Italic|Oblique|Regular|Roman|Normal|[A-Za-z]+", style):
        flag = _STYLE_TOKENS.get(tok.lower())
        if flag == "b":
            bold = True
        elif flag == "i":
            italic = True

    family = _PS_SUFFIX_RE.sub("", family)
    if family.endswith(" Regular") and len(family) > 8:  # "Noto Looped Thai Regular"
        family = family[: -len(" Regular")]
    key = re.sub(r"[\s_]", "", family).lower()
    if key in _FAMILY_MAP:
        family = _FAMILY_MAP[key]
    elif " " not in family:
        # "LiberationSerif" -> "Liberation Serif"; leaves "DejaVu" style acronyms alone.
        family = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", family)
    return family or raw, bold, italic


def analyze_text_layer(pdf_path: Path) -> Tuple[int, int]:
    """Return ``(pages_with_text, total_pages)`` using PyMuPDF."""
    import fitz

    with fitz.open(str(pdf_path)) as pdf:
        total = len(pdf)
        with_text = 0
        for page in pdf:
            chars = len("".join(page.get_text("text").split()))
            if chars >= MIN_CHARS_PER_PAGE:
                with_text += 1
    return with_text, total


def has_text_layer(pdf_path: Path) -> bool:
    """True if the document should use the layout-preserving path."""
    with_text, total = analyze_text_layer(pdf_path)
    return total > 0 and with_text / total >= MIN_TEXT_PAGE_RATIO


def normalize_docx_fonts(docx_path: Path) -> int:
    """Rewrite ``w:rFonts`` in a DOCX with real family names; return #changes.

    Bold/italic found in a font name is moved into the run/style properties.
    """
    from lxml import etree

    q = lambda t: f"{{{W_NS}}}{t}"  # noqa: E731
    changed = 0
    tmp = docx_path.with_suffix(".tmp.docx")
    with zipfile.ZipFile(docx_path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if re.match(r"word/(document|styles|header\d*|footer\d*|footnotes|endnotes)\.xml$", item.filename):
                root = etree.fromstring(data)
                for rfonts in root.iter(q("rFonts")):
                    flags = [False, False]
                    for attr in _FONT_ATTRS:
                        val = rfonts.get(q(attr))
                        if not val:
                            continue
                        fam, b, i = normalize_font_name(val)
                        flags[0] |= b
                        flags[1] |= i
                        if fam != val:
                            rfonts.set(q(attr), fam)
                            changed += 1
                    rpr = rfonts.getparent()
                    if rpr is not None and (flags[0] or flags[1]):
                        anchor = rfonts
                        for flag, tag in ((flags[0], "b"), (flags[1], "i")):
                            if not flag:
                                continue
                            existing = rpr.find(q(tag))
                            if existing is None:  # schema order: rFonts, b, i, ...
                                existing = etree.Element(q(tag))
                                anchor.addnext(existing)
                            anchor = existing
                data = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
            zout.writestr(item, data)
    tmp.replace(docx_path)
    return changed



# --------------------------------------------------------------------------
# pdf2docx patches
# --------------------------------------------------------------------------
_RTL_RE = re.compile("[֐-ࣿיִ-﷿ﹰ-﻿]")
_LTR_RE = re.compile("[A-Za-zÀ-ɏ]")
# Scripts Word renders with the "complex script" font/size attributes.
_CS_RE = re.compile("[֐-ࣿऀ-෿฀-࿿က-႟ក-៿יִ-﷿ﹰ-﻿]")
_EA_RE = re.compile("[⺀-鿿가-힯豈-﫿＀-￯]")
_KANA_RE = re.compile("[぀-ヿ]")
_HANGUL_RE = re.compile("[가-힯]")

_PATCH_LOCK = threading.Lock()
_PATCHED = False


def _line_is_rtl(text: str) -> bool:
    return len(_RTL_RE.findall(text)) > len(_LTR_RE.findall(text))


_RTL_EDGE_RE = re.compile(r"^[\s.,;:!?\u060C\u061B\u061F\u2026]+")


def _fix_rtl_line_edges(spans: list) -> None:
    """MuPDF reports a right-to-left line's trailing punctuation/space at its
    *start*. Put the punctuation back after the last word (``".word word"`` ->
    ``"word word."``); a bare leading space belongs after the first word."""
    spans = [s for s in spans if s.chars]
    if not spans:
        return
    first, last = spans[0], spans[-1]
    m = _RTL_EDGE_RE.match("".join(c.c for c in first.chars))
    if not m or m.end() >= len(first.chars):
        return
    prefix = first.chars[: m.end()]
    punct = [c for c in prefix if not c.c.isspace()]
    spaces = [c for c in prefix if c.c.isspace()]
    del first.chars[: m.end()]
    if not punct:
        # " word" + next span: the space separates the two spans.
        (first if len(spans) > 1 else last).chars.extend(spaces)
        return
    tail = []
    while last.chars and last.chars[-1].c.isspace():
        tail.append(last.chars.pop())
    last.chars.extend(reversed(punct))
    last.chars.extend(reversed(tail))
    last.chars.extend(spaces)


def _patch_pdf2docx() -> None:
    """Idempotent, targeted fixes for three pdf2docx 0.5.9 defects.

    * whitespace-only spans *between* differently formatted words are dropped,
      which glues words together ("Hello" + " " + "World" -> "HelloWorld");
    * raised/lowered small text (super/subscript) loses its baseline shift;
    * spans of right-to-left lines are re-ordered left-to-right, scrambling
      mixed Arabic/Hebrew + Latin lines.
    """
    global _PATCHED
    with _PATCH_LOCK:
        if _PATCHED:
            return
        from pdf2docx.common.Collection import ElementCollection
        from pdf2docx.image.ImageSpan import ImageSpan
        from pdf2docx.text.Line import Line
        from pdf2docx.text.Spans import Spans
        from pdf2docx.text.TextSpan import TextSpan

        def restore(self, raws: list):
            n = len(raws)
            texts = []
            for raw in raws:
                if "image" in raw:
                    texts.append("x")
                else:
                    texts.append("".join(c.get("c", "") for c in raw.get("chars", [])) or raw.get("text", ""))
            # Reference (baseline) span of the line: the biggest text span.
            ref = None
            for raw, t in zip(raws, texts):
                if "image" not in raw and t.strip() and (ref is None or raw.get("size", 0) > ref.get("size", 0)):
                    ref = raw
            built = []
            for idx, raw in enumerate(raws):
                if "image" in raw:
                    span = ImageSpan(raw)
                else:
                    span = TextSpan(raw)
                    if not span.text.strip() and not span.style:
                        interior = (
                            span.text
                            and any(t.strip() for t in texts[:idx])
                            and any(t.strip() for t in texts[idx + 1:])
                        )
                        if not interior:
                            span = None
                    if span is not None and ref is not None and raw is not ref and texts[idx].strip():
                        try:
                            size, rsize = float(raw.get("size", 0)), float(ref.get("size", 0))
                            dy = float(ref["origin"][1]) - float(raw["origin"][1])  # >0: raised
                            if rsize > 0 and size <= 0.85 * rsize and abs(dy) >= max(0.8, 0.12 * size):
                                span._vert = "super" if dy > 0 else "sub"
                                span._vert_size = rsize
                        except (KeyError, TypeError, ValueError, IndexError):
                            pass
                built.append(span)
            if _line_is_rtl("".join(texts)):
                _fix_rtl_line_edges([sp for sp in built if isinstance(sp, TextSpan)])
            for span in built:
                self.append(span)
            return self

        orig_format = TextSpan._set_text_format

        def set_text_format(self, docx_run):
            vert = getattr(self, "_vert", None)
            if not vert:
                return orig_format(self, docx_run)
            saved = self.size
            self.size = getattr(self, "_vert_size", saved)  # Word shrinks sup/sub itself
            try:
                orig_format(self, docx_run)
            finally:
                self.size = saved
            if vert == "super":
                docx_run.font.superscript = True
            else:
                docx_run.font.subscript = True

        orig_sort = ElementCollection.sort_in_line_order

        def sort_in_line_order(self):
            res = orig_sort(self)
            inst = self._instances
            if len(inst) > 1 and all(isinstance(e, Line) for e in inst):
                if _line_is_rtl("".join(e.text for e in inst)):
                    inst.reverse()  # visual right-to-left == logical order
            return res

        Spans.restore = restore
        TextSpan._set_text_format = set_text_format
        ElementCollection.sort_in_line_order = sort_in_line_order
        _PATCHED = True


# --------------------------------------------------------------------------
# DOCX post-processing
# --------------------------------------------------------------------------
_P_ORDER = ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr",
            "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap",
            "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
            "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc",
            "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr",
            "sectPr", "pPrChange"]
_R_ORDER = ["rStyle", "rFonts", "b", "bCs", "i", "iCs", "caps", "smallCaps", "strike", "dstrike", "outline",
            "shadow", "emboss", "imprint", "noProof", "snapToGrid", "vanish", "webHidden", "color", "spacing",
            "w", "kern", "position", "sz", "szCs", "highlight", "u", "effect", "bdr", "shd", "fitText",
            "vertAlign", "rtl", "cs", "em", "lang", "eastAsianLayout", "specVanish", "oMath"]


def _q(tag: str) -> str:
    return f"{{{W_NS}}}{tag}"


def _local(el) -> str:
    return el.tag.rsplit("}", 1)[-1] if isinstance(el.tag, str) else ""


def _get_or_add(parent, tag: str, order: list):
    """Return child ``tag`` of ``parent``, creating it at its schema position."""
    from lxml import etree

    found = parent.find(_q(tag))
    if found is not None:
        return found
    el = etree.Element(_q(tag))
    idx = order.index(tag)
    for child in parent:
        name = _local(child)
        if name in order and order.index(name) > idx:
            child.addprevious(el)
            return el
    parent.append(el)
    return el


def _w(el, attr: str, default=None):
    v = el.get(_q(attr)) if el is not None else None
    return default if v is None else v


def _para_text(p) -> str:
    return "".join(t.text or "" for t in p.iter(_q("t")))


def _run_text(r) -> str:
    return "".join(t.text or "" for t in r.findall(_q("t")))


def _ppr(p, create: bool = False):
    ppr = p.find(_q("pPr"))
    if ppr is None and create:
        from lxml import etree

        ppr = etree.Element(_q("pPr"))
        p.insert(0, ppr)
    return ppr


def _num_cols(sect) -> int:
    cols = sect.find(_q("cols"))
    try:
        return int(_w(cols, "num", "1"))
    except ValueError:
        return 1


def merge_column_sections(body) -> int:
    """Collapse pdf2docx's "one section per column" into real Word columns.

    pdf2docx writes a continuous section holding column 1 followed by a
    ``nextColumn`` section holding column 2. Word/LibreOffice balance the
    columns of every continuous section, so the result is scrambled and
    spills onto extra pages. One multi-column section with an explicit column
    break is equivalent and renders correctly.
    """
    from lxml import etree

    sects = list(body.iter(_q("sectPr")))
    merged = 0
    prev = None
    for cur in sects:
        ctype = cur.find(_q("type"))
        is_next_col = ctype is not None and _w(ctype, "val") == "nextColumn"
        if (
            prev is not None and is_next_col and _num_cols(prev) >= 2 and _num_cols(cur) >= 2
            and _local(prev.getparent()) == "pPr"
        ):
            carrier_p = prev.getparent().getparent()
            nxt = carrier_p.getnext()
            br_run = etree.Element(_q("r"))
            etree.SubElement(br_run, _q("br")).set(_q("type"), "column")
            if nxt is not None and _local(nxt) == "p":
                ppr = nxt.find(_q("pPr"))
                nxt.insert(1 if ppr is not None else 0, br_run)
            else:
                newp = etree.Element(_q("p"))
                newp.append(br_run)
                carrier_p.addnext(newp)
            # The merged section starts the way the first column's section did.
            ptype = prev.find(_q("type"))
            if ctype is not None:
                cur.remove(ctype)
            if ptype is not None:
                cur.insert(0, copy.deepcopy(ptype))
            prev.getparent().remove(prev)
            merged += 1
        prev = cur
    return merged


def fix_hyperlinks(body) -> int:
    """pdf2docx nests ``w:hyperlink`` inside a ``w:r`` (invalid; LibreOffice drops the
    link text, Word may report corruption). Hoist it and carry the run formatting."""
    fixed = 0
    for run in list(body.iter(_q("r"))):
        links = [c for c in run if _local(c) == "hyperlink"]
        if not links:
            continue
        outer = run.find(_q("rPr"))
        for link in links:
            for inner in link.findall(_q("r")):
                irpr = inner.find(_q("rPr"))
                if irpr is None:
                    irpr = etree_element(_q("rPr"))
                    inner.insert(0, irpr)
                have = {_local(c) for c in irpr}
                if outer is not None:
                    for c in outer:
                        if _local(c) not in have:
                            irpr.append(copy.deepcopy(c))
                irpr[:] = sorted(irpr, key=lambda c: _R_ORDER.index(_local(c)) if _local(c) in _R_ORDER else 99)
            run.addprevious(link)
            fixed += 1
        if len(run) == (1 if outer is not None else 0):
            run.getparent().remove(run)
    return fixed


def etree_element(tag):
    from lxml import etree

    return etree.Element(tag)


def _twips(el, attr, default=0) -> int:
    try:
        return int(_w(el, attr, default))
    except (TypeError, ValueError):
        return default


def _first_last_text_runs(p):
    runs = [r for r in p.iter(_q("r")) if _run_text(r).strip()]
    return (runs[0], runs[-1]) if runs else (None, None)


def _run_sig(r):
    rpr = r.find(_q("rPr")) if r is not None else None
    if rpr is None:
        return None
    return (_w(rpr.find(_q("rFonts")), "ascii"), _w(rpr.find(_q("sz")), "val"))


def merge_split_paragraphs(body) -> int:
    """Re-join the trailing line(s) of a justified paragraph that pdf2docx split off.

    Merged only when the first piece is justified, the second is a plain
    left-aligned piece with the same indent, font and size, and the vertical
    gap between them is smaller than a line (i.e. no real paragraph spacing).
    """
    merged = 0
    for parent in {p.getparent() for p in body.iter(_q("p"))}:
        children = list(parent)
        i = 0
        while i < len(children) - 1:
            p1, p2 = children[i], children[i + 1]
            if _local(p1) == "p" and _local(p2) == "p" and _should_merge(p1, p2):
                _absorb(p1, p2)
                parent.remove(p2)
                children.pop(i + 1)
                merged += 1
                continue  # p1 may absorb a further piece
            i += 1
    return merged


def _blocked(p) -> bool:
    ppr = p.find(_q("pPr"))
    if ppr is not None and (ppr.find(_q("numPr")) is not None or ppr.find(_q("sectPr")) is not None):
        return True
    for tag in ("drawing", "pict", "object", "fldChar"):
        if next(p.iter(_q(tag)), None) is not None:
            return True
    return any(_w(b, "type") in ("page", "column") for b in p.iter(_q("br")))


def _should_merge(p1, p2) -> bool:
    ppr1, ppr2 = p1.find(_q("pPr")), p2.find(_q("pPr"))
    if ppr1 is None or ppr2 is None:
        return False
    if _w(ppr1.find(_q("jc")), "val") != "both":
        return False
    if _w(ppr2.find(_q("jc")), "val", "left") not in ("left", "start"):
        return False
    if _blocked(p1) or _blocked(p2) or not _para_text(p1).strip() or not _para_text(p2).strip():
        return False
    i1, i2 = ppr1.find(_q("ind")), ppr2.find(_q("ind"))
    # (The right indent is not compared: pdf2docx derives it from each piece's own extent.)
    if abs(_twips(i1, "left") - _twips(i2, "left")) > 40:
        return False
    if _twips(i2, "firstLine") > _twips(i1, "firstLine") + 20 or _twips(i2, "hanging") > 0:
        return False
    _, last1 = _first_last_text_runs(p1)
    first2, _ = _first_last_text_runs(p2)
    sig1, sig2 = _run_sig(last1), _run_sig(first2)
    if sig1 is None or sig1 != sig2:
        return False
    # Gap smaller than ~35% of the font size => same paragraph (real breaks carry >= 6pt).
    size_halfpt = _twips(first2.find(_q("rPr")).find(_q("sz")), "val", 22)
    before = _twips(ppr2.find(_q("spacing")), "before")
    return before <= size_halfpt * 3.5


def _absorb(p1, p2) -> None:
    from lxml import etree

    # Space between the pieces, unless one already carries it.
    ts1 = [t for t in p1.iter(_q("t"))]
    ts2 = [t for t in p2.iter(_q("t"))]
    tail = (ts1[-1].text or "") if ts1 else ""
    head = (ts2[0].text or "") if ts2 else ""
    if ts1 and tail and head and not tail[-1].isspace() and not head[0].isspace() and tail[-1] != "-":
        ts1[-1].text = tail + " "
        ts1[-1].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for child in list(p2):
        if _local(child) != "pPr":
            p1.append(child)
    sp1 = p1.find(_q("pPr")).find(_q("spacing"))
    sp2 = p2.find(_q("pPr")).find(_q("spacing"))
    if sp1 is not None and sp2 is not None and sp2.get(_q("after")) is not None:
        sp1.set(_q("after"), sp2.get(_q("after")))


# ---- lists -----------------------------------------------------------------
_BULLETS = set("•·▪▫■□●○◦‣⁃➢➤➔►▸◆◇✓✔❖➣")
_BULLET_DASHES = set("-–—*")
_NUM_RE = re.compile(r"^(\(?)(\d{1,3}|[a-z]|[A-Z]|[ivxlc]{2,6}|[IVXLC]{2,6})([.)])$")
_ROMAN = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100}


def _roman_value(s: str) -> int:
    total, prev = 0, 0
    for ch in reversed(s.lower()):
        v = _ROMAN[ch]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def _classify_label(label: str, allow_dash: bool):
    """Return ``(kind, fmt, start, lvl_text_template)`` or None."""
    if len(label) == 1 and (label in _BULLETS or "" <= label <= "" or (allow_dash and label in _BULLET_DASHES)):
        return ("bullet", "bullet", 1, label)
    m = _NUM_RE.match(label)
    if not m:
        return None
    pre, core, post = m.groups()
    if core.isdigit():
        fmt, start = "decimal", int(core)
    elif len(core) == 1:
        fmt = "lowerLetter" if core.islower() else "upperLetter"
        start = ord(core.lower()) - 96
    else:
        fmt = "lowerRoman" if core.islower() else "upperRoman"
        start = _roman_value(core)
    return ("number", fmt, start, pre + "%{lvl}" + post)


def _list_label(p):
    """Detect ``<label><tab>`` at the start of a paragraph. Returns (info, runs_to_drop, strip_text)."""
    runs = [c for c in p if _local(c) == "r"]
    texts = []
    for idx, r in enumerate(runs[:4]):
        if r.find(_q("tab")) is not None and r.find(_q("t")) is None:
            label = "".join(texts).strip()
            info = _classify_label(label, allow_dash=True) if label else None
            return (info, runs[: idx + 1], None) if info else None
        texts.append(_run_text(r))
    # "• text" in a single run (true bullet glyphs only).
    if runs:
        t = _run_text(runs[0])
        if len(t) > 2 and t[0] in _BULLETS and t[1].isspace():
            return (("bullet", "bullet", 1, t[0]), [], runs[0])
    return None


def _tab_pos(ppr):
    tabs = ppr.find(_q("tabs")) if ppr is not None else None
    if tabs is not None:
        for tab in tabs:
            if _w(tab, "val") == "left":
                return _twips(tab, "pos", 0)
    return 0


def convert_lists(doc) -> int:
    """Turn ``•<tab>text`` / ``1.<tab>text`` paragraphs into real Word lists."""
    from lxml import etree

    body = doc.element.body
    items = []  # (paragraph, info, drop, strip_run, left, text_start)
    for p in body.iter(_q("p")):
        if _blocked(p) and p.find(_q("pPr")) is not None and p.find(_q("pPr")).find(_q("numPr")) is not None:
            continue
        found = _list_label(p)
        if not found:
            continue
        info, drop, strip_run = found
        ppr = p.find(_q("pPr"))
        left = _twips(ppr.find(_q("ind")) if ppr is not None else None, "left")
        text_start = _tab_pos(ppr) or left + 360
        if text_start <= left:
            text_start = left + 360
        items.append((p, info, drop, strip_run, left, text_start))

    # Group consecutive list paragraphs (siblings with nothing between them).
    groups, cur = [], []
    for it in items:
        p = it[0]
        if cur and cur[-1][0].getnext() is p:
            cur.append(it)
        else:
            if cur:
                groups.append(cur)
            cur = [it]
    if cur:
        groups.append(cur)

    # Split groups where one level changes kind.
    final = []
    for g in groups:
        lefts = sorted({it[4] for it in g})
        kinds, piece = {}, []
        for it in g:
            lvl = lefts.index(it[4])
            if lvl in kinds and kinds[lvl] != it[1][0]:
                final.append(piece)
                piece, kinds = [], {}
                lefts = sorted({x[4] for x in g[g.index(it):]})
                lvl = lefts.index(it[4])
            kinds[lvl] = it[1][0]
            piece.append(it)
        if piece:
            final.append(piece)

    numbering = doc.part.numbering_part.element
    abs_ids = [int(_w(a, "abstractNumId", 0)) for a in numbering.findall(_q("abstractNum"))]
    num_ids = [int(_w(n, "numId", 0)) for n in numbering.findall(_q("num"))]
    next_abs, next_num = (max(abs_ids, default=-1) + 1), (max(num_ids, default=0) + 1)
    count = 0
    for g in final:
        # A lone "1." paragraph is more likely a heading than a list.
        if len(g) < 2 and g[0][1][0] == "number":
            continue
        lefts = sorted({it[4] for it in g})
        levels = {}
        for it in g:
            lvl = min(lefts.index(it[4]), 8)
            levels.setdefault(lvl, it)
        abstract = etree.Element(_q("abstractNum"))
        abstract.set(_q("abstractNumId"), str(next_abs))
        etree.SubElement(abstract, _q("multiLevelType")).set(_q("val"), "multilevel")
        for lvl in range(9):
            it = levels.get(lvl)
            lv = etree.SubElement(abstract, _q("lvl"))
            lv.set(_q("ilvl"), str(lvl))
            if it:
                kind, fmt, start, tmpl = it[1]
                text_start, left = it[5], it[4]
            else:
                kind, fmt, start, tmpl = "number", "decimal", 1, "%{lvl}."
                left = 720 * lvl + 360
                text_start = left + 360
            etree.SubElement(lv, _q("start")).set(_q("val"), str(start))
            etree.SubElement(lv, _q("numFmt")).set(_q("val"), fmt)
            if kind == "bullet":
                ch = tmpl
                font = None
                if ch == "":
                    font = "Symbol"
                elif "" <= ch <= "":
                    ch, font = "•", "Arial"
                else:
                    font = "Arial"
                etree.SubElement(lv, _q("lvlText")).set(_q("val"), ch)
            else:
                font = None
                etree.SubElement(lv, _q("lvlText")).set(_q("val"), tmpl.replace("%{lvl}", f"%{lvl + 1}"))
            etree.SubElement(lv, _q("lvlJc")).set(_q("val"), "left")
            lp = etree.SubElement(lv, _q("pPr"))
            ind = etree.SubElement(lp, _q("ind"))
            ind.set(_q("left"), str(text_start))
            ind.set(_q("hanging"), str(max(text_start - left, 1)))
            if font:
                rp = etree.SubElement(lv, _q("rPr"))
                rf = etree.SubElement(rp, _q("rFonts"))
                for a in ("ascii", "hAnsi", "cs"):
                    rf.set(_q(a), font)
                rf.set(_q("hint"), "default")
        first_num = numbering.find(_q("num"))
        if first_num is not None:
            first_num.addprevious(abstract)
        else:
            numbering.append(abstract)
        num = etree.SubElement(numbering, _q("num"))
        num.set(_q("numId"), str(next_num))
        etree.SubElement(num, _q("abstractNumId")).set(_q("val"), str(next_abs))

        for p, info, drop, strip_run, left, text_start in g:
            lvl = min(lefts.index(left), 8)
            for r in drop:
                p.remove(r)
            if strip_run is not None:
                for t in strip_run.findall(_q("t")):
                    t.text = (t.text or "")[2:]
                    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                    break
            ppr = _ppr(p, create=True)
            numpr = _get_or_add(ppr, "numPr", _P_ORDER)
            for ch in list(numpr):
                numpr.remove(ch)
            etree.SubElement(numpr, _q("ilvl")).set(_q("val"), str(lvl))
            etree.SubElement(numpr, _q("numId")).set(_q("val"), str(next_num))
            tabs = ppr.find(_q("tabs"))
            if tabs is not None:
                ppr.remove(tabs)
            ind = ppr.find(_q("ind"))
            if ind is not None:  # indent now comes from the numbering level
                for attr in ("left", "firstLine", "hanging"):
                    if ind.get(_q(attr)) is not None:
                        del ind.attrib[_q(attr)]
                ind.set(_q("left"), str(text_start))
                ind.set(_q("hanging"), str(max(text_start - left, 1)))
            # Marker inherits size/font from the paragraph mark.
            first_run, _ = _first_last_text_runs(p)
            if first_run is not None and first_run.find(_q("rPr")) is not None:
                mark = _get_or_add(ppr, "rPr", _P_ORDER)
                if len(mark) == 0:
                    src = first_run.find(_q("rPr"))
                    for tag in ("sz", "szCs", "color"):
                        el = src.find(_q(tag))
                        if el is not None:
                            mark.append(copy.deepcopy(el))
            count += 1
        next_abs += 1
        next_num += 1
    return count


# ---- complex scripts / RTL -------------------------------------------------
def _lang_for(text: str):
    """Return (attr, value) pairs for ``w:lang`` suited to the script of ``text``."""
    out = {}
    if re.search("[֐-׿]", text):
        out["bidi"] = "he-IL"
    elif re.search("[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]", text):
        out["bidi"] = "ar-SA"
    elif re.search("[฀-๿]", text):
        out["bidi"] = "th-TH"
    if _EA_RE.search(text):
        if _KANA_RE.search(text):
            out["eastAsia"] = "ja-JP"
        elif _HANGUL_RE.search(text):
            out["eastAsia"] = "ko-KR"
        else:
            out["eastAsia"] = "zh-CN"
    return out


def _swap_lr(ppr) -> None:
    jc = ppr.find(_q("jc"))
    if jc is not None:
        v = _w(jc, "val")
        if v in ("left", "start"):
            jc.set(_q("val"), "right")
        elif v in ("right", "end"):
            jc.set(_q("val"), "left")
    ind = ppr.find(_q("ind"))
    if ind is not None:
        left, right = ind.get(_q("left")), ind.get(_q("right"))
        for attr, val in (("left", right), ("right", left)):
            if val is not None:
                ind.set(_q(attr), val)
            elif ind.get(_q(attr)) is not None:
                del ind.attrib[_q(attr)]


def apply_script_properties(body) -> Tuple[int, int]:
    """RTL paragraphs get ``w:bidi``; runs in complex/East-Asian scripts get
    the matching font, size and language attributes. Returns (paragraphs, runs)."""
    from lxml import etree

    n_par = n_run = 0
    for p in body.iter(_q("p")):
        text = _para_text(p)
        if not text:
            continue
        rtl_para = _line_is_rtl(text)
        if rtl_para:
            ppr = _ppr(p, create=True)
            if ppr.find(_q("bidi")) is None:
                _get_or_add(ppr, "bidi", _P_ORDER)
                # Under w:bidi, left/right mean start/end: keep the visual side.
                _swap_lr(ppr)
                n_par += 1
        for r in p.iter(_q("r")):
            rt = _run_text(r)
            if not rt:
                continue
            has_cs, has_ea = bool(_CS_RE.search(rt)), bool(_EA_RE.search(rt))
            if not (has_cs or has_ea):
                continue
            rpr = r.find(_q("rPr"))
            if rpr is None:
                rpr = etree.Element(_q("rPr"))
                r.insert(0, rpr)
            if has_cs:
                rf = rpr.find(_q("rFonts"))
                if rf is not None and rf.get(_q("ascii")):
                    rf.set(_q("cs"), rf.get(_q("ascii")))
                sz = rpr.find(_q("sz"))
                if sz is not None and rpr.find(_q("szCs")) is None:
                    _get_or_add(rpr, "szCs", _R_ORDER).set(_q("val"), sz.get(_q("val")))
                for src, dst in (("b", "bCs"), ("i", "iCs")):
                    el = rpr.find(_q(src))
                    if el is not None and _w(el, "val", "1") not in ("0", "false") and rpr.find(_q(dst)) is None:
                        _get_or_add(rpr, dst, _R_ORDER)
                if _RTL_RE.search(rt) and rpr.find(_q("rtl")) is None:
                    _get_or_add(rpr, "rtl", _R_ORDER)
            lang = _lang_for(rt)
            if lang:
                el = _get_or_add(rpr, "lang", _R_ORDER)
                for k, v in lang.items():
                    el.set(_q(k), v)
            n_run += 1
    return n_par, n_run


# ---- document defaults -----------------------------------------------------
def set_document_defaults(doc) -> Optional[Tuple[str, int]]:
    """Make the DOCX default font/size the document's dominant body font."""
    body = doc.element.body
    latin, ea, cs, sizes, cs_sizes = {}, {}, {}, {}, {}
    for r in body.iter(_q("r")):
        text = _run_text(r)
        if not text.strip():
            continue
        rpr = r.find(_q("rPr"))
        rf = rpr.find(_q("rFonts")) if rpr is not None else None
        if rf is None or not rf.get(_q("ascii")):
            continue
        n = len(text.strip())
        font = rf.get(_q("ascii"))
        sz = rpr.find(_q("sz"))
        sz_val = sz.get(_q("val")) if sz is not None else None
        if _CS_RE.search(text):
            cs[font] = cs.get(font, 0) + n
            if sz_val:
                cs_sizes[sz_val] = cs_sizes.get(sz_val, 0) + n
        elif _EA_RE.search(text):
            ea[font] = ea.get(font, 0) + n
        else:
            latin[font] = latin.get(font, 0) + n
            if sz_val:
                sizes[sz_val] = sizes.get(sz_val, 0) + n
    if not (latin or ea or cs):
        return None
    top = lambda d: max(d, key=d.get) if d else None  # noqa: E731
    main = top(latin) or top(ea) or top(cs)
    size = top(sizes) or top(cs_sizes)
    size_cs = top(cs_sizes) or size
    styles = doc.styles.element
    dd = styles.find(_q("docDefaults"))
    if dd is None:
        return None
    rpr_def = dd.find(_q("rPrDefault"))
    rpr = rpr_def.find(_q("rPr")) if rpr_def is not None else None
    if rpr is None:
        return None
    rf = _get_or_add(rpr, "rFonts", _R_ORDER)
    for attr in list(rf.attrib):
        del rf.attrib[attr]
    rf.set(_q("ascii"), main)
    rf.set(_q("hAnsi"), main)
    rf.set(_q("eastAsia"), top(ea) or main)
    rf.set(_q("cs"), top(cs) or main)
    if size:
        _get_or_add(rpr, "sz", _R_ORDER).set(_q("val"), size)
        _get_or_add(rpr, "szCs", _R_ORDER).set(_q("val"), size_cs)
    all_text = "".join(_para_text(p) for p in list(body.iter(_q("p")))[:400])
    lang = _lang_for(all_text)
    if lang:
        el = _get_or_add(rpr, "lang", _R_ORDER)
        for k, v in lang.items():
            el.set(_q(k), v)
    # New paragraphs: single spacing, no extra space (python-docx template has 1.15 / 10pt).
    ppr_def = dd.find(_q("pPrDefault"))
    if ppr_def is not None and ppr_def.find(_q("pPr")) is not None:
        sp = _get_or_add(ppr_def.find(_q("pPr")), "spacing", _P_ORDER)
        sp.set(_q("after"), "0")
        sp.set(_q("line"), "240")
        sp.set(_q("lineRule"), "auto")
    return main, int(size) // 2 if size else 0


def postprocess_docx(docx_path: Path) -> dict:
    """Structural clean-up of a pdf2docx DOCX; each step is isolated so a bug
    in one never costs the user the conversion."""
    from docx import Document

    stats: dict = {}
    doc = Document(str(docx_path))
    body = doc.element.body
    steps = (
        ("hyperlinks", lambda: fix_hyperlinks(body)),
        ("column_sections", lambda: merge_column_sections(body)),
        ("merged_paragraphs", lambda: merge_split_paragraphs(body)),
        ("list_paragraphs", lambda: convert_lists(doc)),
        ("script_props", lambda: apply_script_properties(body)),
        ("defaults", lambda: set_document_defaults(doc)),
    )
    for name, fn in steps:
        try:
            stats[name] = fn()
        except Exception as exc:  # noqa: BLE001 - never lose the conversion over polish
            logger.warning("DOCX post-processing step %s failed: %s", name, exc, exc_info=True)
    doc.save(str(docx_path))
    return stats


def check_pdf_openable(pdf_path: Path) -> None:
    """Raise a user-facing ``ProcessingError`` for PDFs that need a password to open.

    Owner-password-only PDFs (restrictions but empty user password) open fine
    and are converted normally.
    """
    import fitz

    try:
        with fitz.open(str(pdf_path)) as pdf:
            if pdf.needs_pass:
                raise ProcessingError(PASSWORD_MESSAGE)
    except ProcessingError:
        raise
    except Exception as exc:  # corrupt etc.: let the normal path report it
        logger.debug("check_pdf_openable(%s): %s", pdf_path.name, exc)


PASSWORD_MESSAGE = (
    "This PDF is password-protected. Unlock it first (use the Unlock PDF tool) "
    "and then convert it to Word."
)


class _LayoutOCRWithFallback:
    """OCR for scanned PDFs: layout-aware first, plain-text OCR if that fails."""

    def __init__(self, output_dir: Path):
        self.primary = OCRLayoutConverter(output_dir)
        self.fallback = SimpleOCRConverter(output_dir)

    async def execute(
        self, file: Path, output_path: Path, lang: str = "eng", quality: str = "standard"
    ) -> Path:
        try:
            return await self.primary.execute(file, output_path, lang=lang, quality=quality)
        except Exception:
            logger.warning("Layout OCR failed for %s; using plain OCR", file.name, exc_info=True)
            Path(output_path).unlink(missing_ok=True)
            return await self.fallback.execute(file, output_path, lang=lang, quality=quality)


class PDFToWordConverter(BaseProcessor):
    """PDF -> DOCX that keeps fonts, bold/italic, colours, tables and images."""

    def __init__(self, output_dir: Path):
        super().__init__(output_dir)
        self.ocr_converter = _LayoutOCRWithFallback(output_dir)

    async def execute(
        self,
        file: Path,
        output_path: Path,
        lang: str = "eng",
        quality: str = "standard",
    ) -> Path:
        file, output_path = Path(file), Path(output_path)
        await asyncio.to_thread(check_pdf_openable, file)  # password-protected -> clear error
        try:
            use_layout = await asyncio.to_thread(has_text_layer, file)
        except Exception as exc:  # unreadable by PyMuPDF; let OCR path report
            logger.warning("Text-layer detection failed for %s: %s", file.name, exc)
            use_layout = False

        if use_layout:
            try:
                await asyncio.to_thread(self._convert_layout, file, output_path)
                return output_path
            except Exception as exc:
                logger.warning(
                    "Layout-preserving PDF->DOCX failed for %s (%s); falling back to OCR",
                    file.name, exc, exc_info=True,
                )
                output_path.unlink(missing_ok=True)
        else:
            logger.info("No usable text layer in %s; using OCR conversion", file.name)

        return await self.ocr_converter.execute(file, output_path, lang=lang, quality=quality)

    @staticmethod
    def _convert_layout(file: Path, output_path: Path) -> None:
        from pdf2docx import Converter

        _patch_pdf2docx()
        cv = Converter(str(file))
        try:
            cv.convert(str(output_path), **PDF2DOCX_SETTINGS)
            bad = [p.id for p in cv.pages if not getattr(p, "finalized", True)]
            if bad:
                logger.warning("pdf2docx could not convert pages %s of %s", [b + 1 for b in bad], file.name)
        finally:
            cv.close()
        if not output_path.exists() or output_path.stat().st_size == 0:
            raise ProcessingError("pdf2docx produced no output")
        normalize_docx_fonts(output_path)
        stats = postprocess_docx(output_path)
        logger.info("PDF->DOCX post-processing for %s: %s", file.name, stats)
