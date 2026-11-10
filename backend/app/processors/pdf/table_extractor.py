"""PDF Table Extractor - Extract tables to Excel.

Strategy:
1. PyMuPDF ``page.find_tables()`` (accurate cell geometry, merged cells, fast).
2. If PyMuPDF finds no table anywhere in the selection, fall back to tabula
   (Java; can detect borderless tables via whitespace).

Cells are written as real numbers when they look like numbers, tables that
continue on the next page (same columns, repeated header) are appended to the
same sheet, and column widths follow the PDF.
"""

import asyncio
import re
from pathlib import Path

from app.core.exceptions import ProcessingError
from app.processors.base import BaseProcessor

_INT_RE = re.compile(r"^[-+]?\d{1,3}(,\d{3})+$|^[-+]?\d+$")
_DOT_GROUP_RE = re.compile(r"^[-+]?\d{1,3}(\.\d{3}){2,}$")
_US_DEC_RE = re.compile(r"^[-+]?(\d{1,3}(,\d{3})+|\d+)\.\d+$")
_EU_DEC_RE = re.compile(r"^[-+]?(\d{1,3}(\.\d{3})+|\d+),\d+$")
_INVALID_SHEET_CHARS = re.compile(r"[\\/*?:\[\]]")


def parse_number(text):
    """Return int/float for numeric-looking text, else None.

    Handles thousands separators in both styles ("1,234.50" and "1.234,50"),
    negatives written "-5" or "(5)". Leading-zero strings ("007") and
    anything with units/letters stay text.
    """
    if not isinstance(text, str):
        return None
    t = text.strip().replace(" ", "").replace(" ", "")
    if not t:
        return None
    neg = t.startswith("(") and t.endswith(")")
    if neg:
        t = t[1:-1]
    if re.match(r"^[-+]?0\d", t):  # ids / zip codes with leading zeros
        return None
    value = None
    if _INT_RE.match(t):
        value = int(t.replace(",", ""))
    elif _DOT_GROUP_RE.match(t):
        value = int(t.replace(".", ""))
    elif _US_DEC_RE.match(t):
        value = float(t.replace(",", ""))
    elif _EU_DEC_RE.match(t):
        value = float(t.replace(".", "").replace(",", "."))
    if value is None:
        return None
    return -value if neg else value


def _number_format(text: str, value) -> str | None:
    if isinstance(value, int):
        return "#,##0" if re.search(r"[,.]", text) else None
    decimals = len(re.split(r"[.,]", text.strip())[-1])
    return "#,##0." + "0" * decimals if decimals else None


def _parse_pages(pages: str, total: int) -> list[int]:
    """'all' / '1,3,5-7' -> 0-based page indexes, in order, valid only."""
    if not pages or pages.strip().lower() == "all":
        return list(range(total))
    result: list[int] = []
    for part in pages.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            if "-" in part:
                a, b = part.split("-", 1)
                rng = range(int(a) - 1, int(b))
            else:
                rng = range(int(part) - 1, int(part))
        except ValueError:
            continue
        for p in rng:
            if 0 <= p < total and p not in result:
                result.append(p)
    return result


class _Table:
    """Table in grid form: rows of text plus merged ranges and widths."""

    def __init__(self, page_no: int, grid, merges, col_widths_pt):
        self.pages = [page_no]
        self.grid = grid  # list[list[str|None]]
        self.merges = merges  # list[(r1, c1, r2, c2)] 0-based inclusive
        self.col_widths_pt = col_widths_pt  # list[float] | None


class PDFTableExtractor(BaseProcessor):
    """Extract tables from PDF and save to Excel."""

    # ------------------------------------------------------------------ extraction
    @staticmethod
    def _tables_from_page(page, page_no: int) -> list[_Table]:
        import fitz

        found = page.find_tables()
        out: list[_Table] = []
        for tab in found.tables:
            cells = [fitz.Rect(c) for c in tab.cells if c is not None]
            if not cells:
                continue
            # Grid lines = every distinct cell edge, so merged cells (which span
            # several grid slots) can be placed exactly.
            def uniq(vals):
                vals = sorted(vals)
                res = [vals[0]]
                for v in vals[1:]:
                    if v - res[-1] > 2.0:
                        res.append(v)
                return res

            xs = uniq([c.x0 for c in cells] + [c.x1 for c in cells])
            ys = uniq([c.y0 for c in cells] + [c.y1 for c in cells])

            def idx(lines, v):
                return min(range(len(lines)), key=lambda i: abs(lines[i] - v))

            nrows, ncols = len(ys) - 1, len(xs) - 1
            if nrows < 1 or ncols < 1:
                continue
            grid: list[list] = [[None] * ncols for _ in range(nrows)]
            merges = []
            for c in cells:
                c0, c1 = idx(xs, c.x0), idx(xs, c.x1)
                r0, r1 = idx(ys, c.y0), idx(ys, c.y1)
                if c1 <= c0 or r1 <= r0:
                    continue
                text = page.get_text(
                    "text", clip=fitz.Rect(c.x0 + 1, c.y0 + 1, c.x1 - 1, c.y1 - 1)
                ).strip()
                text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
                grid[r0][c0] = text
                if c1 - c0 > 1 or r1 - r0 > 1:
                    merges.append((r0, c0, r1 - 1, c1 - 1))
            # Drop completely empty rows/cols produced by stray lines
            if not any(v for row in grid for v in row if v):
                continue
            widths = [xs[i + 1] - xs[i] for i in range(ncols)]
            out.append(_Table(page_no, grid, merges, widths))
        return out

    @staticmethod
    def _merge_continuations(tables: list[_Table]) -> list[_Table]:
        """Join a table with its continuation on the next page.

        Same column count + consecutive pages + either the header row is
        repeated (dropped) or the column widths match (rows appended).
        """
        merged: list[_Table] = []
        for t in tables:
            prev = merged[-1] if merged else None
            if (
                prev
                and t.pages[0] == prev.pages[-1] + 1
                and len(t.grid[0]) == len(prev.grid[0])
                and not t.merges
                and not prev.merges
            ):
                same_header = [v or "" for v in t.grid[0]] == [v or "" for v in prev.grid[0]]
                same_cols = (
                    prev.col_widths_pt
                    and t.col_widths_pt
                    and all(abs(a - b) < 3 for a, b in zip(prev.col_widths_pt, t.col_widths_pt))
                )
                if same_header or same_cols:
                    prev.grid.extend(t.grid[1:] if same_header else t.grid)
                    prev.pages.append(t.pages[0])
                    continue
            merged.append(t)
        return merged

    def _extract_pymupdf(self, input_path: Path, pages: str) -> list[_Table]:
        import fitz

        doc = fitz.open(str(input_path))
        try:
            tables: list[_Table] = []
            for p in _parse_pages(pages, len(doc)):
                tables.extend(self._tables_from_page(doc[p], p + 1))
        finally:
            doc.close()
        return self._merge_continuations(tables)

    def _extract_tabula(self, input_path: Path, pages: str) -> list[_Table]:
        try:
            import tabula
        except ImportError:
            return []
        try:
            frames = tabula.read_pdf(
                str(input_path),
                pages="all" if pages.strip().lower() == "all" else pages,
                multiple_tables=True,
                pandas_options={"header": None, "dtype": str},
                silent=True,
                # Run Java as a child process. An in-process JVM (JPype) cannot be
                # unloaded and can hang the server/worker process on shutdown.
                force_subprocess=True,
            )
        except Exception:
            return []  # no Java / unreadable: treat as "no tables"
        tables = []
        for n, df in enumerate(frames or [], start=1):
            df = df.dropna(how="all").dropna(axis=1, how="all")
            if df.empty:
                continue
            grid = [
                ["" if v != v else str(v) for v in row]  # NaN != NaN
                for row in df.itertuples(index=False, name=None)
            ]
            tables.append(_Table(n, grid, [], None))
        return tables

    # ------------------------------------------------------------------ writing
    @staticmethod
    def _sheet_name(table: _Table, used: set[str]) -> str:
        if len(table.pages) > 1:
            base = f"Page {table.pages[0]}-{table.pages[-1]}"
        else:
            base = f"Page {table.pages[0]}"
        name, n = base, 1
        while name in used:
            n += 1
            name = f"{base} T{n}"
        used.add(name)
        return _INVALID_SHEET_CHARS.sub("_", name)[:31]

    @staticmethod
    def _write_sheet(ws, table: _Table):
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.utils import get_column_letter

        thin = Side(style="thin", color="999999")
        border = Border(left=thin, right=thin, top=thin, bottom=thin)
        nrows, ncols = len(table.grid), max(len(r) for r in table.grid)

        # First row = header unless it is mostly numeric
        first = [v for v in table.grid[0] if v]
        has_header = bool(first) and sum(parse_number(v) is not None for v in first) <= len(first) // 2

        for r, row in enumerate(table.grid, start=1):
            for c, text in enumerate(row, start=1):
                cell = ws.cell(row=r, column=c)
                cell.border = border
                cell.alignment = Alignment(vertical="top", wrap_text=True)
                if text is None or text == "":
                    continue
                num = parse_number(text) if (r > 1 or not has_header) else None
                if num is not None:
                    cell.value = num
                    fmt = _number_format(text, num)
                    if fmt:
                        cell.number_format = fmt
                    cell.alignment = Alignment(vertical="top", horizontal="right")
                else:
                    cell.value = text

        for (r1, c1, r2, c2) in table.merges:
            ws.merge_cells(start_row=r1 + 1, start_column=c1 + 1, end_row=r2 + 1, end_column=c2 + 1)

        if has_header:
            for c in range(1, ncols + 1):
                cell = ws.cell(row=1, column=c)
                cell.font = Font(bold=True)
                cell.fill = PatternFill("solid", fgColor="E7E6E6")
            if nrows > 1:
                ws.freeze_panes = "A2"

        for c in range(ncols):
            if table.col_widths_pt and c < len(table.col_widths_pt):
                width = table.col_widths_pt[c] / 5.25  # points -> Excel character units
            else:
                width = max((len(str(r[c] or "")) for r in table.grid if c < len(r)), default=8) + 2
            ws.column_dimensions[get_column_letter(c + 1)].width = max(8, min(width, 70))

    # ------------------------------------------------------------------ entry point
    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        pages: str = "all",
    ) -> Path:
        """
        Extract tables from PDF to Excel (one sheet per table).

        Args:
            input_path: Path to the input PDF
            output_path: Path for the Excel output (.xlsx)
            pages: Pages to extract tables from ("all" or "1,3,5-7")

        Returns:
            Path to the Excel file
        """

        def _run() -> Path:
            import openpyxl

            tables = self._extract_pymupdf(input_path, pages)
            if not tables:
                tables = self._extract_tabula(input_path, pages)
            if not tables:
                raise ProcessingError("No tables found in the selected pages")

            wb = openpyxl.Workbook()
            wb.remove(wb.active)
            used: set[str] = set()
            for table in tables:
                ws = wb.create_sheet(self._sheet_name(table, used))
                self._write_sheet(ws, table)

            out = output_path.with_suffix(".xlsx")
            wb.save(out)
            return out

        try:
            return await asyncio.to_thread(_run)
        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(f"Failed to extract tables: {e}")
