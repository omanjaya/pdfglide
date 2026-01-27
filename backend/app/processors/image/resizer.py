"""Image resizer processor."""

import asyncio
from pathlib import Path
from typing import Optional

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class ImageResizer(BaseProcessor):
    """Resize image to specified dimensions."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        width: Optional[int] = None,
        height: Optional[int] = None,
        maintain_ratio: bool = True,
    ) -> Path:
        """
        Resize image file.

        Args:
            file: Input image file path
            output_path: Output file path
            width: Target width in pixels
            height: Target height in pixels
            maintain_ratio: Whether to maintain aspect ratio

        Returns:
            Path to resized image
        """
        if width is None and height is None:
            raise ProcessingError("At least one of width or height is required")

        def _resize():
            from PIL import Image

            with Image.open(file) as img:
                original_width, original_height = img.size

                if maintain_ratio:
                    # Calculate new dimensions maintaining aspect ratio
                    if width and height:
                        # Fit within bounds
                        ratio = min(width / original_width, height / original_height)
                        new_width = int(original_width * ratio)
                        new_height = int(original_height * ratio)
                    elif width:
                        ratio = width / original_width
                        new_width = width
                        new_height = int(original_height * ratio)
                    else:
                        ratio = height / original_height
                        new_width = int(original_width * ratio)
                        new_height = height
                else:
                    new_width = width or original_width
                    new_height = height or original_height

                # Resize image using high-quality resampling
                resized = img.resize(
                    (new_width, new_height),
                    Image.Resampling.LANCZOS,
                )

                # Save with appropriate format
                ext = output_path.suffix.lower()
                if ext in [".jpg", ".jpeg"]:
                    if resized.mode == "RGBA":
                        background = Image.new("RGB", resized.size, (255, 255, 255))
                        background.paste(resized, mask=resized.split()[3])
                        resized = background
                    resized.save(output_path, format="JPEG", quality=90)
                elif ext == ".png":
                    resized.save(output_path, format="PNG")
                elif ext == ".webp":
                    resized.save(output_path, format="WEBP", quality=90)
                elif ext == ".gif":
                    resized.save(output_path, format="GIF")
                else:
                    resized.save(output_path)

            return output_path

        try:
            return await asyncio.to_thread(_resize)
        except Exception as e:
            raise ProcessingError(f"Failed to resize image: {str(e)}")
