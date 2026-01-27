"""Image compressor processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class ImageCompressor(BaseProcessor):
    """Compress image to reduce file size."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        quality: int = 80,
    ) -> Path:
        """
        Compress image file.

        Args:
            file: Input image file path
            output_path: Output file path
            quality: Compression quality (1-100)

        Returns:
            Path to compressed image
        """

        def _compress():
            from PIL import Image

            with Image.open(file) as img:
                # Convert RGBA to RGB for JPEG
                if img.mode == "RGBA" and output_path.suffix.lower() in [".jpg", ".jpeg"]:
                    # Create white background
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                elif img.mode not in ["RGB", "L"]:
                    img = img.convert("RGB")

                # Determine format from extension
                ext = output_path.suffix.lower()
                if ext in [".jpg", ".jpeg"]:
                    img.save(
                        output_path,
                        format="JPEG",
                        quality=quality,
                        optimize=True,
                    )
                elif ext == ".png":
                    img.save(
                        output_path,
                        format="PNG",
                        optimize=True,
                        compress_level=9 - (quality // 12),  # Convert quality to compress level
                    )
                elif ext == ".webp":
                    img.save(
                        output_path,
                        format="WEBP",
                        quality=quality,
                        method=6,  # Best compression
                    )
                else:
                    img.save(output_path, quality=quality, optimize=True)

            return output_path

        try:
            return await asyncio.to_thread(_compress)
        except Exception as e:
            raise ProcessingError(f"Failed to compress image: {str(e)}")
