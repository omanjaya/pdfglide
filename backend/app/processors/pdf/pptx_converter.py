"""PDF to PowerPoint converter processor.

Two modes:

* ``editable=False`` - every page is rendered to a picture on a slide (pixel exact,
  nothing editable).
* ``editable=True`` (default) - pages that have a real text layer become a background
  picture *without its text* (pictures, vector art and fills stay pixel exact) plus
  native, editable text boxes placed at the original coordinates. Text that cannot be
  represented faithfully (rotated, vertical, right-to-left, symbol-font glyphs,
  invisible OCR text) is left in the background picture. Pages without a usable text
  layer (scans) stay a full-page picture. Mixed documents are handled page by page.
"""

import asyncio
import io
import logging
import re
import statistics
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError

logger = logging.getLogger(__name__)

# A page needs at least this many visible text characters to be built from text boxes.
MIN_EDITABLE_CHARS = 20
# Gap between two spans of one line (in font sizes) above which they become separate boxes
# (tab stops / table columns would otherwise be squeezed together).
SEGMENT_GAP_EM = 0.6
# Private-use glyphs (Symbol/Wingdings bullets), controls and the replacement character
# do not survive a font substitution -> keep such lines in the picture.
_UNSAFE_RE = re.compile("[-�\x00-\x08\x0b-\x1f‎‏‪-‮]")
# Scripts written right-to-left: PDFs store them in visual order, so the text box would
# come out reversed or mis-shaped. Keep in the picture.
_RTL_RE = re.compile("[֐-ࣿיִ-﷿ﹰ-﻿]")
_HEAVY_RE = re.compile(r"black|heavy|semibold|demi|extrabold|ultrabold", re.I)
# Superscripts are shrunk by PowerPoint (roughly 2/3) when the baseline offset is set.
_SUPER_SHRINK = 0.66


@dataclass
class _Seg:
    """One horizontal run of text that becomes (part of) a text box."""

    x0: float
    y0: float
    x1: float
    y1: float
    spans: list
    size: float
    redact: Tuple[float, float, float, float] = (0, 0, 0, 0)

    @property
    def text(self) -> str:
        return "".join(s["text"] for s in self.spans)


@dataclass
class _Box:
    """A text box: one or more lines kept as line breaks inside one paragraph."""

    segs: List[_Seg] = field(default_factory=list)
    align: str = "l"
    pitch: Optional[float] = None


def _rect_area(r) -> float:
    return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])


def _overlap(a, b) -> float:
    return _rect_area((max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])))


def _transform_rect(rect, matrix):
    import fitz

    r = fitz.Rect(rect) * matrix
    r.normalize()
    return (r.x0, r.y0, r.x1, r.y1)


def _collect_segments(page) -> Tuple[List[_Seg], List[str], int]:
    """Split the page's text into editable segments.

    Returns ``(segments, leftover_texts, visible_chars)`` where leftover_texts are the
    words of lines that stay in the picture.
    """
    import fitz

    rot_matrix = page.rotation_matrix  # unrotated text space -> displayed space
    rotated = page.rotation != 0
    page_rect = page.rect
    invisible = [
        tuple(t["bbox"]) for t in page.get_texttrace() if t.get("type") == 3
    ]
    data = page.get_text("dict", flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)
    segs: List[_Seg] = []
    leftover: List[str] = []
    visible = 0
    for block in data["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            text = "".join(s["text"] for s in line["spans"])
            if not text.strip():
                continue
            bbox = tuple(line["bbox"])
            if any(_overlap(bbox, iv) > 0.5 * _rect_area(bbox) for iv in invisible):
                leftover.extend(text.split())
                continue
            visible += len(text.replace(" ", ""))
            dx, dy = line["dir"]
            if rotated:
                dx, dy = (fitz.Point(dx, dy) * fitz.Matrix(rot_matrix.a, rot_matrix.b,
                                                           rot_matrix.c, rot_matrix.d, 0, 0))
                bbox = _transform_rect(bbox, rot_matrix)
            ok = (
                abs(dx) > 0.999 and dx > 0 and abs(dy) < 0.02
                and not _UNSAFE_RE.search(text)
                and not _RTL_RE.search(text)
                and all(s["size"] >= 1 for s in line["spans"])
                and _overlap(bbox, tuple(page_rect)) >= 0.9 * _rect_area(bbox)
                and bbox[2] - bbox[0] > 0.5 and bbox[3] - bbox[1] > 0.5
            )
            # vertical CJK has dir (0,1) in MuPDF, so the direction test excludes it
            if not ok:
                leftover.extend(text.split())
                continue
            segs.extend(_split_line(line, bbox, rotated, rot_matrix))
    return segs, leftover, visible


def _split_line(line, bbox, rotated, rot_matrix) -> List[_Seg]:
    """Cut a line into segments at large horizontal gaps between spans."""
    spans = []
    for s in line["spans"]:
        if not s["text"]:
            continue
        sb = _transform_rect(s["bbox"], rot_matrix) if rotated else tuple(s["bbox"])
        spans.append((sb, s))
    groups: List[list] = []
    for sb, s in spans:
        if groups:
            prev_sb = groups[-1][-1][0]
            gap = sb[0] - prev_sb[2]
            if gap > SEGMENT_GAP_EM * s["size"] and not (
                groups[-1][-1][1]["text"].endswith(" ") and gap < 1.5 * s["size"]
            ):
                groups.append([])
        else:
            groups.append([])
        groups[-1].append((sb, s))
    out = []
    for g in groups:
        sbs = [x[0] for x in g]
        x0, x1 = min(b[0] for b in sbs), max(b[2] for b in sbs)
        # use the line's vertical extent so all segments of a line share top/height
        y0, y1 = bbox[1], bbox[3]
        sp = []
        for k, (sb, s) in enumerate(g):
            s = dict(s)
            if k + 1 < len(g):
                nb, nxt = g[k + 1]
                gap = nb[0] - sb[2]
                # a positional gap without a space character (Thai, kerned spaces)
                if gap > 0.15 * s["size"] and not s["text"].endswith(" ") and not nxt["text"].startswith(" "):
                    s["text"] += " "
            sp.append(s)
        size = max(s["size"] for s in sp)
        out.append(_Seg(x0, y0, x1, y1, sp, size))
    for seg in out:
        # the part of the redaction that must hit every glyph of the segment but not
        # the neighbouring lines: keep only the central 70% of the line height
        h = seg.y1 - seg.y0
        seg.redact = (seg.x0 + 0.2, seg.y0 + 0.15 * h, seg.x1 - 0.2, seg.y1 - 0.15 * h)
    return out


def _group_boxes(segs: List[_Seg]) -> List[_Box]:
    """Merge consecutive single-segment lines of equal style into multi-line boxes."""
    segs = sorted(segs, key=lambda s: (round(s.y0, 1), s.x0))
    # lines: segments sharing the same y-range belong to one visual line
    by_line: dict = {}
    for s in segs:
        by_line.setdefault((round(s.y0, 1), round(s.y1, 1)), []).append(s)
    lines = [v for _, v in sorted(by_line.items())]
    boxes: List[_Box] = []
    cur: Optional[_Box] = None
    for ln in lines:
        if len(ln) != 1:
            if cur:
                boxes.append(cur)
                cur = None
            boxes.extend(_Box([s]) for s in ln)
            continue
        s = ln[0]
        if cur and _continues(cur, s):
            if len(cur.segs) == 1:
                cur.align = _edge(cur.segs[0], s)
            cur.segs.append(s)
        else:
            if cur:
                boxes.append(cur)
            cur = _Box([s])
    if cur:
        boxes.append(cur)
    for b in boxes:
        _finish_box(b)
    return boxes


def _continues(box: _Box, s: _Seg) -> bool:
    prev = box.segs[-1]
    if abs(s.size - prev.size) > 0.1 * prev.size:
        return False
    pitch = s.y0 - prev.y0
    if not (0.8 * prev.size < pitch < 2.2 * prev.size):
        return False
    if len(box.segs) >= 2:
        last = prev.y0 - box.segs[-2].y0
        if abs(pitch - last) > 0.12 * last + 0.3:
            return False
    ref = box.segs[-1] if len(box.segs) > 1 else None  # None: deciding the alignment
    first = box.segs[0]
    tol = 1.5
    left = abs(s.x0 - first.x0) <= tol
    centre = abs((s.x0 + s.x1) / 2 - (first.x0 + first.x1) / 2) <= tol
    right = abs(s.x1 - first.x1) <= tol
    if ref is None:
        return left or centre or right
    return {"l": left, "c": centre, "r": right}[box.align]


def _edge(first: _Seg, s: _Seg) -> str:
    tol = 1.5
    if abs(s.x0 - first.x0) <= tol:
        return "l"
    if abs((s.x0 + s.x1) / 2 - (first.x0 + first.x1) / 2) <= tol:
        return "c"
    return "r"


def _finish_box(box: _Box) -> None:
    segs = box.segs
    if len(segs) == 1:
        box.align = "l"
        return
    box.pitch = statistics.median(b.y0 - a.y0 for a, b in zip(segs, segs[1:]))


def _run_style(span, family_fn):
    """Return (family, bold, italic, size, rgb, alpha, superscript) for a PDF span."""
    family, bold, italic = family_fn(span["font"])
    flags = span["flags"]
    bold = bold or bool(flags & 16) or bool(_HEAVY_RE.search(span["font"] or ""))
    italic = italic or bool(flags & 2)
    if not family:
        family = "Courier New" if flags & 8 else ("Times New Roman" if flags & 4 else "Arial")
    return family, bold, italic, span["size"], span["color"], span.get("alpha", 255), bool(flags & 1)


def _set_typefaces(rpr, family: str) -> None:
    """Latin, East-Asian and complex-script typeface on one run."""
    from pptx.oxml.ns import qn
    from lxml import etree

    for tag in ("a:latin", "a:ea", "a:cs"):
        for el in rpr.findall(qn(tag)):
            rpr.remove(el)
    # schema order inside rPr: fill, ..., latin, ea, cs, sym, hlinkClick
    anchor = None
    for tag in ("a:hlinkClick", "a:hlinkMouseOver", "a:rtl", "a:extLst"):
        anchor = rpr.find(qn(tag))
        if anchor is not None:
            break
    for tag in ("a:latin", "a:ea", "a:cs"):
        el = etree.SubElement(rpr, qn(tag))
        el.set("typeface", family)
        if anchor is not None:
            anchor.addprevious(el)


def _add_runs(paragraph, spans, scale: float, family_fn, trailing_br: bool) -> None:
    from pptx.dml.color import RGBColor
    from pptx.oxml.ns import qn
    from lxml import etree
    from pptx.util import Pt

    for i, span in enumerate(spans):
        text = span["text"]
        if not text:
            continue
        family, bold, italic, size, rgb, alpha, sup = _run_style(span, family_fn)
        run = paragraph.add_run()
        run.text = text
        f = run.font
        eff = size * scale / (_SUPER_SHRINK if sup else 1.0)
        f.size = Pt(max(1.0, min(round(eff * 100) / 100, 3999)))
        f.bold = bold
        f.italic = italic
        f.color.rgb = RGBColor((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
        rpr = run._r.get_or_add_rPr()
        if sup:
            rpr.set("baseline", "30000")
        if alpha < 255:
            clr = rpr.find(qn("a:solidFill")).find(qn("a:srgbClr"))
            a = etree.SubElement(clr, qn("a:alpha"))
            a.set("val", str(int(alpha / 255 * 100000)))
        _set_typefaces(rpr, family)


def _build_textbox(slide, box: _Box, ox: float, oy: float, scale: float, family_fn) -> None:
    from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
    from pptx.util import Emu, Pt

    segs = box.segs
    x0 = min(s.x0 for s in segs)
    x1 = max(s.x1 for s in segs)
    y0 = segs[0].y0
    y1 = segs[-1].y1
    shape = slide.shapes.add_textbox(
        Emu(int(ox + x0 * scale)), Emu(int(oy + y0 * scale)),
        Emu(max(1, int((x1 - x0) * scale))), Emu(max(1, int((y1 - y0) * scale))),
    )
    tf = shape.text_frame
    tf.word_wrap = False  # never reflow onto another line
    tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.TOP
    p = tf.paragraphs[0]
    p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[box.align]
    # scale is EMU per PDF point; fonts are in slide points (1 pt = 12700 EMU)
    font_scale = scale / 12700.0
    if box.pitch:
        p.line_spacing = Pt(box.pitch * font_scale)
    for i, seg in enumerate(segs):
        if i:
            p.add_line_break()
        _add_runs(p, seg.spans, font_scale, family_fn, False)
    shape.name = "Text " + segs[0].text.strip()[:24]


@dataclass
class PageStats:
    editable: bool = False
    boxes: int = 0
    kept_in_picture_lines: int = 0
    reason: str = ""


class PDFToPowerPointConverter(BaseProcessor):
    """Convert PDF to PowerPoint presentation."""

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        dpi: int = 150,
        editable: bool = True,
    ) -> Path:
        """
        Convert PDF to PowerPoint.

        Args:
            input_path: Path to the input PDF
            output_path: Path for the output PPTX
            dpi: Resolution for rendering pages / backgrounds
            editable: True -> real text as editable text boxes over a text-free
                background; False -> every page is one picture

        Returns:
            Path to the PowerPoint file
        """
        self.last_stats: List[PageStats] = []

        def _convert():
            import fitz  # PyMuPDF: honours page rotation/CropBox, no poppler subprocess
            from pptx import Presentation
            from pptx.dml.color import RGBColor
            from pptx.util import Emu

            from app.processors.document.pdf_to_word_converter import normalize_font_name

            render_dpi = max(72, min(int(dpi), 300))
            emu_per_pt = 914400 / 72  # 1 PDF point = 1/72 inch

            doc = fitz.open(str(input_path))
            try:
                if doc.page_count == 0:
                    raise ProcessingError("No pages found in PDF")

                prs = Presentation()
                # The slide has the physical size of the first page (as displayed,
                # i.e. after /Rotate), so A4/letter/landscape are neither stretched
                # nor letterboxed. PowerPoint limits slides to 56 inches.
                first = doc[0].rect
                scale = min(1.0, 56 * 72 / max(first.width, first.height))
                slide_w = int(first.width * scale * emu_per_pt)
                slide_h = int(first.height * scale * emu_per_pt)
                prs.slide_width = Emu(slide_w)
                prs.slide_height = Emu(slide_h)
                blank_layout = prs.slide_layouts[6]

                for page in doc:
                    # Later pages of a different size keep their own aspect ratio:
                    # scaled uniformly to fit the slide and centred.
                    pw = page.rect.width * scale * emu_per_pt
                    ph = page.rect.height * scale * emu_per_pt
                    fit = min(slide_w / pw, slide_h / ph)
                    width, height = int(pw * fit), int(ph * fit)
                    left, top = (slide_w - width) // 2, (slide_h - height) // 2
                    # EMU per PDF point on this slide
                    k = scale * fit * emu_per_pt

                    stats = PageStats()
                    boxes: List[_Box] = []
                    bg_png: Optional[bytes] = None
                    bg_rgb: Optional[Tuple[int, int, int]] = None
                    if editable:
                        try:
                            boxes, bg_png, bg_rgb, stats = self._editable_page(
                                fitz, doc, page, render_dpi,
                                allow_flat=(width, height) == (slide_w, slide_h),
                            )
                        except Exception as exc:  # never lose a page over this
                            logger.warning("editable PPTX page failed, using picture: %s", exc)
                            boxes, stats = [], PageStats(reason=f"error: {exc}")
                    if not boxes:
                        pix = page.get_pixmap(dpi=render_dpi, alpha=False)
                        bg_png, bg_rgb = pix.tobytes("png"), None
                    self.last_stats.append(stats)

                    slide = prs.slides.add_slide(blank_layout)
                    if bg_rgb is not None:
                        # perfectly flat background: slide fill instead of a picture
                        fill = slide.background.fill
                        fill.solid()
                        fill.fore_color.rgb = RGBColor(*bg_rgb)
                    else:
                        slide.shapes.add_picture(
                            io.BytesIO(bg_png), Emu(left), Emu(top), Emu(width), Emu(height)
                        )
                    for b in boxes:
                        _build_textbox(slide, b, left, top, k, normalize_font_name)
            finally:
                doc.close()

            output_path_pptx = output_path.with_suffix(".pptx")
            prs.save(str(output_path_pptx))
            return output_path_pptx

        try:
            return await asyncio.to_thread(_convert)
        except ImportError as e:
            raise ProcessingError(
                f"Required package not installed: {e}. "
                "Install with: pip install PyMuPDF python-pptx"
            )
        except Exception as e:
            raise ProcessingError(f"Failed to convert PDF to PowerPoint: {str(e)}")

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def text_free_copy(fitz, doc, page_number: int, rects: list):
        """Return ``(page, doc_copy)`` where the text inside ``rects`` is removed.

        Images and vector graphics are left untouched and nothing is painted over the
        removed text (redaction fill disabled). Works on a one-page in-memory copy so the
        caller's document is never modified.
        """
        tmp = fitz.open()
        tmp.insert_pdf(doc, from_page=page_number, to_page=page_number)
        pg = tmp[0]
        mat = pg.derotation_matrix  # displayed space -> unrotated space
        for r in rects:
            pg.add_redact_annot(fitz.Rect(*r) * mat, fill=False)
        pg.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )
        return pg, tmp

    def _editable_page(self, fitz, doc, page, render_dpi, allow_flat=True):
        stats = PageStats()
        segs, leftover, visible = _collect_segments(page)
        if visible < MIN_EDITABLE_CHARS or not segs:
            stats.reason = "no usable text layer"
            return [], None, None, stats
        invisible_chars = sum(len(t["chars"]) for t in page.get_texttrace() if t.get("type") == 3)
        if invisible_chars > 0.5 * (visible + invisible_chars):
            stats.reason = "scanned page with invisible OCR text"
            return [], None, None, stats

        pg, tmp = self.text_free_copy(fitz, doc, page.number, [s.redact for s in segs])
        try:
            # Verify: what is still in the page must be exactly the text we chose to leave
            # (no ghosts of converted text, no damage to kept text).
            remaining = Counter(pg.get_text("text").split())
            expected = Counter(leftover)
            if remaining != expected:
                stats.reason = "redaction mismatch, kept as picture"
                return [], None, None, stats
            pix = pg.get_pixmap(dpi=render_dpi, alpha=False)
        finally:
            tmp.close()
        samples = pix.samples
        bg_rgb = None
        n = pix.n
        if allow_flat and samples[:n] * (len(samples) // n) == samples:
            bg_rgb = tuple(samples[:3])  # perfectly flat: slide background, no picture
        png = None if bg_rgb else pix.tobytes("png")
        stats.editable = True
        boxes = _group_boxes(segs)
        stats.boxes = len(boxes)
        stats.kept_in_picture_lines = len(set(leftover))
        return boxes, png, bg_rgb, stats
