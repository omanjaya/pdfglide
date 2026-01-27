"""PDF watermark processor."""

import asyncio
import io
from pathlib import Path

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFWatermark(BaseProcessor):
    """Add watermark to PDF pages."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        text: str,
        position: str = "center",
        opacity: float = 0.3,
        rotation: int = 45,
        font_size: int = 60,
        color: str = "gray",
        pages: str = "all",
    ) -> Path:
        """
        Add text watermark to PDF.

        Args:
            file: Input PDF file path
            output_path: Output file path
            text: Watermark text
            position: Position (center, top-left, top-right, bottom-left, bottom-right)
            opacity: Opacity (0.0 to 1.0)
            rotation: Text rotation angle
            font_size: Font size
            color: Color name (gray, red, blue, green, black)
            pages: Page specification

        Returns:
            Path to watermarked PDF
        """

        def _add_watermark():
            import pikepdf

            # Create watermark PDF
            watermark_pdf = self._create_watermark(
                text, position, opacity, rotation, font_size, color
            )

            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)
                page_indices = self._parse_pages(pages, total_pages)

                watermark = pikepdf.open(watermark_pdf)
                watermark_page = watermark.pages[0]

                for idx in page_indices:
                    page = pdf.pages[idx]
                    page.add_underlay(watermark_page)

                pdf.save(output_path)

            return output_path

        try:
            return await asyncio.to_thread(_add_watermark)
        except Exception as e:
            raise ProcessingError(f"Failed to add watermark: {str(e)}")

    def _create_watermark(
        self,
        text: str,
        position: str,
        opacity: float,
        rotation: int,
        font_size: int,
        color: str,
    ) -> io.BytesIO:
        """Create a watermark PDF page."""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Set color with opacity
        color_map = {
            "gray": (0.5, 0.5, 0.5),
            "red": (1, 0, 0),
            "blue": (0, 0, 1),
            "green": (0, 0.5, 0),
            "black": (0, 0, 0),
        }
        rgb = color_map.get(color, (0.5, 0.5, 0.5))
        c.setFillColor(Color(rgb[0], rgb[1], rgb[2], alpha=opacity))

        # Calculate position
        positions = {
            "center": (width / 2, height / 2),
            "top-left": (100, height - 100),
            "top-right": (width - 100, height - 100),
            "bottom-left": (100, 100),
            "bottom-right": (width - 100, 100),
        }
        x, y = positions.get(position, (width / 2, height / 2))

        # Draw watermark
        c.saveState()
        c.translate(x, y)
        c.rotate(rotation)
        c.setFont("Helvetica-Bold", font_size)
        c.drawCentredString(0, 0, text)
        c.restoreState()

        c.save()
        buffer.seek(0)
        return buffer

    def _parse_pages(self, pages: str, total_pages: int) -> list[int]:
        """Parse page specification to list of 0-based indices."""
        if pages.lower() == "all":
            return list(range(total_pages))

        indices = []
        parts = pages.replace(" ", "").split(",")

        for part in parts:
            if "-" in part:
                start, end = part.split("-")
                start_idx = int(start) - 1
                end_idx = int(end)
                indices.extend(range(start_idx, min(end_idx, total_pages)))
            else:
                idx = int(part) - 1
                if 0 <= idx < total_pages:
                    indices.append(idx)

        return sorted(set(indices))
