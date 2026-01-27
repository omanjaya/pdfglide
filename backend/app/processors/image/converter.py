"""Image converter processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class ImageConverter(BaseProcessor):
    """Convert image to different format."""

    FORMAT_MAP = {
        "jpg": "JPEG",
        "jpeg": "JPEG",
        "png": "PNG",
        "webp": "WEBP",
        "gif": "GIF",
        "bmp": "BMP",
        "tiff": "TIFF",
    }

    async def execute(
        self,
        file: Path,
        output_path: Path,
        target_format: str,
        quality: int = 90,
    ) -> Path:
        """
        Convert image to different format.

        Args:
            file: Input image file path
            output_path: Output file path
            target_format: Target format (jpg, png, webp, gif)
            quality: Output quality (1-100)

        Returns:
            Path to converted image
        """
        target_format = target_format.lower()
        pil_format = self.FORMAT_MAP.get(target_format)

        if not pil_format:
            raise ProcessingError(f"Unsupported format: {target_format}")

        def _convert():
            from PIL import Image

            with Image.open(file) as img:
                # Handle mode conversion
                if pil_format == "JPEG":
                    if img.mode == "RGBA":
                        # Create white background for transparency
                        background = Image.new("RGB", img.size, (255, 255, 255))
                        background.paste(img, mask=img.split()[3])
                        img = background
                    elif img.mode != "RGB":
                        img = img.convert("RGB")

                    img.save(
                        output_path,
                        format=pil_format,
                        quality=quality,
                        optimize=True,
                    )

                elif pil_format == "PNG":
                    if img.mode not in ["RGBA", "RGB", "L", "LA", "P"]:
                        img = img.convert("RGBA")
                    img.save(output_path, format=pil_format, optimize=True)

                elif pil_format == "WEBP":
                    img.save(
                        output_path,
                        format=pil_format,
                        quality=quality,
                        method=4,
                    )

                elif pil_format == "GIF":
                    if img.mode != "P":
                        img = img.convert("P", palette=Image.Palette.ADAPTIVE, colors=256)
                    img.save(output_path, format=pil_format, optimize=True)

                else:
                    img.save(output_path, format=pil_format)

            return output_path

        try:
            return await asyncio.to_thread(_convert)
        except Exception as e:
            raise ProcessingError(f"Failed to convert image: {str(e)}")
