"""PDF splitter processor."""

import asyncio
import re
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFSplitter(BaseProcessor):
    """Split PDF into multiple files based on page ranges."""

    async def execute(
        self,
        file: Path,
        pages: str,
        output_id: str,
    ) -> list[Path]:
        """
        Split PDF file.

        Args:
            file: Input PDF file path
            pages: Page ranges (e.g., "1-3,5,7-10" or "all")
            output_id: Base output file ID

        Returns:
            List of output file paths
        """
        output_dir = self.output_dir

        def _split():
            import pikepdf

            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)

                # Parse page ranges
                page_ranges = self._parse_page_ranges(pages, total_pages)

                output_files = []
                for idx, (start, end) in enumerate(page_ranges):
                    output_pdf = pikepdf.Pdf.new()

                    # Add pages (pikepdf uses 0-based indexing)
                    for page_num in range(start - 1, end):
                        output_pdf.pages.append(pdf.pages[page_num])

                    # Save split PDF
                    output_path = output_dir / f"{output_id}_pages_{start}-{end}.pdf"
                    output_pdf.save(output_path)
                    output_files.append(output_path)

                return output_files

        try:
            return await asyncio.to_thread(_split)
        except Exception as e:
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to split PDF: {str(e)}")
            raise ProcessingError(f"Unexpected error during split: {str(e)}")

    def _parse_page_ranges(
        self,
        pages: str,
        total_pages: int,
    ) -> list[tuple[int, int]]:
        """
        Parse page range string.

        Args:
            pages: Page range string (e.g., "1-3,5,7-10" or "all")
            total_pages: Total number of pages in PDF

        Returns:
            List of (start, end) tuples
        """
        if pages.lower() == "all":
            # Split each page individually
            return [(i, i) for i in range(1, total_pages + 1)]

        ranges = []
        parts = pages.replace(" ", "").split(",")

        for part in parts:
            if "-" in part:
                match = re.match(r"(\d+)-(\d+)", part)
                if match:
                    start = int(match.group(1))
                    end = int(match.group(2))
                    if start <= end <= total_pages and start >= 1:
                        ranges.append((start, end))
            else:
                try:
                    page = int(part)
                    if 1 <= page <= total_pages:
                        ranges.append((page, page))
                except ValueError:
                    pass

        if not ranges:
            raise ProcessingError(f"Invalid page range: {pages}")

        return ranges
