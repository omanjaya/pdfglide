"""PDF Signature processor."""

import asyncio
import io
from pathlib import Path
from typing import Optional

from app.processors.base import BaseProcessor


class PDFSigner(BaseProcessor):
    """Add signature to PDF documents."""

    POSITIONS = {
        "top-left": (50, -100),
        "top-center": (0, -100),  # 0 means center
        "top-right": (-50, -100),
        "center": (0, 0),  # Will be calculated
        "bottom-left": (50, 100),
        "bottom-center": (0, 100),
        "bottom-right": (-50, 100),
    }

    def _create_signature_overlay(
        self,
        signature_image: Optional[Path],
        signature_text: Optional[str],
        width: int,
        height: int,
        page_width: float,
        page_height: float,
        position: str,
    ) -> bytes:
        """Create a PDF page with signature at specified position."""
        from PIL import Image
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen import canvas

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=(page_width, page_height))

        # Calculate position
        pos_offset = self.POSITIONS.get(position, (50, 100))
        x_offset, y_offset = pos_offset

        # Calculate actual position
        if x_offset == 0:  # Center horizontally
            x = (page_width - width) / 2
        elif x_offset < 0:  # From right
            x = page_width + x_offset - width
        else:
            x = x_offset

        if y_offset == 0:  # Center vertically
            y = (page_height - height) / 2
        elif y_offset < 0:  # From top
            y = page_height + y_offset - height
        else:
            y = y_offset

        if signature_image and signature_image.exists():
            # Add image signature
            img = Image.open(signature_image)
            # Resize to fit
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            img_reader = ImageReader(img)
            c.drawImage(
                img_reader, x, y,
                width=img.width, height=img.height,
                mask='auto'
            )
        elif signature_text:
            # Add text signature
            c.setFont("Helvetica-Oblique", 14)
            c.setFillColorRGB(0, 0, 0.5)  # Dark blue
            c.drawString(x, y + height / 2, signature_text)

        c.save()
        buffer.seek(0)
        return buffer.read()

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        signature_image: Optional[Path] = None,
        signature_text: Optional[str] = None,
        position: str = "bottom-right",
        page: int = -1,  # -1 means last page
        width: int = 150,
        height: int = 50,
    ) -> Path:
        """
        Add a signature to PDF.

        Args:
            input_path: Path to the input PDF
            output_path: Path for the signed PDF
            signature_image: Path to signature image (PNG with transparency preferred)
            signature_text: Text to use as signature if no image
            position: Position on page (top-left, top-center, top-right,
                     center, bottom-left, bottom-center, bottom-right)
            page: Page number to sign (1-based, -1 for last page)
            width: Signature width in points
            height: Signature height in points

        Returns:
            Path to the signed PDF
        """
        if not signature_image and not signature_text:
            raise ValueError("Either signature_image or signature_text is required")

        def _sign():
            import pikepdf

            with pikepdf.open(input_path) as pdf:
                total_pages = len(pdf.pages)

                # Convert page number
                if page == -1:
                    target_page = total_pages - 1
                else:
                    target_page = page - 1  # Convert to 0-based

                if target_page < 0 or target_page >= total_pages:
                    raise ValueError(f"Invalid page number: {page}")

                # Get page dimensions
                page_obj = pdf.pages[target_page]
                media_box = page_obj.MediaBox
                page_width = float(media_box[2]) - float(media_box[0])
                page_height = float(media_box[3]) - float(media_box[1])

                # Create signature overlay
                overlay_bytes = self._create_signature_overlay(
                    signature_image, signature_text,
                    width, height,
                    page_width, page_height,
                    position,
                )

                # Open overlay as PDF and merge
                overlay_pdf = pikepdf.open(io.BytesIO(overlay_bytes))
                overlay_page = overlay_pdf.pages[0]

                # Get or create the page's content stream
                page_obj.add_overlay(overlay_page)

                pdf.save(output_path)

            return output_path

        return await asyncio.to_thread(_sign)
