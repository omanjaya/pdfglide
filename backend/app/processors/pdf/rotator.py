"""PDF rotator processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFRotator(BaseProcessor):
    """Rotate PDF pages."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        rotation: int = 90,
        pages: str = "all",
    ) -> Path:
        """
        Rotate PDF pages.

        Args:
            file: Input PDF file path
            output_path: Output file path
            rotation: Rotation angle (90, 180, 270)
            pages: Page specification ("all" or "1,3,5" or "1-3")

        Returns:
            Path to rotated PDF
        """
        if rotation not in [90, 180, 270]:
            raise ProcessingError("Rotation must be 90, 180, or 270 degrees")

        def _rotate():
            import pikepdf

            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)
                page_indices = self._parse_pages(pages, total_pages)

                for idx in page_indices:
                    page = pdf.pages[idx]
                    current_rotation = int(page.get("/Rotate", 0))
                    new_rotation = (current_rotation + rotation) % 360
                    page["/Rotate"] = new_rotation

                pdf.save(output_path)

            return output_path

        try:
            return await asyncio.to_thread(_rotate)
        except Exception as e:
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to rotate PDF: {str(e)}")
            raise ProcessingError(f"Unexpected error during rotation: {str(e)}")

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
