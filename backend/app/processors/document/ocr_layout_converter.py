"""Layout-aware OCR PDF -> DOCX converter for scanned PDFs.

Unlike ``SimpleOCRConverter`` (plain text, one font), this converter runs Tesseract
once per page with hOCR output and rebuilds the page structure:

* page size / orientation and margins per PDF page (one DOCX section per page)
* paragraphs merged from lines, de-hyphenated, in reading order (1-3 columns)
* font size per paragraph (hOCR ``x_fsize``), headings, bold (stroke width), alignment,
  indentation, bullet / numbered lists, tab-separated segments
* ruled tables (OpenCV line detection) as real DOCX tables
* pictures (Tesseract ``ocr_photo`` blocks + a pixel based fallback) cropped from the page
* serif / sans font choice, East-Asian / complex-script font slots, RTL paragraphs

Everything that is pure geometry (grouping, alignment, sizes, grids) lives in module level
functions so that it can be unit tested without Tesseract.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import re
import shutil
import statistics
import subprocess
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from app.core.exceptions import ProcessingError
from app.processors.base import BaseProcessor

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- constants

DPI_BY_QUALITY = {"draft": 150, "standard": 200, "high": 300}
FSIZE_TO_EM = 0.925         # hOCR x_fsize (with --dpi 72 = pixels) is ~0.925 em (calibrated on Times/Arial scans)
SIZE_STEPS = [7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 54, 60, 72]
BOLD_RATIO = 1.28           # word stroke/em ratio relative to page median to call a word bold
USE_BOLD = True

RTL_LANGS = {"ara", "heb", "fas", "urd"}
CJK_FONTS = {  # (serif, sans)
    "chi_sim": ("SimSun", "Microsoft YaHei"),
    "chi_tra": ("PMingLiU", "Microsoft JhengHei"),
    "jpn": ("MS Mincho", "MS Gothic"),
    "kor": ("Batang", "Malgun Gothic"),
}
CS_FONTS = {  # complex scripts: (serif, sans)
    "ara": ("Times New Roman", "Arial"),
    "heb": ("Times New Roman", "Arial"),
    "fas": ("Times New Roman", "Arial"),
    "urd": ("Times New Roman", "Arial"),
    "tha": ("Angsana New", "Tahoma"),
    "hin": ("Mangal", "Mangal"),
}
LANG_TAGS = {"eng": "en-US", "ind": "id-ID", "deu": "de-DE", "fra": "fr-FR", "spa": "es-ES",
             "chi_sim": "zh-CN", "chi_tra": "zh-TW", "jpn": "ja-JP", "kor": "ko-KR", "ara": "ar-SA",
             "heb": "he-IL", "tha": "th-TH", "hin": "hi-IN"}

_CJK_RE = re.compile(r"[⺀-鿿豈-﫿＀-￯　-ヿ가-힯]")
_BULLET_CHARS = set("•·●○▪■◦–—-*»›>▶►")
_BULLET_SYMBOL_LOOKALIKES = {"¢", "«", "°", "@", "©", "®", "¥", "+", "»"}
_BULLET_LETTER_LOOKALIKES = {"e", "o", "x", "w", "c"}
_NUM_MARKER_RE = re.compile(r"^(\(?\d{1,3}[.)]|\(?[a-zA-Z][.)]|\(?[ivxIVX]{1,4}[.)])$")
_LINE_CLASSES = {"ocr_line", "ocr_header", "ocr_caption", "ocr_textfloat"}
_DESC_CHARS = set("gjpqy,;()[]{}|/@Q")

# ------------------------------------------------------------------------ data classes


@dataclass
class Word:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    conf: float = 90.0
    fsize: float = 0.0       # px (hOCR x_fsize)
    bold: Optional[bool] = None


@dataclass
class Line:
    words: list
    x0: float
    y0: float
    x1: float
    y1: float
    base: float = 0.0        # baseline y (px)
    par: str = ""
    block: str = ""
    size_pt: float = 0.0
    dpi: float = 200.0
    tabbed: bool = False
    col: int = -1            # column index, -1 = full width
    textangle: int = 0       # hOCR textangle (Tesseract read sideways text)

    @property
    def text(self) -> str:
        return join_words([w.text for w in self.words])

    @property
    def width(self) -> float:
        return self.x1 - self.x0

    @property
    def em_px(self) -> float:
        return self.size_pt * self.dpi / 72.0


@dataclass
class Picture:
    x0: float
    y0: float
    x1: float
    y1: float
    fill: float = 0.5


@dataclass
class TableGrid:
    x0: int
    y0: int
    x1: int
    y1: int
    xs: list                 # vertical line x positions
    ys: list                 # horizontal line y positions


# ------------------------------------------------------------------ text helpers (pure)


def is_cjk(ch: str) -> bool:
    return bool(ch) and bool(_CJK_RE.match(ch))


def join_words(words: list) -> str:
    """Join OCR words with spaces, except between two CJK characters."""
    out = ""
    for w in words:
        if not w:
            continue
        if out and not (is_cjk(out[-1]) and is_cjk(w[0])):
            out += " "
        out += w
    return out


def dehyphenate_join(prev: str, nxt: str) -> str:
    """Join two consecutive lines of one paragraph.

    A line-end hyphen is dropped when it splits a word (letter before, lowercase letter after);
    it is kept for things like ``1990-`` / ``well-`` followed by uppercase or digits.
    CJK lines are joined without a space.
    """
    prev = prev.rstrip()
    nxt = nxt.lstrip()
    if not prev:
        return nxt
    if not nxt:
        return prev
    if is_cjk(prev[-1]) and is_cjk(nxt[0]):
        return prev + nxt
    if prev.endswith(("-", "\u00ad", "\u2010")) and len(prev) >= 3 and not prev.endswith(" -"):
        before = prev[-2]
        if before.isalpha() and nxt[0].islower():
            return prev[:-1] + nxt           # "interna-" + "tional" -> "international" (a real compound loses its hyphen: accepted)
        if before.isalnum() and nxt[0].isalnum():
            return prev + nxt                # "1990-" + "2000", "Smith-" + "Jones": keep the hyphen
    return prev + " " + nxt


def snap_size(pt: float) -> float:
    """Snap a measured point size to the nearest usual font size (relative distance)."""
    if pt <= 0:
        return 11.0
    return min(SIZE_STEPS, key=lambda s: abs(s - pt) / s)


def snap_sizes_to_body(sizes: list, weights: Optional[list] = None) -> tuple:
    """Return (body_size, snapped_sizes). Body size = weighted mode of snapped sizes; sizes within
    6% of the body size collapse to it."""
    snapped = [snap_size(s) for s in sizes]
    tally: dict = {}
    for i, s in enumerate(snapped):
        tally[s] = tally.get(s, 0) + (weights[i] if weights else 1)
    body = max(tally, key=tally.get) if tally else 11.0
    out = [body if abs(s - body) / body < 0.09 else s for s in snapped]
    return body, out


def est_line_size_pt(words: list, dpi: float) -> float:
    """Font size in points of one OCR line.

    hOCR ``x_fsize`` (px at --dpi 72) is accurate for lines that contain ascenders and descenders.
    For lines without descenders (``Two column section``) it under-reads by ~12%, so there the
    line box height (ascender/cap top .. baseline ~ 0.70 em) is used instead.
    """
    text = "".join(w.text for w in words)
    fs = [w.fsize for w in words if w.fsize > 0 and w.conf >= 50] or [w.fsize for w in words if w.fsize > 0]
    a = statistics.median(fs) * 72.0 / dpi / FSIZE_TO_EM if fs else 0.0
    if text and sum(1 for c in text if is_cjk(c)) >= 0.5 * len(text):
        # CJK glyph boxes fill the whole em square: x_fsize reads ~1.2 em (measured: 14 pt -> 46 px @200 dpi)
        return statistics.median(fs) * 72.0 / dpi / 1.2 if fs else a
    has_desc = any(c in _DESC_CHARS for c in text)
    has_asc = any(c.isupper() or c.isdigit() or c in "bdfhklt" for c in text)
    if has_asc and not has_desc and len(text) >= 6 and not any(ord(c) > 0x2ff for c in text):
        h = max(w.y1 - w.y0 for w in words)
        b = h * 72.0 / dpi / 0.70
        if a <= 0 or (0.9 * b <= a * 1.35 and b > a):
            return b if a <= 0 else min(b, a * 1.3)
    if a > 0:
        return a
    hs = [w.y1 - w.y0 for w in words]
    return statistics.median(hs) * 72.0 / dpi / 0.8 if hs else 11.0


def split_tab_segments(words: list, em_px: float, gap_em: float = 2.5) -> list:
    """Split a line's words into segments separated by gaps wider than ``gap_em`` em."""
    segs: list = []
    for w in words:
        if segs and (w.x0 - segs[-1][-1].x1) <= gap_em * em_px:
            segs[-1].append(w)
        else:
            segs.append([w])
    return segs


# ------------------------------------------------------------------ columns / ordering


def find_columns(lines: list, page_w: float, max_cols: int = 3) -> list:
    """Detect text columns from a vertical whitespace gutter (word coverage histogram).
    Returns [(x0, x1), ...]; a single entry when the page is one column."""
    body = [ln for ln in lines if len(ln.words) >= 2]
    if len(body) < 8:
        return [(min((l.x0 for l in lines), default=0), max((l.x1 for l in lines), default=page_w))]
    xs0 = sorted(l.x0 for l in body)
    xs1 = sorted(l.x1 for l in body)
    left, right = xs0[int(0.02 * (len(xs0) - 1))], xs1[int(0.98 * (len(xs1) - 1))]
    text_w = right - left
    if text_w <= 0:
        return [(left, right)]
    cov = np.zeros(int(page_w) + 2, np.int32)
    for l in body:
        for w in l.words:
            cov[max(int(w.x0), 0):int(w.x1) + 1] += 1
    limit = 0.2 * len(body)          # a gutter is crossed by few lines (full-width headings/rules)
    min_gap = max(0.02 * page_w, 12)
    cuts = []
    i = int(left + 0.15 * text_w)
    stop = int(right - 0.15 * text_w)
    while i < stop:
        if cov[i] <= limit:
            j = i
            while j < stop and cov[j] <= limit:
                j += 1
            if j - i >= min_gap:
                cuts.append((i, j))
            i = j
        else:
            i += 1
    cols = []
    start = left
    for a, b in cuts[: max_cols - 1]:
        cols.append((start, a))
        start = b
    cols.append((start, right))
    if len(cols) == 1:
        return cols
    # each column needs substance and vertical overlap; otherwise it is ragged single-column text
    ranges = []
    for (a, b) in cols:
        ls = [l for l in body if a - 2 <= l.x0 and l.x1 <= b + 2 and l.width >= 0.25 * (b - a)]
        if len(ls) < 4:
            return [(left, right)]
        ranges.append((min(l.y0 for l in ls), max(l.y1 for l in ls)))
    lo = max(r[0] for r in ranges)
    hi = min(r[1] for r in ranges)
    shortest = min(r[1] - r[0] for r in ranges)
    if shortest <= 0 or (hi - lo) < 0.5 * shortest:
        return [(left, right)]
    return cols


def split_lines_at_gutters(lines: list, cols: list) -> list:
    """Tesseract sometimes joins the lines of neighbouring columns; split a line where its words
    leave a gap as wide as (most of) the gutter."""
    if len(cols) < 2:
        return lines
    out: list = []
    gaps = [(cols[i][1], cols[i + 1][0]) for i in range(len(cols) - 1)]
    for ln in lines:
        groups = [[ln.words[0]]]
        for w in ln.words[1:]:
            prev = groups[-1][-1]
            cut = any(prev.x1 <= ga + 0.4 * (gb - ga) and w.x0 >= gb - 0.4 * (gb - ga) and (w.x0 - prev.x1) >= 0.6 * (gb - ga)
                      for ga, gb in gaps)
            if cut:
                groups.append([w])
            else:
                groups[-1].append(w)
        if len(groups) == 1:
            out.append(ln)
            continue
        for gi, g in enumerate(groups):
            out.append(Line(g, min(x.x0 for x in g), min(x.y0 for x in g), max(x.x1 for x in g), max(x.y1 for x in g),
                            ln.base, f"{ln.par}.{gi}", f"{ln.block}.{gi}", ln.size_pt, ln.dpi))
    return out


def merge_same_row_lines(lines: list) -> list:
    """Single-column pages: Tesseract often reports the cells of an un-ruled table, or a title and
    its right-aligned page number, as separate lines on one visual row. Join them (left to right)
    so the row can later be emitted tab-separated."""
    rows: list = []
    for ln in sorted(lines, key=lambda l: ((l.y0 + l.y1) / 2, l.x0)):
        h = ln.y1 - ln.y0
        for r in rows:
            top, bot = max(r[0].y0, ln.y0), min(r[0].y1, ln.y1)
            hh = min(r[0].y1 - r[0].y0, h)
            if hh > 0 and (bot - top) / hh >= 0.6 and abs(r[0].size_pt - ln.size_pt) <= 0.25 * max(ln.size_pt, 1):
                r.append(ln)
                break
        else:
            rows.append([ln])
    out: list = []
    for r in rows:
        if len(r) == 1:
            out.append(r[0])
            continue
        r.sort(key=lambda l: l.x0)
        ws = [w for l in r for w in l.words]
        first = r[0]
        out.append(Line(ws, min(l.x0 for l in r), min(l.y0 for l in r), max(l.x1 for l in r), max(l.y1 for l in r),
                        statistics.median(l.base for l in r), first.par, first.block, first.size_pt, first.dpi))
    return out


def assign_columns(items: list, cols: list) -> None:
    """Set ``item.col`` = column index, or -1 when an item spans several columns."""
    if len(cols) == 1:
        for it in items:
            it.col = 0
        return
    for it in items:
        hits = [i for i, (a, b) in enumerate(cols) if min(it.x1, b) - max(it.x0, a) > 0.15 * (b - a)]
        if len(hits) >= 2:
            it.col = -1
        else:
            cx = (it.x0 + it.x1) / 2
            it.col = min(range(len(cols)), key=lambda i: abs(cx - (cols[i][0] + cols[i][1]) / 2))


def order_items(items: list, ncols: int) -> list:
    """Reading order: full-width items split the page into bands; inside a band column 0 is read
    before column 1, etc."""
    if ncols <= 1:
        return sorted(items, key=lambda it: (it.y0, it.x0))
    out: list = []
    band: list = []

    def flush():
        for c in range(ncols):
            out.extend(sorted([b for b in band if b.col == c], key=lambda it: it.y0))
        band.clear()

    for it in sorted(items, key=lambda it: (it.y0, it.x0)):
        if it.col == -1:
            flush()
            out.append(it)
        else:
            band.append(it)
    flush()
    return out


# ----------------------------------------------------------- paragraph grouping (pure)


def detect_marker(line: Line, col_left: float) -> Optional[tuple]:
    """Return (kind, marker_text, text_left_x) for list items, else None.
    kind is 'bullet' or 'number'. OCR renders bullets as 'e', '¢', '«', '*', 'o' ...: a letter-like
    glyph only counts when it is much smaller than the word after it."""
    ws = line.words
    if len(ws) < 2:
        return None
    w0, w1 = ws[0], ws[1]
    em = max(line.em_px, 1.0)
    gap = w1.x0 - w0.x1
    t = w0.text
    if _NUM_MARKER_RE.match(t) and gap >= 0.2 * em:
        if t.strip("().").isdigit() or w0.x0 - col_left >= 0.8 * em:
            return ("number", t, w1.x0)
        return None
    glyph_w = w0.x1 - w0.x0
    if t in _BULLET_CHARS or (len(t) <= 1 and not t.isalnum()) or t in _BULLET_SYMBOL_LOOKALIKES:
        if gap >= 0.45 * em and glyph_w <= 1.2 * em:
            return ("bullet", t, w1.x0)
    elif t in _BULLET_LETTER_LOOKALIKES and gap >= 0.6 * em and glyph_w <= 0.7 * em \
            and (w0.y1 - w0.y0) < 0.7 * (w1.y1 - w1.y0) and w0.x0 - col_left >= 0.0:
        return ("bullet", t, w1.x0)
    return None


def infer_alignment(extents: list, col_left: float, col_right: float,
                    justified_prior: bool = False) -> str:
    """Alignment of a paragraph from its line extents [(x0, x1), ...] relative to the text column.
    Returns left | center | right | justify."""
    colw = max(col_right - col_left, 1.0)
    tol = max(0.014 * colw, 4.0)
    n = len(extents)
    if n == 0:
        return "left"
    if n == 1:
        x0, x1 = extents[0]
        lg, rg = x0 - col_left, col_right - x1
        if x1 - x0 > 0.9 * colw:
            return "justify" if justified_prior else "left"
        if abs(lg - rg) <= 0.04 * colw and lg > 0.06 * colw:
            return "center"
        if rg <= 0.03 * colw and lg > 0.1 * colw:
            return "right"
        return "left"
    body = extents[:-1]
    lefts = [e[0] for e in extents]
    rights = [e[1] for e in extents]
    centers = [(e[0] + e[1]) / 2 for e in extents]
    # first-line indentation must not break "left aligned" detection
    cont_lefts = lefts[1:] if n > 2 else lefts
    b_rights = [e[1] for e in body]
    right_spread = max(b_rights) - min(b_rights)
    if len(body) >= 2:
        if right_spread <= tol and abs(statistics.mean(b_rights) - col_right) <= 0.05 * colw \
                and (max(cont_lefts) - min(cont_lefts)) <= 2 * tol:
            return "justify"
    elif abs(b_rights[0] - col_right) <= tol and justified_prior:
        return "justify"          # one full line + last line: only trust it on pages that are justified
    c_spread = max(centers) - min(centers)
    l_spread = max(lefts) - min(lefts)
    r_spread = max(rights) - min(rights)
    if c_spread <= tol * 1.5 and l_spread > 3 * tol and r_spread > 3 * tol:
        return "center"
    if r_spread <= tol and l_spread > 3 * tol:
        return "right"
    return "left"


def estimate_line_pitch_ratio(lines: list) -> float:
    """Typical baseline-to-baseline distance / font size from consecutive lines of one Tesseract
    paragraph (line spacing, ~1.15-1.5)."""
    rs = []
    for a, b in zip(lines, lines[1:]):
        if a.par == b.par and a.col == b.col and abs(a.size_pt - b.size_pt) < 0.1 * max(a.size_pt, 1) \
                and a.size_pt > 0:
            d = (b.base - a.base) * 72.0 / a.dpi
            r = d / a.size_pt
            if 0.9 < r < 2.2:
                rs.append(r)
    return statistics.median(rs) if len(rs) >= 3 else 1.2


def split_paragraphs(lines: list, cols: list, pitch_ratio: float = 1.2) -> list:
    """Group ordered lines into paragraphs. ``lines`` must already be in reading order;
    ``line.col`` selects the column extents in ``cols``. Returns a list of lists of lines."""
    if not lines:
        return []
    ref: dict = {}
    for ci, (a, b) in enumerate(cols):
        ls = [l for l in lines if l.col == ci and len(l.words) >= 3]
        if len(ls) >= 3:
            x0s = sorted(l.x0 for l in ls)
            x1s = sorted(l.x1 for l in ls)
            ref[ci] = (x0s[int(0.1 * (len(x0s) - 1))], x1s[int(0.9 * (len(x1s) - 1))])
        else:
            ref[ci] = (a, b)
    ref[-1] = (min(v[0] for v in ref.values()), max(v[1] for v in ref.values()))

    paras: list = [[lines[0]]]
    marker_left: dict = {}
    for prev, cur in zip(lines, lines[1:]):
        cl, cr = ref.get(cur.col, ref[-1])
        colw = max(cr - cl, 1.0)
        em = max(cur.em_px, 1.0)
        cur_marker = detect_marker(cur, cl)
        first = paras[-1][0]
        item_marker = marker_left.get(id(first))
        if item_marker is None and first is prev:
            item_marker = detect_marker(first, ref.get(first.col, ref[-1])[0])
            if item_marker:
                marker_left[id(first)] = item_marker
        brk = False
        bd_pt = (cur.base - prev.base) * 72.0 / cur.dpi
        expect = pitch_ratio * max(cur.size_pt, prev.size_pt)
        if prev.col != cur.col or prev.tabbed or cur.tabbed:
            brk = True
        elif cur_marker is not None:
            brk = True
        elif abs(cur.size_pt - prev.size_pt) > (0.1 if cur.par != prev.par else 0.2) * max(cur.size_pt, prev.size_pt):
            brk = True
        elif bd_pt > 1.3 * expect + 0.5:
            brk = True
        elif bd_pt < 0.3 * expect:
            brk = True        # overlapping line boxes (side-by-side blocks)
        else:
            prev_short = (cr - prev.x1) > 0.3 * colw
            indent = (cur.x0 - cl) > 1.2 * em and (prev.x0 - cl) < 0.6 * em
            if item_marker is not None:
                # list item continuation lines hang at the item's text left
                brk = abs(cur.x0 - item_marker[2]) > 1.5 * em and cur.x0 < item_marker[2] - 1.5 * em
            else:
                brk = (cur.par != prev.par and (prev_short or indent)) or prev_short \
                    or (indent and prev.par != cur.par) \
                    or (prev.width < 0.55 * colw and cur.width < 0.55 * colw and prev.x0 - cl < 0.1 * colw
                        and abs(prev.x0 - cur.x0) < 0.05 * colw and prev.par != cur.par)
        if brk:
            paras.append([cur])
        else:
            paras[-1].append(cur)
    return paras


def join_paragraph_text(lines: list) -> str:
    text = ""
    for ln in lines:
        text = dehyphenate_join(text, ln.text) if text else ln.text
    return text


# ----------------------------------------------------------------- image helpers (cv2)


def normalize_background(gray: np.ndarray) -> np.ndarray:
    """Flatten uneven lighting / grey scan backgrounds (division by an estimated background)."""
    h, w = gray.shape
    s = 0.25
    small = cv2.resize(gray, (max(8, int(w * s)), max(8, int(h * s))), interpolation=cv2.INTER_AREA)
    bg = cv2.dilate(small, np.ones((9, 9), np.uint8))
    bg = cv2.medianBlur(bg, 11)
    bg = cv2.resize(bg, (w, h), interpolation=cv2.INTER_LINEAR)
    bg = np.maximum(bg, 1)
    out = cv2.divide(gray, bg, scale=255)
    return out


def estimate_skew(gray: np.ndarray, max_angle: float = 3.0) -> float:
    """Skew angle in degrees (positive = counter-clockwise rotation fixes it), projection profile."""
    h, w = gray.shape
    s = 800.0 / max(h, w)
    small = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else gray
    bw = cv2.threshold(small, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    if bw.mean() < 2 or bw.mean() > 120:
        return 0.0
    hh, ww = bw.shape

    def score(a: float) -> float:
        m = cv2.getRotationMatrix2D((ww / 2, hh / 2), a, 1.0)
        r = cv2.warpAffine(bw, m, (ww, hh), flags=cv2.INTER_NEAREST)
        prof = r.sum(1, dtype=np.float64)
        return float(np.sum(np.diff(prof) ** 2))

    coarse = np.arange(-max_angle, max_angle + 1e-6, 0.5)
    sc = [score(a) for a in coarse]
    best = float(coarse[int(np.argmax(sc))])
    if abs(best) >= max_angle:
        return 0.0
    fine = np.arange(best - 0.5, best + 0.5 + 1e-6, 0.1)
    best = float(fine[int(np.argmax([score(a) for a in fine]))])
    base = score(0.0)
    if abs(best) < 0.15 or score(best) < base * 1.03:
        return 0.0
    return best


def rotate_image(img: np.ndarray, angle: float, border=255) -> np.ndarray:
    h, w = img.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
                          borderValue=(border,) * 3 if img.ndim == 3 else border)


def _merge_positions(vals: list, min_gap: float) -> list:
    out: list = []
    for v in sorted(vals):
        if out and v - out[-1][-1] < min_gap:
            out[-1].append(v)
        else:
            out.append([v])
    return [float(np.mean(g)) for g in out]


def detect_tables(gray: np.ndarray, dpi: float) -> tuple:
    """Find ruled tables. Returns (list[TableGrid], line_mask) where line_mask marks the ruling
    pixels inside the tables (to be erased before OCR). Needs an upright, de-skewed image.

    Horizontal rules of equal extent (+-3%) that follow each other form the rows; vertical rules
    that span (most of) the rows form the columns. Picture edges, underlines and single boxes
    do not meet that and are ignored.
    """
    # fixed threshold: hairline rules (0.5 pt) render as light grey and fall below Otsu's cut
    inv = (gray < 190).astype(np.uint8) * 255
    lh = max(30, int(dpi * 0.35))
    lv = max(20, int(dpi * 0.2))
    # bridge 1-2 px breaks along the line direction (scan noise) before the long-kernel opening
    hbridge = cv2.morphologyEx(inv, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 1)))
    vbridge = cv2.morphologyEx(inv, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5)))
    hmask = cv2.morphologyEx(hbridge, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (lh, 1)))
    vmask = cv2.morphologyEx(vbridge, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, lv)))
    # rules are thin: remove filled areas (pictures, dark blocks) that survive the long-kernel opening
    t = max(7, int(dpi * 0.04))
    thick_h = cv2.morphologyEx(hmask, cv2.MORPH_OPEN, np.ones((t, 1), np.uint8))
    thick_v = cv2.morphologyEx(vmask, cv2.MORPH_OPEN, np.ones((1, t), np.uint8))
    hmask = cv2.bitwise_and(hmask, cv2.bitwise_not(thick_h))
    vmask = cv2.bitwise_and(vmask, cv2.bitwise_not(thick_v))
    min_cell = max(10, int(dpi * 0.08))
    n, _l, hs, _c = cv2.connectedComponentsWithStats(hmask, connectivity=8)
    hsegs = [(int(x), int(x + w), y + h / 2.0) for x, y, w, h, _a in hs[1:] if w >= lh and h <= max(8, dpi * 0.04)]
    n, _l, vs, _c = cv2.connectedComponentsWithStats(vmask, connectivity=8)
    vsegs = [(x + w / 2.0, int(y), int(y + h)) for x, y, w, h, _a in vs[1:] if h >= lv and w <= max(8, dpi * 0.04)]
    hsegs.sort(key=lambda t: t[2])
    clusters: list = []
    for seg in hsegs:
        placed = False
        for c in clusters:
            tol = 0.03 * (c["x1"] - c["x0"]) + 4
            if abs(seg[0] - c["x0"]) <= tol and abs(seg[1] - c["x1"]) <= tol and seg[2] - c["segs"][-1][2] <= dpi * 1.6:
                c["segs"].append(seg)
                placed = True
                break
        if not placed:
            clusters.append({"x0": seg[0], "x1": seg[1], "segs": [seg]})
    grids: list = []
    line_mask = np.zeros_like(gray)
    for c in clusters:
        ys = _merge_positions([sg[2] for sg in c["segs"]], min_cell)
        if len(ys) < 2:
            continue
        ytop, ybot = ys[0], ys[-1]
        span = ybot - ytop
        xs_raw = [v[0] for v in vsegs
                  if c["x0"] - 4 <= v[0] <= c["x1"] + 4 and min(v[2], ybot + 3) - max(v[1], ytop - 3) >= 0.6 * span]
        xs = _merge_positions(xs_raw, min_cell)
        ncell = (len(ys) - 1) * (len(xs) - 1)
        if len(xs) < 2 or ncell < 2 or ncell > 600:
            continue
        g = TableGrid(int(xs[0]), int(ytop), int(xs[-1]), int(ybot), xs, ys)
        if g.x1 - g.x0 < dpi * 0.6 or g.y1 - g.y0 < dpi * 0.25:
            continue
        if (inv[g.y0:g.y1, g.x0:g.x1] > 0).mean() > 0.4:      # dark / photo texture, not a ruled table
            continue
        grids.append(g)
        region = (hmask | vmask)[max(g.y0 - 3, 0):g.y1 + 4, max(g.x0 - 3, 0):g.x1 + 4]
        line_mask[max(g.y0 - 3, 0):g.y1 + 4, max(g.x0 - 3, 0):g.x1 + 4] |= region
    if grids:
        line_mask = cv2.dilate(line_mask, np.ones((3, 3), np.uint8))
    grids.sort(key=lambda g: (g.y0, g.x0))
    return grids, line_mask


def find_picture_regions(gray: np.ndarray, boxes: list, dpi: float) -> list:
    """Fallback picture finder: dark/non-white areas not explained by words or table rules.
    ``boxes`` = [(x0, y0, x1, y1)] of words/tables to ignore. Returns list[Picture]."""
    h, w = gray.shape
    s = 0.5
    small = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    ink = (cv2.GaussianBlur(small, (3, 3), 0) < 205).astype(np.uint8) * 255
    for (x0, y0, x1, y1) in boxes:
        pad = 3
        ink[max(int(y0 * s) - pad, 0):int(y1 * s) + pad + 1, max(int(x0 * s) - pad, 0):int(x1 * s) + pad + 1] = 0
    grow = max(3, int(dpi * s * 0.08))
    blob = cv2.dilate(ink, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow, grow)))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(blob, connectivity=8)
    pics = []
    min_dim = dpi * 0.4 * s
    for i in range(1, n):
        x, y, bw, bh, _a = stats[i]
        if bw < min_dim or bh < min_dim:
            continue
        sub = ink[y:y + bh, x:x + bw] > 0
        fill = float(sub.mean())
        iy0, iy1 = int(bh * 0.12), max(int(bh * 0.88), int(bh * 0.12) + 1)
        ix0, ix1 = int(bw * 0.12), max(int(bw * 0.88), int(bw * 0.12) + 1)
        inner = float((sub[iy0:iy1, ix0:ix1]).mean())
        if inner < 0.03 or fill < 0.02:     # empty frames / rules / specks
            continue
        bx0, by0, bx1, by1 = x / s, y / s, (x + bw) / s, (y + bh) / s
        inside_words = sum(1 for (a0, b0, a1, b1) in boxes if bx0 <= (a0 + a1) / 2 <= bx1 and by0 <= (b0 + b1) / 2 <= by1)
        if inside_words >= 3:               # text with rules around it (table / form), not a picture
            continue
        pics.append(Picture(x / s, y / s, (x + bw) / s, (y + bh) / s, fill))
    return pics


def merge_pictures(pics: list, gap: float) -> list:
    """Union picture boxes that overlap or lie within ``gap`` px of each other (a photo whose
    texture was cut up by OCR word boxes comes back as one picture)."""
    boxes = [Picture(p.x0, p.y0, p.x1, p.y1, p.fill) for p in pics]
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a.x0 - gap <= b.x1 and b.x0 - gap <= a.x1 and a.y0 - gap <= b.y1 and b.y0 - gap <= a.y1:
                    wa = (a.x1 - a.x0) * (a.y1 - a.y0)
                    wb = (b.x1 - b.x0) * (b.y1 - b.y0)
                    fill = (a.fill * wa + b.fill * wb) / max(wa + wb, 1)
                    boxes[i] = Picture(min(a.x0, b.x0), min(a.y0, b.y0), max(a.x1, b.x1), max(a.y1, b.y1), fill)
                    del boxes[j]
                    changed = True
                    break
            if changed:
                break
    return boxes


def word_stroke_ratio(gray_crop: np.ndarray, em_px: float, thr: Optional[int] = None) -> Optional[float]:
    """Mean stroke width / em for a word crop (2*area/perimeter of the binarised ink)."""
    if gray_crop.size == 0 or em_px <= 0 or min(gray_crop.shape) < 4:
        return None
    if thr is None:
        thr = int(cv2.threshold(gray_crop, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[0])
    ink = (gray_crop < thr).astype(np.uint8)
    area = int(ink.sum())
    if area < 20:
        return None
    er = cv2.erode(ink, cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3)))
    perim = int(ink.sum() - er.sum())
    if perim <= 0:
        return None
    return (2.0 * area / perim) / em_px


# ------------------------------------------------------------------- hOCR / Tesseract


def _tess_cmd() -> str:
    try:
        import pytesseract
        cmd = pytesseract.pytesseract.tesseract_cmd
        if cmd and shutil.which(cmd):
            return cmd
    except Exception:  # pragma: no cover
        pass
    return shutil.which("tesseract") or "tesseract"


def _tess_env() -> dict:
    env = dict(os.environ)
    # One OpenMP thread per Tesseract process: on a shared host the default thread fan-out was
    # ~17x slower (measured: 16.7 s vs 0.95 s per page).
    env.setdefault("OMP_THREAD_LIMIT", "1")
    return env


_LANG_CACHE: Optional[set] = None


def installed_langs() -> set:
    global _LANG_CACHE
    if _LANG_CACHE is None:
        try:
            out = subprocess.run([_tess_cmd(), "--list-langs"], capture_output=True, text=True, timeout=20).stdout
            _LANG_CACHE = {l.strip() for l in out.splitlines()[1:] if l.strip()}
        except Exception:
            _LANG_CACHE = set()
    return _LANG_CACHE


def resolve_lang(lang: str) -> str:
    have = installed_langs()
    parts = [p for p in (lang or "eng").split("+") if p]
    if have:
        parts = [p for p in parts if p in have]
    return "+".join(parts) if parts else "eng"


def run_tesseract_hocr(gray: np.ndarray, lang: str, dpi: int = 200, psm: int = 3, timeout: int = 180) -> str:
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        cv2.imwrite(path, gray, [cv2.IMWRITE_PNG_COMPRESSION, 1])
        cmd = [_tess_cmd(), path, "stdout", "-l", lang, "--psm", str(psm), "--dpi", "72",
               "-c", "hocr_font_info=1", "hocr"]
        res = subprocess.run(cmd, capture_output=True, env=_tess_env(), timeout=timeout)
        if res.returncode != 0 and not res.stdout:
            raise ProcessingError(f"Tesseract failed: {res.stderr.decode('utf-8', 'ignore')[:300]}")
        return res.stdout.decode("utf-8", "ignore")
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def run_osd(gray: np.ndarray, timeout: int = 60) -> int:
    """Clockwise rotation (0/90/180/270) Tesseract OSD wants applied to fix the page; 0 if unsure."""
    s = 1000.0 / max(gray.shape)
    small = cv2.resize(gray, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else gray
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        cv2.imwrite(path, small, [cv2.IMWRITE_PNG_COMPRESSION, 1])
        res = subprocess.run([_tess_cmd(), path, "stdout", "--psm", "0", "-l", "osd", "--dpi", "150"],
                             capture_output=True, text=True, env=_tess_env(), timeout=timeout)
        rot = re.search(r"Rotate:\s*(\d+)", res.stdout)
        conf = re.search(r"Orientation confidence:\s*([\d.]+)", res.stdout)
        if rot and conf and float(conf.group(1)) >= 2.0:
            return int(rot.group(1)) % 360
    except Exception:
        pass
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
    return 0


_BBOX_RE = re.compile(r"bbox (-?\d+) (-?\d+) (-?\d+) (-?\d+)")


def parse_hocr(hocr: str, dpi: float) -> tuple:
    """Parse Tesseract hOCR -> (lines: list[Line], photos: list[Picture])."""
    if not hocr.strip():
        return [], []
    try:
        root = ET.fromstring(hocr.encode("utf-8"))
    except ET.ParseError:
        return [], []
    lines: list = []
    photos: list = []
    cur_block = cur_par = ""
    cur: Optional[Line] = None
    for el in root.iter():
        tag = el.tag.rsplit("}", 1)[-1]
        cls = el.get("class") or ""
        title = el.get("title") or ""
        if tag == "div" and cls == "ocr_carea":
            cur_block = el.get("id") or ""
        elif tag == "div" and cls == "ocr_photo":
            m = _BBOX_RE.search(title)
            if m:
                x0, y0, x1, y1 = map(int, m.groups())
                photos.append(Picture(x0, y0, x1, y1, 1.0))
        elif tag == "p" and cls == "ocr_par":
            cur_par = el.get("id") or ""
        elif tag == "span" and cls in _LINE_CLASSES:
            m = _BBOX_RE.search(title)
            if not m:
                cur = None
                continue
            x0, y0, x1, y1 = map(int, m.groups())
            base = float(y1)
            bm = re.search(r"baseline (-?[\d.]+) (-?[\d.]+)", title)
            if bm:
                base = y1 + float(bm.group(2))
            cur = Line([], x0, y0, x1, y1, base, cur_par, cur_block, dpi=dpi)
            tm_ = re.search(r"textangle (-?\d+)", title)
            if tm_:
                cur.textangle = int(float(tm_.group(1))) % 360
            lines.append(cur)
        elif tag == "span" and cls == "ocrx_word" and cur is not None:
            m = _BBOX_RE.search(title)
            if not m:
                continue
            text = "".join(el.itertext()).strip()
            if not text:
                continue
            x0, y0, x1, y1 = map(int, m.groups())
            cm = re.search(r"x_wconf (-?\d+)", title)
            fm = re.search(r"x_fsize (\d+(?:\.\d+)?)", title)
            w = Word(text, x0, y0, x1, y1, float(cm.group(1)) if cm else 90.0, float(fm.group(1)) if fm else 0.0)
            if any(c.tag.rsplit("}", 1)[-1] == "strong" for c in el):
                w.bold = True
            cur.words.append(w)
    out = []
    for ln in lines:
        if ln.words:
            ln.words = [w for w in ln.words if not (w.conf < 25 and len(w.text) <= 2 and not w.text.isdigit())]
        if not ln.words:
            continue
        ln.x0 = min(w.x0 for w in ln.words)
        ln.x1 = max(w.x1 for w in ln.words)
        ln.y0 = min(w.y0 for w in ln.words)
        ln.y1 = max(w.y1 for w in ln.words)
        ln.size_pt = est_line_size_pt(ln.words, dpi)
        out.append(ln)
    return out, photos


# --------------------------------------------------------------------- page layout model


@dataclass
class ParaItem:
    runs: list                       # [(text, bold)]
    align: str = "left"
    size_pt: float = 11.0
    heading: int = 0                 # 0 = body, 1..3 heading level
    list_kind: str = ""              # '', 'bullet', 'number'
    space_before: float = 0.0
    line_pitch: float = 0.0          # exact line spacing in pt (0 = automatic)
    left_indent: float = 0.0
    first_indent: float = 0.0
    tabs: list = field(default_factory=list)   # [(pos_pt, 'left'|'right')]
    rtl: bool = False
    top: float = 0.0                 # pt, for spacing calculations
    bottom: float = 0.0
    col: int = 0
    y0px: float = 0.0
    x0px: float = 0.0
    keep_bold_all: bool = False


@dataclass
class TableItem:
    rows: list                       # [[cell_text]]
    col_widths: list                 # pt
    row_heights: list                # pt
    aligns: list                     # [[align]]
    bold: list                       # [[bool]]
    size_pt: float = 11.0
    left_indent: float = 0.0
    space_before: float = 0.0
    top: float = 0.0
    bottom: float = 0.0
    col: int = 0
    y0px: float = 0.0
    x0px: float = 0.0


@dataclass
class PictureItem:
    data: bytes
    width_pt: float
    height_pt: float
    align: str = "left"
    space_before: float = 0.0
    top: float = 0.0
    bottom: float = 0.0
    col: int = 0
    y0px: float = 0.0
    x0px: float = 0.0
    left_indent: float = 0.0


@dataclass
class PageLayout:
    width_pt: float
    height_pt: float
    margins: tuple = (72.0, 72.0, 72.0, 72.0)    # left, top, right, bottom (pt)
    bands: list = field(default_factory=list)   # [(col_specs, [items])]; col_specs [(width_pt, space_pt)]
    serif: Optional[bool] = None
    rotated: int = 0
    deskew: float = 0.0
    notes: list = field(default_factory=list)


def _has_rtl(text: str) -> bool:
    n = r = 0
    for ch in text:
        if ch.isalpha():
            n += 1
            if unicodedata.bidirectional(ch) in ("R", "AL"):
                r += 1
    return n > 0 and r / n > 0.5


def estimate_serif(gray: np.ndarray, lines: list) -> Optional[bool]:
    """Serif vs sans-serif from vertical stems ('l', 'I', '1', 'i'-like components): serif faces
    flare at the foot of a stem. Returns None when there is not enough evidence."""
    ratios = []
    for ln in lines[:60]:
        if ln.size_pt < 8 or len(ln.words) < 2:
            continue
        pad = 2
        crop = gray[max(int(ln.y0) - pad, 0):int(ln.y1) + pad, max(int(ln.x0) - pad, 0):int(ln.x1) + pad]
        if crop.size == 0:
            continue
        thr = int(cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[0])
        ink = (crop < thr).astype(np.uint8)
        n, lab, stats, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
        em = ln.em_px
        for i in range(1, n):
            x, y, w, h, a = stats[i]
            if h < 0.55 * em or h > 1.0 * em or w > 0.42 * h or w < 0.1 * h:
                continue
            comp = (lab[y:y + h, x:x + w] == i)
            k = max(2, int(h * 0.12))
            mid = comp[int(h * 0.4):int(h * 0.6)].any(1).sum()
            if mid == 0:
                continue
            mid_w = np.median(comp[int(h * 0.35):int(h * 0.65)].sum(1))
            foot_w = comp[h - k:].sum(1).max()
            if mid_w < 1.5:
                continue
            ratios.append(foot_w / mid_w)
    if len(ratios) < 12:
        return None
    med = float(np.median(ratios))
    if med >= 1.95:
        return True
    if med <= 1.75:
        return False
    return None


# ----------------------------------------------------------------- analysis of one page


class _PageAnalyzer:
    def __init__(self, lang: str, quality: str, dpi: int):
        self.lang = lang
        self.quality = quality
        self.dpi = dpi
        self.rtl_lang = bool(RTL_LANGS & set(lang.split("+")[:1]))

    # -- stage 1: pixels --------------------------------------------------------
    def prepare(self, rgb: np.ndarray, rotate_cw: int = 0) -> tuple:
        if rotate_cw:
            code = {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}[rotate_cw]
            rgb = cv2.rotate(rgb, code)
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        ang = estimate_skew(gray)
        if ang:
            rgb = rotate_image(rgb, ang, 255)
            gray = rotate_image(gray, ang, 255)
        if self.quality != "draft":
            gray_n = normalize_background(gray)
        else:
            gray_n = gray
        return rgb, gray, gray_n, ang

    # -- stage 2: analysis ------------------------------------------------------
    def analyze(self, rgb: np.ndarray, rotate_cw: int = 0) -> tuple:
        rgb, gray, gray_n, ang = self.prepare(rgb, rotate_cw)
        h, w = gray.shape
        grids, line_mask = detect_tables(gray_n, self.dpi)
        ocr_img = gray_n
        if grids:
            ocr_img = gray_n.copy()
            ocr_img[line_mask > 0] = 255
        hocr = run_tesseract_hocr(ocr_img, self.lang, self.dpi)
        lines, photos = parse_hocr(hocr, self.dpi)
        return rgb, gray, gray_n, ang, grids, lines, photos

    # -- stage 3: layout --------------------------------------------------------
    def build(self, rgb, gray, gray_n, ang, grids, lines, photos, page_w_pt: float, page_h_pt: float) -> PageLayout:
        dpi = self.dpi
        h, w = gray.shape
        px2pt = 72.0 / dpi
        layout = PageLayout(page_w_pt, page_h_pt, deskew=ang)

        # pictures: tesseract photo blocks + fallback
        pics = [p for p in photos if (p.x1 - p.x0) > dpi * 0.3 and (p.y1 - p.y0) > dpi * 0.3]
        word_boxes = [(wd.x0, wd.y0, wd.x1, wd.y1) for ln in lines for wd in ln.words if wd.conf >= 60]   # garbage words on textures must not cut a picture up
        tbl_boxes = [(g.x0, g.y0, g.x1, g.y1) for g in grids]
        extra = find_picture_regions(gray_n, word_boxes + tbl_boxes + [(p.x0, p.y0, p.x1, p.y1) for p in pics], dpi)
        for e in extra:
            if not any(_overlap_frac(e, p) > 0.3 for p in pics):
                pics.append(e)
        pics = merge_pictures(pics, dpi * 0.15)
        # drop words that sit inside a picture (OCR noise on photo texture) and inside tables
        def inside(wd, box, margin=0):
            cx, cy = (wd.x0 + wd.x1) / 2, (wd.y0 + wd.y1) / 2
            return box[0] - margin <= cx <= box[2] + margin and box[1] - margin <= cy <= box[3] + margin

        kept_lines: list = []
        table_words: list = [[] for _ in grids]
        for ln in lines:
            rest = []
            for wd in ln.words:
                gi = next((i for i, g in enumerate(grids) if inside(wd, (g.x0, g.y0, g.x1, g.y1), 2)), None)
                if gi is not None:
                    table_words[gi].append(wd)
                    continue
                if any(inside(wd, (p.x0, p.y0, p.x1, p.y1)) and wd.conf < 85 for p in pics):
                    continue
                rest.append(wd)
            if rest:
                if len(rest) != len(ln.words):
                    ln.words = rest
                    ln.x0, ln.x1 = min(x.x0 for x in rest), max(x.x1 for x in rest)
                    ln.y0, ln.y1 = min(x.y0 for x in rest), max(x.y1 for x in rest)
                    ln.size_pt = est_line_size_pt(rest, dpi)
                kept_lines.append(ln)
        lines = kept_lines

        # bold per word (stroke width)
        if USE_BOLD and (lines or grids):
            groups = [ln.words for ln in lines]
            for tw in table_words:                        # table rows count as lines
                rows_: dict = {}
                for wd in tw:
                    rows_.setdefault(int(round((wd.y0 + wd.y1) / 2 / 20.0)), []).append(wd)
                groups.extend(rows_.values())
            self._mark_bold(gray_n, groups)

        # font sizes
        if lines:
            body, snapped = snap_sizes_to_body([l.size_pt for l in lines], [len(l.text) for l in lines])
            for l, s in zip(lines, snapped):
                l.size_pt = s
        else:
            body = 11.0

        # tab segments
        for ln in lines:
            if len(split_tab_segments(ln.words, ln.em_px)) > 1:
                ln.tabbed = True

        # columns
        cols = find_columns(lines, w) if lines else [(0, w)]
        lines = split_lines_at_gutters(lines, cols)
        ncols = len(cols)
        if ncols == 1:
            lines = merge_same_row_lines(lines)
            for ln in lines:
                ln.tabbed = len(split_tab_segments(ln.words, ln.em_px)) > 1
        items: list = list(lines)
        # tables / pictures participate in ordering
        table_objs = []
        for g, tw in zip(grids, table_words):
            ti = _GridObj(g.x0, g.y0, g.x1, g.y1, g, tw)
            table_objs.append(ti)
        pic_objs = [_PicObj(p.x0, p.y0, p.x1, p.y1, p) for p in pics]
        assign_columns(items + table_objs + pic_objs, cols)
        ordered = order_items(items + table_objs + pic_objs, ncols)

        # page extents -> margins
        if ordered:
            left_px = min(o.x0 for o in ordered)
            right_px = max(o.x1 for o in ordered)
            top_px = min(o.y0 for o in ordered)
            bot_px = max(o.y1 for o in ordered)
        else:
            left_px, right_px, top_px, bot_px = 72 * dpi / 72, w - dpi, dpi, h - dpi
        lm = min(max(left_px * px2pt, 18.0), page_w_pt * 0.4)
        rm = min(max(page_w_pt - right_px * px2pt, 18.0), page_w_pt * 0.4)
        tm = min(max(top_px * px2pt - 2, 18.0), page_h_pt * 0.4)
        # slack below the last line: sections start on a new page, so extra room can never reflow
        # text, but a rounding error in line/row heights would otherwise push a line to a new page
        bm = min(max(page_h_pt - bot_px * px2pt - 30.0, 36.0), page_h_pt * 0.4)
        layout.margins = (lm, tm, rm, bm)

        # the page-wide pitch ratio and justification prior
        pitch_ratio = estimate_line_pitch_ratio([o for o in ordered if isinstance(o, Line)])

        built: list = []
        run: list = []

        def flush_run():
            if not run:
                return
            for para_lines in split_paragraphs(run, cols, pitch_ratio):
                built.append(self._para_item(para_lines, cols, body))
            run.clear()

        for o in ordered:
            if isinstance(o, Line):
                if run and (run[-1].col != o.col):
                    flush_run()
                run.append(o)
            else:
                flush_run()
                if isinstance(o, _GridObj):
                    built.append(self._table_item(o, gray_n, cols))
                else:
                    built.append(self._picture_item(o, rgb, cols))
        flush_run()
        self._justify_pass(built)
        # at 150 dpi the stem flare is too blurred: serif fonts were classified as sans in testing
        layout.serif = estimate_serif(gray_n, [l for l in lines if l.size_pt <= body * 1.1]) \
            if lines and dpi >= 200 else None

        # bands (full width vs column groups)
        bands: list = []
        cur_key = None
        for it in built:
            multi = ncols > 1 and it.col != -1
            key = multi
            if key != cur_key or not bands:
                bands.append([multi, []])
                cur_key = key
            bands[-1][1].append(it)
        col_specs = []
        for i, (a, b) in enumerate(cols):
            nxt = cols[i + 1][0] if i + 1 < len(cols) else b
            col_specs.append(((b - a) * px2pt, max((nxt - b) * px2pt, 0) if i + 1 < len(cols) else 0))
        layout.bands = [(col_specs if m else [], its) for m, its in bands]
        self._spacing(layout, left_px)
        return layout

    # -- helpers ----------------------------------------------------------------
    def _mark_bold(self, gray: np.ndarray, groups: list) -> None:
        """groups = [list[Word]] (one per text line / table row). Marks ``Word.bold`` from the
        stroke-width / em ratio compared to the page median (body text dominates every page)."""
        per_word = []
        fs_all = [w.fsize for g in groups for w in g if w.fsize > 0]
        if len(fs_all) < 15:
            return
        med_fs = float(np.median(fs_all))
        for g in groups:
            g = [w for w in g if w.fsize > 0]
            if not g:
                continue
            pad = 2
            x0, y0 = max(int(min(w.x0 for w in g)) - pad, 0), max(int(min(w.y0 for w in g)) - pad, 0)
            x1, y1 = int(max(w.x1 for w in g)) + pad, int(max(w.y1 for w in g)) + pad
            crop = gray[y0:y1, x0:x1]
            if crop.size == 0:
                continue
            thr = int(cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[0])
            for wd in g:
                if len(wd.text) < 2 or wd.fsize / FSIZE_TO_EM < 12:
                    continue
                wc = gray[max(int(wd.y0) - 1, 0):int(wd.y1) + 1, max(int(wd.x0) - 1, 0):int(wd.x1) + 1]
                r = word_stroke_ratio(wc, wd.fsize / FSIZE_TO_EM, thr)
                if r is not None:
                    per_word.append((wd, r))
        if len(per_word) < 15:
            return
        ref = float(np.median([r for _, r in per_word]))
        for wd, r in per_word:
            big = wd.fsize > 1.15 * med_fs
            if wd.bold is None:
                wd.bold = r > ref * (1.2 if big else BOLD_RATIO)
        for g in groups:                                  # a lone short "bold" word is noise
            for i, wd in enumerate(g):
                if wd.bold is None:                       # unmeasured (short) word: follow its neighbours
                    wd.bold = bool(0 < i < len(g) - 1 and g[i - 1].bold and g[i + 1].bold)
                if wd.bold and len(wd.text) < 4:
                    nb = [g[j].bold for j in (i - 1, i + 1) if 0 <= j < len(g)]
                    if not any(nb):
                        wd.bold = False

    def _para_item(self, lines: list, cols: list, body: float) -> ParaItem:
        dpi = self.dpi
        px2pt = 72.0 / dpi
        first = lines[0]
        ci = first.col if first.col >= 0 else 0
        cl, cr = cols[ci] if first.col >= 0 else (min(c[0] for c in cols), max(c[1] for c in cols))
        # robust column extents from the page's cols (already text-derived)
        size = statistics.median([l.size_pt for l in lines])
        marker = detect_marker(first, cl)
        item = ParaItem([], size_pt=size, col=first.col, y0px=first.y0, x0px=first.x0)
        ext = [(l.x0, l.x1) for l in lines]
        text_left = marker[2] if marker else min(l.x0 for l in (lines[1:] or lines))
        if first.tabbed:
            segs = split_tab_segments(first.words, first.em_px)
            item.runs = []
            for si, seg in enumerate(segs):
                if si:
                    item.runs.append(("\t", False))
                item.runs.extend(_word_runs(seg))
            for si, seg in enumerate(segs[1:], 1):
                last = si == len(segs) - 1
                if last and (cr - seg[-1].x1) < 0.04 * (cr - cl) and (seg[0].x0 - segs[si - 1][-1].x1) > 4 * first.em_px:
                    item.tabs.append(((seg[-1].x1 - cl) * px2pt, "right"))
                else:
                    item.tabs.append(((seg[0].x0 - cl) * px2pt, "left"))
            item.align = "left"
            item.left_indent = 0.0
            if first.x0 - cl > 0.5 * first.em_px:
                # leading indentation before the first segment
                item.runs.insert(0, ("\t", False))
                item.tabs.insert(0, ((first.x0 - cl) * px2pt, "left"))
        else:
            words_lines = [l.words for l in lines]
            if marker:
                words_lines = [lines[0].words[1:]] + [l.words for l in lines[1:]]
            item.runs = _merge_line_runs(words_lines)
            if marker:
                item.list_kind = marker[0]
                if marker[0] == "number":
                    item.runs.insert(0, (marker[1] + "\t", False))
            item.align = "left"
            if marker:
                item.left_indent = max(0.0, (text_left - cl) * px2pt)
                mk_left = (first.x0 - cl) * px2pt
                item.first_indent = -(item.left_indent - max(mk_left, 0.0))
                if marker[0] == "number":
                    item.tabs.append((item.left_indent, "left"))
            else:
                item.align = infer_alignment(ext, cl, cr)
                cont = min(l.x0 for l in (lines[1:] or lines))
                if item.align in ("left", "justify"):
                    item.left_indent = max(0.0, (cont - cl) * px2pt) if (cont - cl) * px2pt > 6 else 0.0
                    if len(lines) > 1:
                        fi = (lines[0].x0 - cont) * px2pt
                        if abs(fi) > 0.7 * size:
                            item.first_indent = fi
                    elif lines[0].x0 - cl > 0.06 * (cr - cl):
                        item.left_indent = (lines[0].x0 - cl) * px2pt
                elif item.align == "right":
                    item.left_indent = 0.0
        # exact line pitch for multi-line paragraphs
        if len(lines) > 1:
            d = [(b.base - a.base) * px2pt for a, b in zip(lines, lines[1:])]
            item.line_pitch = max(statistics.median(d), size)
        base0, baseN = lines[0].base * px2pt, lines[-1].base * px2pt
        pitch = item.line_pitch or size * 1.2
        item.top = base0 - 0.8 * pitch
        item.bottom = baseN + 0.2 * pitch
        txt = "".join(t for t, _ in item.runs)
        item.rtl = self.rtl_lang or _has_rtl(txt)
        letters = [(len(w.text), bool(w.bold)) for l in lines for w in l.words]
        item.keep_bold_all = bool(letters) and sum(n for n, b in letters if b) >= 0.7 * sum(n for n, _ in letters)
        item._extents = ext            # type: ignore[attr-defined]
        item._col = (cl, cr)           # type: ignore[attr-defined]
        item._nlines = len(lines)      # type: ignore[attr-defined]
        item._marker = bool(marker)    # type: ignore[attr-defined]
        item._tabbed = first.tabbed    # type: ignore[attr-defined]
        return item

    def _justify_pass(self, items: list) -> None:
        paras = [i for i in items if isinstance(i, ParaItem) and getattr(i, "_nlines", 0) >= 3
                 and not i._marker and not i._tabbed]
        prior = False
        if len(paras) >= 2:
            prior = sum(1 for p in paras if p.align == "justify") / len(paras) >= 0.6
        for p in items:
            if isinstance(p, ParaItem) and not p._marker and not p._tabbed and p._nlines <= 2:
                p.align = infer_alignment(p._extents, p._col[0], p._col[1], justified_prior=prior)

    def _table_item(self, g: "_GridObj", gray: np.ndarray, cols: list) -> TableItem:
        px2pt = 72.0 / self.dpi
        grid = g.grid
        nr, nc = len(grid.ys) - 1, len(grid.xs) - 1
        cells = [[[] for _ in range(nc)] for _ in range(nr)]
        for wd in g.words:
            cx, cy = (wd.x0 + wd.x1) / 2, (wd.y0 + wd.y1) / 2
            ci = max(0, min(nc - 1, int(np.searchsorted(grid.xs, cx) - 1)))
            ri = max(0, min(nr - 1, int(np.searchsorted(grid.ys, cy) - 1)))
            cells[ri][ci].append(wd)
        rows, aligns, bolds = [], [], []
        sizes = [wd.fsize for wd in g.words if wd.fsize > 0]
        size = snap_size(statistics.median(sizes) * 72.0 / self.dpi / FSIZE_TO_EM) if sizes else 11.0
        for ri in range(nr):
            r_t, r_a, r_b = [], [], []
            for ci in range(nc):
                ws = sorted(cells[ri][ci], key=lambda x: ((x.y0 + x.y1) / 2, x.x0))
                # group into visual lines
                lines_: list = []
                for wd in ws:
                    hh = wd.y1 - wd.y0
                    if lines_ and abs((wd.y0 + wd.y1) / 2 - lines_[-1][0]) < 0.6 * hh:
                        lines_[-1][1].append(wd)
                    else:
                        lines_.append([(wd.y0 + wd.y1) / 2, [wd]])
                txt = ""
                for _, lw in lines_:
                    lw.sort(key=lambda x: x.x0)
                    txt = dehyphenate_join(txt, join_words([x.text for x in lw])) if txt else join_words([x.text for x in lw])
                r_t.append(txt)
                x0c, x1c = grid.xs[ci], grid.xs[ci + 1]
                if ws:
                    tx0, tx1 = min(x.x0 for x in ws), max(x.x1 for x in ws)
                    lg, rg = tx0 - x0c, x1c - tx1
                    cw = x1c - x0c
                    if abs(lg - rg) < 0.12 * cw and lg > 0.12 * cw:
                        al = "center"
                    elif rg < lg * 0.5 and rg < 0.15 * cw and lg > 0.2 * cw:
                        al = "right"
                    else:
                        al = "left"
                    allb = all(x.bold for x in ws)
                else:
                    al, allb = "left", False
                r_a.append(al)
                r_b.append(bool(allb))
            rows.append(r_t)
            aligns.append(r_a)
            bolds.append(r_b)
        cl = cols[g.col][0] if g.col >= 0 else min(c[0] for c in cols)
        t = TableItem(rows, [(grid.xs[i + 1] - grid.xs[i]) * px2pt for i in range(nc)],
                      [(grid.ys[i + 1] - grid.ys[i]) * px2pt for i in range(nr)], aligns, bolds, size,
                      left_indent=max(0.0, (grid.x0 - cl) * px2pt), top=grid.y0 * px2pt, bottom=grid.y1 * px2pt,
                      col=g.col, y0px=g.y0, x0px=g.x0)
        return t

    def _picture_item(self, o: "_PicObj", rgb: np.ndarray, cols: list) -> PictureItem:
        h, w = rgb.shape[:2]
        x0, y0, x1, y1 = max(int(o.x0), 0), max(int(o.y0), 0), min(int(o.x1), w), min(int(o.y1), h)
        crop = rgb[y0:y1, x0:x1]
        ok = False
        data = b""
        if crop.size:
            if o.pic.fill >= 0.6:
                ok, buf = cv2.imencode(".jpg", cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
            else:
                ok, buf = cv2.imencode(".png", cv2.cvtColor(crop, cv2.COLOR_RGB2BGR))
            data = buf.tobytes() if ok else b""
        px2pt = 72.0 / self.dpi
        cl, cr = cols[o.col] if o.col >= 0 else (min(c[0] for c in cols), max(c[1] for c in cols))
        cx = (o.x0 + o.x1) / 2
        colc = (cl + cr) / 2
        if abs(cx - colc) < 0.04 * (cr - cl) and (o.x0 - cl) > 0.05 * (cr - cl):
            al = "center"
        elif (cr - o.x1) < 0.03 * (cr - cl) and (o.x0 - cl) > 0.2 * (cr - cl):
            al = "right"
        else:
            al = "left"
        pi = PictureItem(data, (x1 - x0) * px2pt, (y1 - y0) * px2pt, al, 0.0, o.y0 * px2pt, o.y1 * px2pt,
                         o.col, o.y0, o.x0, left_indent=max(0.0, (o.x0 - cl) * px2pt) if al == "left" else 0.0)
        if not data:
            pi.width_pt = pi.height_pt = 0
        return pi

    def _spacing(self, layout: PageLayout, left_px: float) -> None:
        lm, tm, rm, bm = layout.margins
        prev_bottom: Optional[float] = None
        for cols, items in layout.bands:
            band_top = min((i.top for i in items), default=tm)
            prev_col = None
            for it in items:
                if prev_bottom is None:
                    it.space_before = 0.0
                elif cols and it.col != prev_col and prev_col is not None:
                    it.space_before = max(0.0, it.top - band_top)
                else:
                    it.space_before = max(0.0, it.top - prev_bottom)
                if layout.bands[0][1] and it is layout.bands[0][1][0]:
                    it.space_before = 0.0
                prev_bottom = it.bottom
                prev_col = it.col
            if cols and items:
                prev_bottom = max(i.bottom for i in items)


@dataclass
class _GridObj:
    x0: float
    y0: float
    x1: float
    y1: float
    grid: TableGrid
    words: list
    col: int = 0


@dataclass
class _PicObj:
    x0: float
    y0: float
    x1: float
    y1: float
    pic: Picture
    col: int = 0


def _overlap_frac(a: Picture, b: Picture) -> float:
    iw = min(a.x1, b.x1) - max(a.x0, b.x0)
    ih = min(a.y1, b.y1) - max(a.y0, b.y0)
    if iw <= 0 or ih <= 0:
        return 0.0
    return iw * ih / max(min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0)), 1)


def _word_runs(words: list) -> list:
    runs: list = []
    for wd in words:
        b = bool(wd.bold)
        if runs and runs[-1][1] == b:
            runs[-1] = (join_words([runs[-1][0], wd.text]), b)
        else:
            if runs and not (is_cjk(runs[-1][0][-1:]) and is_cjk(wd.text[:1])):
                runs[-1] = (runs[-1][0] + " ", runs[-1][1])
            runs.append((wd.text, b))
    return runs


def _merge_line_runs(lines_words: list) -> list:
    """Runs for a whole paragraph: line texts joined with de-hyphenation, bold per word."""
    runs: list = []
    for words in lines_words:
        lr = _word_runs(words)
        if not lr:
            continue
        if not runs:
            runs = lr
            continue
        last_t, last_b = runs[-1]
        first_t, first_b = lr[0]
        if last_b == first_b:
            runs[-1] = (dehyphenate_join(last_t, first_t), last_b)
            runs.extend(lr[1:])
        else:
            if last_t.rstrip().endswith("-") and first_t[:1].islower() and last_t.rstrip()[-2:-1].isalpha():
                runs[-1] = (last_t.rstrip()[:-1], last_b)
            elif not (is_cjk(last_t[-1:]) and is_cjk(first_t[:1])) and not last_t.endswith(" "):
                runs[-1] = (last_t + " ", last_b)
            runs.extend(lr)
    return [(t, b) for t, b in runs if t]


# ------------------------------------------------------------------------ DOCX writer


def _set_fonts(rpr_owner, latin: str, east: str, cs: str) -> None:
    from docx.oxml.ns import qn
    rpr = rpr_owner
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        from docx.oxml import OxmlElement
        rf = OxmlElement("w:rFonts")
        rpr.insert(0, rf)
    rf.set(qn("w:ascii"), latin)
    rf.set(qn("w:hAnsi"), latin)
    rf.set(qn("w:eastAsia"), east)
    rf.set(qn("w:cs"), cs)


def _set_cs_size(rpr, pt: float) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    for old in rpr.findall(qn("w:szCs")):
        rpr.remove(old)
    el = OxmlElement("w:szCs")
    el.set(qn("w:val"), str(int(round(pt * 2))))
    rpr.insert_element_before(el, "w:highlight", "w:u", "w:effect", "w:bdr", "w:shd", "w:fitText", "w:vertAlign",
                              "w:rtl", "w:cs", "w:em", "w:lang", "w:eastAsianLayout", "w:specVanish", "w:oMath")


def _set_lang(rpr, latin_tag: str, east_tag: str, bidi_tag: str) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    for old in rpr.findall(qn("w:lang")):
        rpr.remove(old)
    el = OxmlElement("w:lang")
    el.set(qn("w:val"), latin_tag)
    el.set(qn("w:eastAsia"), east_tag)
    el.set(qn("w:bidi"), bidi_tag)
    rpr.insert_element_before(el, "w:eastAsianLayout", "w:specVanish", "w:oMath")


class _DocxWriter:
    def __init__(self, lang: str):
        from docx import Document
        self.doc = Document()
        self.lang = lang
        parts = lang.split("+")
        self.primary = parts[0]
        self.first_section = True
        self.latin_tag = LANG_TAGS.get(parts[0], "en-US")
        self.east_tag = next((LANG_TAGS[p] for p in parts if p in CJK_FONTS), "zh-CN")
        self.bidi_tag = next((LANG_TAGS[p] for p in parts if p in RTL_LANGS and p in LANG_TAGS), "ar-SA")
        self.serif = True
        self.latin = "Times New Roman"
        self.east = "SimSun"
        self.cs = "Times New Roman"
        self.rtl_langs = bool(RTL_LANGS & set(parts))

    def set_fonts(self, serif: Optional[bool]) -> None:
        self.serif = False if serif is None else serif      # unsure -> Arial (what SimpleOCRConverter used)
        i = 0 if self.serif else 1
        self.latin = ("Times New Roman", "Arial")[i]
        parts = self.lang.split("+")
        self.east = next((CJK_FONTS[p][i] for p in parts if p in CJK_FONTS), "SimSun" if self.serif else "Microsoft YaHei")
        self.cs = next((CS_FONTS[p][i] for p in parts if p in CS_FONTS), self.latin)

    def setup_styles(self, body_pt: float) -> None:
        from docx.shared import Pt, RGBColor
        st = self.doc.styles["Normal"]
        st.font.name = self.latin
        st.font.size = Pt(body_pt)
        _set_fonts(st.element.get_or_add_rPr(), self.latin, self.east, self.cs)
        _set_lang(st.element.get_or_add_rPr(), self.latin_tag, self.east_tag, self.bidi_tag)
        st.paragraph_format.space_after = Pt(0)
        st.paragraph_format.space_before = Pt(0)
        for name in ("Heading 1", "Heading 2", "Heading 3", "List Bullet"):
            try:
                s = self.doc.styles[name]
            except KeyError:
                continue
            s.font.name = self.latin
            s.font.color.rgb = RGBColor(0, 0, 0)
            s.font.bold = False
            s.font.italic = False
            _set_fonts(s.element.get_or_add_rPr(), self.latin, self.east, self.cs)
            s.paragraph_format.space_before = Pt(0)
            s.paragraph_format.space_after = Pt(0)
            s.paragraph_format.keep_with_next = False

    # -- sections ---------------------------------------------------------------
    def section(self, layout: PageLayout, new_page: bool, col_specs: list):
        from docx.enum.section import WD_SECTION
        from docx.enum.section import WD_ORIENT
        from docx.shared import Pt
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn
        if self.first_section:
            sec = self.doc.sections[0]
            self.first_section = False
        else:
            sec = self.doc.add_section(WD_SECTION.NEW_PAGE if new_page else WD_SECTION.CONTINUOUS)
            self._shrink_break_paragraph()
        sec.orientation = WD_ORIENT.LANDSCAPE if layout.width_pt > layout.height_pt else WD_ORIENT.PORTRAIT
        sec.page_width, sec.page_height = Pt(layout.width_pt), Pt(layout.height_pt)
        lm, tm, rm, bm = layout.margins
        sec.left_margin, sec.top_margin, sec.right_margin, sec.bottom_margin = Pt(lm), Pt(tm), Pt(rm), Pt(bm)
        sec.header_distance = Pt(0)
        sec.footer_distance = Pt(0)
        sp = sec._sectPr
        cols = sp.find(qn("w:cols"))
        if cols is None:
            cols = OxmlElement("w:cols")
            sp.append(cols)
        for ch in list(cols):
            cols.remove(ch)
        for k in list(cols.attrib):
            del cols.attrib[k]
        if len(col_specs) > 1:
            cols.set(qn("w:num"), str(len(col_specs)))
            cols.set(qn("w:equalWidth"), "0")
            for w, sp_ in col_specs:
                c = OxmlElement("w:col")
                c.set(qn("w:w"), str(int(w * 20)))
                c.set(qn("w:space"), str(int(sp_ * 20)))
                cols.append(c)
        else:
            cols.set(qn("w:space"), "720")
        return sec

    def _shrink_break_paragraph(self) -> None:
        """python-docx puts the previous section's sectPr into an empty paragraph; make it ~1pt high
        so it cannot push content onto an extra page."""
        from docx.shared import Pt
        from docx.enum.text import WD_LINE_SPACING
        paras = self.doc.paragraphs
        for p in reversed(paras):
            if p._p.pPr is not None and p._p.pPr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sectPr") is not None:
                pf = p.paragraph_format
                pf.space_before = pf.space_after = Pt(0)
                pf.line_spacing_rule = WD_LINE_SPACING.EXACTLY
                pf.line_spacing = Pt(1)
                r = p.add_run("")
                r.font.size = Pt(1)
                break

    # -- items ------------------------------------------------------------------
    def _fmt_run(self, run, size: float, bold: bool, rtl: bool) -> None:
        from docx.shared import Pt, RGBColor
        run.font.name = self.latin
        run.font.size = Pt(size)
        run.font.bold = True if bold else None
        run.font.color.rgb = RGBColor(0, 0, 0)
        rpr = run._element.get_or_add_rPr()
        _set_fonts(rpr, self.latin, self.east, self.cs)
        if bold:
            run.font.cs_bold = True
        _set_cs_size(rpr, size)
        if rtl:
            run.font.rtl = True

    def _bidi(self, p, on: bool) -> None:
        from docx.oxml import OxmlElement
        if not on:
            return
        ppr = p._p.get_or_add_pPr()
        el = OxmlElement("w:bidi")
        ppr.insert_element_before(el, "w:adjustRightInd", "w:snapToGrid", "w:spacing", "w:ind",
                                  "w:contextualSpacing", "w:mirrorIndents", "w:suppressOverlap", "w:jc",
                                  "w:textDirection", "w:textAlignment", "w:textboxTightWrap", "w:outlineLvl",
                                  "w:divId", "w:cnfStyle", "w:rPr", "w:sectPr", "w:pPrChange")

    def add_para(self, it: ParaItem, col_break_before: bool = False):
        from docx.shared import Pt
        from docx.enum.text import WD_ALIGN_PARAGRAPH as A, WD_LINE_SPACING, WD_TAB_ALIGNMENT
        style = None
        if it.list_kind == "bullet":
            style = "List Bullet"
        elif it.heading:
            style = f"Heading {it.heading}"
        p = self.doc.add_paragraph(style=style)
        pf = p.paragraph_format
        pf.space_before = Pt(round(it.space_before, 1))
        pf.space_after = Pt(0)
        if it.line_pitch:
            pf.line_spacing_rule = WD_LINE_SPACING.EXACTLY
            pf.line_spacing = Pt(round(it.line_pitch, 1))
        pf.left_indent = Pt(round(it.left_indent, 1))
        if it.first_indent:
            pf.first_line_indent = Pt(round(it.first_indent, 1))
        for pos, al in it.tabs:
            pf.tab_stops.add_tab_stop(Pt(round(pos, 1)), WD_TAB_ALIGNMENT.RIGHT if al == "right" else WD_TAB_ALIGNMENT.LEFT)
        amap = {"left": A.LEFT, "center": A.CENTER, "right": A.RIGHT, "justify": A.JUSTIFY}
        al = it.align
        if it.rtl:
            self._bidi(p, True)
            # in a bidi paragraph Word/LibreOffice treat jc=left as "start" (visual right) and vice versa
            if al == "left":
                al = "right"
            elif al == "right":
                al = "left"
        if al != "left" or it.rtl:
            p.alignment = amap[al]
        bold_all = it.keep_bold_all and bool(it.heading)
        if it.heading and not USE_BOLD:
            bold_all = False
        merged: list = []
        for text, bold in it.runs:
            b = bool(bold or bold_all)
            if merged and merged[-1][1] == b and "\t" not in text and "\t" not in merged[-1][0]:
                merged[-1] = (merged[-1][0] + text, b)
            else:
                merged.append((text, b))
        for text, bold in merged:
            if not text:
                continue
            parts = text.split("\t")
            for k, part in enumerate(parts):
                if k:
                    r = p.add_run()
                    r.add_tab()
                    self._fmt_run(r, it.size_pt, False, it.rtl)
                if part:
                    r = p.add_run(part)
                    self._fmt_run(r, it.size_pt, bold, it.rtl and _has_rtl(part))
        return p

    def add_column_break(self, p) -> None:
        from docx.enum.text import WD_BREAK
        p.add_run().add_break(WD_BREAK.COLUMN)

    def add_table(self, it: TableItem):
        from docx.shared import Pt
        from docx.enum.text import WD_ALIGN_PARAGRAPH as A
        from docx.enum.table import WD_ROW_HEIGHT_RULE
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn
        nr, nc = len(it.rows), len(it.col_widths)
        if it.space_before >= 1:                  # table has no space-before: use a thin spacer paragraph
            sp = self.doc.add_paragraph()
            sp.paragraph_format.space_before = Pt(0)
            sp.paragraph_format.space_after = Pt(0)
            from docx.enum.text import WD_LINE_SPACING
            sp.paragraph_format.line_spacing_rule = WD_LINE_SPACING.EXACTLY
            sp.paragraph_format.line_spacing = Pt(max(1.0, round(it.space_before, 1)))
            r = sp.add_run("")
            r.font.size = Pt(1)
        t = self.doc.add_table(rows=nr, cols=nc)
        t.style = "Table Grid"
        t.autofit = False
        tblPr = t._tbl.tblPr
        lay = OxmlElement("w:tblLayout")
        lay.set(qn("w:type"), "fixed")
        tblPr.insert_element_before(lay, "w:tblCellMar", "w:tblLook", "w:tblCaption", "w:tblDescription")
        if it.left_indent > 0.5:
            ind = OxmlElement("w:tblInd")
            ind.set(qn("w:w"), str(int(it.left_indent * 20)))
            ind.set(qn("w:type"), "dxa")
            tblPr.insert_element_before(ind, "w:tblBorders", "w:shd", "w:tblLayout", "w:tblCellMar", "w:tblLook")
        for ri, row in enumerate(t.rows):
            row.height = Pt(max(it.row_heights[ri], 8))
            row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
            for ci, cell in enumerate(row.cells):
                cell.width = Pt(it.col_widths[ci])
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                txt = it.rows[ri][ci]
                if txt:
                    r = p.add_run(txt)
                    self._fmt_run(r, it.size_pt, it.bold[ri][ci], _has_rtl(txt))
                al = it.aligns[ri][ci]
                p.alignment = {"left": A.LEFT, "center": A.CENTER, "right": A.RIGHT}[al]
        # table is followed by the next paragraph; nothing else needed
        return t

    def add_picture(self, it: PictureItem):
        from docx.shared import Pt
        from docx.enum.text import WD_ALIGN_PARAGRAPH as A
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(round(it.space_before, 1))
        p.paragraph_format.space_after = Pt(0)
        if it.left_indent:
            p.paragraph_format.left_indent = Pt(round(it.left_indent, 1))
        p.alignment = {"left": A.LEFT, "center": A.CENTER, "right": A.RIGHT}[it.align]
        if it.data and it.width_pt > 0:
            p.add_run().add_picture(io.BytesIO(it.data), width=Pt(it.width_pt), height=Pt(it.height_pt))
        return p

    def blank_page(self) -> None:
        p = self.doc.add_paragraph()
        p.add_run("")

    def save(self, path: Path) -> None:
        self.doc.save(str(path))


def write_page(writer: _DocxWriter, layout: PageLayout, first_page: bool) -> None:
    """Emit one PDF page into the DOCX (one or more sections)."""
    bands = layout.bands
    if not bands:
        writer.section(layout, new_page=True, col_specs=[])
        writer.blank_page()
        return
    for bi, (col_specs, items) in enumerate(bands):
        writer.section(layout, new_page=(bi == 0), col_specs=col_specs)
        last_p = None
        prev_col = None
        for it in items:
            if col_specs and prev_col is not None and it.col != prev_col and last_p is not None:
                writer.add_column_break(last_p)
            if isinstance(it, ParaItem):
                last_p = writer.add_para(it)
            elif isinstance(it, TableItem):
                writer.add_table(it)
                last_p = None
            else:
                last_p = writer.add_picture(it)
            prev_col = it.col


def finalize_document(layouts: list) -> float:
    """Document level pass: body size, snap paragraph sizes to it, assign heading levels."""
    paras = [it for l in layouts for _, its in l.bands for it in its if isinstance(it, ParaItem)]
    if not paras:
        return 11.0
    body, snapped = snap_sizes_to_body([p.size_pt for p in paras], [max(len("".join(t for t, _ in p.runs)), 1) for p in paras])
    for p, s in zip(paras, snapped):
        p.size_pt = s
    cand = []
    for it in paras:
        txt = "".join(t for t, _ in it.runs).strip()
        if not it._tabbed and not it.list_kind and it.size_pt >= body * 1.15 and it._nlines <= 3 \
                and len(txt) <= 140 and not txt.endswith("."):
            cand.append(it)
    sizes = sorted({c.size_pt for c in cand}, reverse=True)[:3]
    for c in cand:
        c.heading = sizes.index(c.size_pt) + 1 if c.size_pt in sizes else 0
    return body


# ----------------------------------------------------------------------- the converter


class OCRLayoutConverter(BaseProcessor):
    """Scanned PDF -> DOCX with page size, paragraphs, headings, alignment, tables and pictures
    reconstructed from Tesseract hOCR. Same call shape as ``SimpleOCRConverter``."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        lang: str = "eng",
        quality: str = "standard",
    ) -> Path:
        try:
            return await asyncio.to_thread(self._convert, Path(file), Path(output_path), lang, quality)
        except ProcessingError:
            raise
        except ImportError as e:
            raise ProcessingError(f"Missing dependency: {e}")
        except Exception as e:  # noqa: BLE001
            logger.exception("OCR layout conversion failed")
            raise ProcessingError(f"Failed to convert PDF: {e}")

    # -- blocking part --------------------------------------------------------
    def _convert(self, file: Path, output_path: Path, lang: str, quality: str) -> Path:
        import fitz

        dpi = DPI_BY_QUALITY.get(quality, 200)
        lang = resolve_lang(lang)
        pdf = fitz.open(str(file))
        try:
            npages = len(pdf)
            if npages == 0:
                raise ProcessingError("PDF has no pages")
            an = _PageAnalyzer(lang, quality, dpi)
            writer = _DocxWriter(lang)

            # Pass over pages one at a time; layouts are small (pictures are encoded crops), page
            # rasters are released after each page. Body size / font are decided from page 1..N, so
            # we keep the page layouts and write after the loop.
            layouts: list = []
            for pno in range(npages):
                page = pdf[pno]
                try:
                    layout = self._process_page(an, page)
                except ProcessingError:
                    raise
                except Exception as e:  # never lose the whole document for one bad page
                    logger.warning("page %d failed: %s", pno + 1, e)
                    r = page.rect
                    layout = PageLayout(r.width, r.height)
                    layout.notes.append(f"failed: {e}")
                layouts.append(layout)

            serif_votes = [l.serif for l in layouts if l.serif is not None]
            serif = (sum(serif_votes) * 2 >= len(serif_votes)) if serif_votes else None
            writer.set_fonts(serif)
            body = finalize_document(layouts)
            writer.setup_styles(body)
            for i, layout in enumerate(layouts):
                write_page(writer, layout, i == 0)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            writer.save(output_path)
            return output_path
        finally:
            pdf.close()

    def _process_page(self, an: _PageAnalyzer, page) -> PageLayout:
        import fitz

        dpi = an.dpi
        pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72.0, dpi / 72.0), colorspace=fitz.csRGB, alpha=False)
        rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3).copy()
        del pix
        rotated = 0
        res = an.analyze(rgb)
        rgb_p, gray, gray_n, ang, grids, lines, photos = res
        nwords = sum(len(l.words) for l in lines)
        confs = [w.conf for l in lines for w in l.words]
        dark = float((gray_n < 200).mean())
        sideways = [w for l in lines for w in l.words if l.textangle in (90, 180, 270)]
        if nwords >= 5 and len(sideways) > 0.5 * nwords:
            # Tesseract read rotated text but reports its boxes in image coordinates
            vote = statistics.mode([l.textangle for l in lines if l.textangle in (90, 180, 270)])
            rotated = vote
            res = an.analyze(rgb, rotate_cw=vote)
            rgb_p, gray, gray_n, ang, grids, lines, photos = res
            nwords = sum(len(l.words) for l in lines)
            confs = [w.conf for l in lines for w in l.words]
        tall = [w for l in lines for w in l.words if (l.y1 - l.y0) > 1.5 * (l.x1 - l.x0) and len(l.words) >= 2]
        suspicious = not rotated and ((nwords < 3 and dark > 0.02) or (nwords >= 3 and confs and statistics.mean(confs) < 55)
                                      or (nwords >= 5 and len(tall) > 0.5 * nwords))
        if suspicious:
            rot = run_osd(gray_n)
            if rot:
                rotated = rot
                res = an.analyze(rgb, rotate_cw=rot)
                rgb_p, gray, gray_n, ang, grids, lines, photos = res
        h, w = gray.shape
        # page size in points follows the (possibly rotated) raster
        wpt, hpt = w * 72.0 / dpi, h * 72.0 / dpi
        layout = an.build(rgb_p, gray, gray_n, ang, grids, lines, photos, wpt, hpt)
        layout.rotated = rotated
        # snap to the PDF page size when the aspect matches (renders are exact multiples anyway)
        pw, ph = page.rect.width, page.rect.height
        if rotated in (90, 270):
            pw, ph = ph, pw
        layout.width_pt, layout.height_pt = pw, ph
        del rgb, rgb_p, gray, gray_n
        return layout
