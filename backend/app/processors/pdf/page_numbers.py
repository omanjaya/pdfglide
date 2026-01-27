"""PDF page numbers processor."""

import asyncio
import io
from pathlib import Path

from reportlab.pdfgen import canvas

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFPageNumbers(BaseProcessor):
    """Add page numbers to PDF."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        position: str = "bottom-center",
        start_number: int = 1,
        format_template: str = "{n}",
        font_size: int = 12,
        margin: int = 30,
    ) -> Path:
        """
        Add page numbers to PDF.

        Args:
            file: Input PDF file path
            output_path: Output file path
            position: Position (bottom-center, bottom-left, bottom-right, top-center, top-left, top-right)
            start_number: Starting page number
            format_template: Format template ({n} for number, {total} for total pages)
            font_size: Font size
            margin: Margin from edge in points

        Returns:
            Path to PDF with page numbers
        """

        def _add_page_numbers():
            import pikepdf

            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)

                for idx, page in enumerate(pdf.pages):
                    page_num = start_number + idx
                    text = format_template.replace("{n}", str(page_num)).replace(
                        "{total}", str(total_pages)
                    )

                    # Get page dimensions
                    mediabox = page.mediabox
                    page_width = float(mediabox[2]) - float(mediabox[0])
                    page_height = float(mediabox[3]) - float(mediabox[1])

                    # Create page number overlay
                    overlay = self._create_page_number(
                        text, position, font_size, margin, page_width, page_height
                    )

                    overlay_pdf = pikepdf.open(overlay)
                    page.add_overlay(overlay_pdf.pages[0])

                pdf.save(output_path)

            return output_path

        try:
            return await asyncio.to_thread(_add_page_numbers)
        except Exception as e:
            raise ProcessingError(f"Failed to add page numbers: {str(e)}")

    def _create_page_number(
        self,
        text: str,
        position: str,
        font_size: int,
        margin: int,
        page_width: float,
        page_height: float,
    ) -> io.BytesIO:
        """Create a page number overlay."""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=(page_width, page_height))

        c.setFont("Helvetica", font_size)

        # Calculate position
        text_width = c.stringWidth(text, "Helvetica", font_size)

        positions = {
            "bottom-center": (page_width / 2 - text_width / 2, margin),
            "bottom-left": (margin, margin),
            "bottom-right": (page_width - margin - text_width, margin),
            "top-center": (page_width / 2 - text_width / 2, page_height - margin),
            "top-left": (margin, page_height - margin),
            "top-right": (page_width - margin - text_width, page_height - margin),
        }

        x, y = positions.get(position, (page_width / 2 - text_width / 2, margin))

        c.drawString(x, y, text)
        c.save()

        buffer.seek(0)
        return buffer
