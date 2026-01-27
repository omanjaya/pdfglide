"""Background remover processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class BackgroundRemover(BaseProcessor):
    """Remove background from images using AI."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
    ) -> Path:
        """
        Remove background from image.

        Args:
            file: Input image file path
            output_path: Output file path (will be PNG with transparency)

        Returns:
            Path to output image
        """
        try:
            from rembg import remove
            from PIL import Image

            def _remove_bg():
                input_image = Image.open(file)
                output_image = remove(input_image)
                out = output_path.with_suffix(".png")
                output_image.save(out, "PNG")
                return out

            # Run CPU-intensive AI operation in thread pool
            return await asyncio.to_thread(_remove_bg)

        except ImportError:
            raise ProcessingError(
                "rembg package not installed. Install with: pip install rembg"
            )
        except Exception as e:
            raise ProcessingError(f"Failed to remove background: {str(e)}")
