"""QR Code generator processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class QRCodeGenerator(BaseProcessor):
    """Generate QR codes from content."""

    async def execute(
        self,
        content: str,
        output_path: Path,
        size: int = 400,
        error_correction: str = "M",
    ) -> Path:
        """
        Generate QR code image.

        Args:
            content: Content to encode (text, URL, etc.)
            output_path: Output image file path
            size: Image size in pixels
            error_correction: Error correction level (L, M, Q, H)

        Returns:
            Path to generated QR code image
        """

        def _generate():
            import qrcode
            from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H

            # Map error correction level
            ec_map = {
                "L": ERROR_CORRECT_L,
                "M": ERROR_CORRECT_M,
                "Q": ERROR_CORRECT_Q,
                "H": ERROR_CORRECT_H,
            }
            ec_level = ec_map.get(error_correction.upper(), ERROR_CORRECT_M)

            # Create QR code
            qr = qrcode.QRCode(
                version=None,  # Auto-determine
                error_correction=ec_level,
                box_size=10,
                border=4,
            )
            qr.add_data(content)
            qr.make(fit=True)

            # Create image
            img = qr.make_image(fill_color="black", back_color="white")

            # Resize to requested size
            img = img.resize((size, size))

            # Save
            img.save(output_path, "PNG")

            return output_path

        try:
            return await asyncio.to_thread(_generate)
        except ImportError:
            raise ProcessingError(
                "qrcode package not installed. Install with: pip install qrcode[pil]"
            )
        except Exception as e:
            raise ProcessingError(f"Failed to generate QR code: {str(e)}")
