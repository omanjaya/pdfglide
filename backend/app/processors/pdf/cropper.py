"""PDF Crop processor."""

import asyncio
from pathlib import Path
from typing import List

from app.processors.base import BaseProcessor


class PDFCropper(BaseProcessor):
    """Crop PDF pages by adjusting margins."""

    def _parse_pages(self, pages: str, total_pages: int) -> List[int]:
        """Parse page specification into list of page indices (0-based)."""
        if pages.lower() == "all":
            return list(range(total_pages))

        result = []
        for part in pages.split(","):
            part = part.strip()
            if "-" in part:
                start, end = part.split("-")
                start = int(start) - 1  # Convert to 0-based
                end = int(end)  # Keep as is for range()
                result.extend(range(start, end))
            else:
                result.append(int(part) - 1)  # Convert to 0-based

        return [p for p in result if 0 <= p < total_pages]

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        left: float = 0,
        top: float = 0,
        right: float = 0,
        bottom: float = 0,
        pages: str = "all",
    ) -> Path:
        """
        Crop PDF pages by adjusting the CropBox.

        Args:
            input_path: Path to the input PDF
            output_path: Path for the cropped PDF
            left: Points to crop from left edge
            top: Points to crop from top edge
            right: Points to crop from right edge
            bottom: Points to crop from bottom edge
            pages: Pages to crop ("all" or "1,3,5-7")

        Returns:
            Path to the cropped PDF
        """

        def _crop():
            import pikepdf

            with pikepdf.open(input_path) as pdf:
                page_indices = self._parse_pages(pages, len(pdf.pages))

                for idx in page_indices:
                    page = pdf.pages[idx]

                    # Get the MediaBox (physical page size)
                    if "/MediaBox" in page:
                        media_box = page.MediaBox
                    else:
                        # Default to letter size if not specified
                        media_box = pikepdf.Array([0, 0, 612, 792])

                    # Calculate new CropBox
                    x0 = float(media_box[0]) + left
                    y0 = float(media_box[1]) + bottom
                    x1 = float(media_box[2]) - right
                    y1 = float(media_box[3]) - top

                    # Ensure valid dimensions
                    if x1 <= x0 or y1 <= y0:
                        raise ValueError(
                            f"Invalid crop dimensions for page {idx + 1}. "
                            "Crop values exceed page dimensions."
                        )

                    # Set the CropBox
                    page.CropBox = pikepdf.Array([x0, y0, x1, y1])

                pdf.save(output_path)

            return output_path

        return await asyncio.to_thread(_crop)
