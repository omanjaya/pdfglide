"""Image watermark processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class ImageWatermark(BaseProcessor):
    """Add text watermark to images."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        text: str,
        position: str = "center",
        opacity: float = 0.3,
        font_size: int = 40,
        color: str = "white",
        rotation: int = 0,
    ) -> Path:
        """
        Add text watermark to image.

        Args:
            file: Input image file path
            output_path: Output file path
            text: Watermark text
            position: Position (center, top-left, top-right, bottom-left, bottom-right)
            opacity: Opacity (0.0 to 1.0)
            font_size: Font size
            color: Color name (white, black, red, blue, green, gray)
            rotation: Text rotation angle

        Returns:
            Path to watermarked image
        """

        def _add_watermark():
            from PIL import Image, ImageDraw, ImageFont

            img = Image.open(file).convert("RGBA")

            # Create watermark layer
            watermark = Image.new("RGBA", img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(watermark)

            # Try to use a system font, fallback to default
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
            except OSError:
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
                except OSError:
                    font = ImageFont.load_default()

            # Get text size
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]

            # Calculate position
            width, height = img.size
            positions = {
                "center": ((width - text_width) / 2, (height - text_height) / 2),
                "top-left": (20, 20),
                "top-right": (width - text_width - 20, 20),
                "bottom-left": (20, height - text_height - 20),
                "bottom-right": (width - text_width - 20, height - text_height - 20),
            }
            x, y = positions.get(position, positions["center"])

            # Get color with opacity
            color_map = {
                "white": (255, 255, 255),
                "black": (0, 0, 0),
                "red": (255, 0, 0),
                "blue": (0, 0, 255),
                "green": (0, 128, 0),
                "gray": (128, 128, 128),
            }
            rgb = color_map.get(color, (255, 255, 255))
            alpha = int(255 * opacity)

            # Draw text
            draw.text((x, y), text, font=font, fill=(*rgb, alpha))

            # Rotate watermark if needed
            if rotation != 0:
                watermark = watermark.rotate(rotation, expand=False, center=(width / 2, height / 2))

            # Composite
            result = Image.alpha_composite(img, watermark)

            # Save with original format
            output_format = output_path.suffix.lower().lstrip(".")
            if output_format in ["jpg", "jpeg"]:
                result = result.convert("RGB")
                result.save(output_path, "JPEG", quality=95)
            else:
                result.save(output_path, output_format.upper())

            return output_path

        try:
            return await asyncio.to_thread(_add_watermark)
        except Exception as e:
            raise ProcessingError(f"Failed to add watermark: {str(e)}")
