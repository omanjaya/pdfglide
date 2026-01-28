"""Background remover processor - optimized for hair and fine details."""

import asyncio
import logging
from pathlib import Path
from typing import Optional, Tuple

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError

logger = logging.getLogger(__name__)

# Cache the rembg session globally to avoid reloading the model on every request
_rembg_session = None


def get_rembg_session():
    """Get or create cached rembg session for u2net_human_seg model."""
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session
        logger.info("Loading rembg u2net_human_seg model (first time only)...")
        _rembg_session = new_session("u2net_human_seg")
        logger.info("rembg model loaded and cached")
    return _rembg_session


class BackgroundRemover(BaseProcessor):
    """Remove background from images using AI with fine hair detection."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        bg_color: Optional[str] = None,
        output_format: str = "png",
        quality: int = 90,
    ) -> Path:
        """
        Remove background from image with optimized hair detection.

        Args:
            file: Input image file path
            output_path: Output file path
            bg_color: Background color (None=transparent, "white", "black", or hex "#RRGGBB")
            output_format: Output format (png, jpeg, webp)
            quality: Quality for JPEG/WebP (1-100)

        Returns:
            Path to output image
        """
        try:
            from rembg import remove
            from PIL import Image, ImageFilter, ImageEnhance

            def _remove_bg():
                input_image = Image.open(file)
                original_size = input_image.size

                # Convert to RGB if needed
                if input_image.mode not in ("RGB", "RGBA"):
                    input_image = input_image.convert("RGB")

                # Resize large images to prevent OOM (max 2048px on longest side)
                max_size = 2048
                if max(original_size) > max_size:
                    ratio = max_size / max(original_size)
                    new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))
                    input_image = input_image.resize(new_size, Image.LANCZOS)
                    logger.info(f"Resized image from {original_size} to {new_size}")

                # Pre-processing: Enhance for better edge detection
                # 1. Slight contrast boost
                contrast = ImageEnhance.Contrast(input_image)
                enhanced = contrast.enhance(1.05)
                # 2. Slight sharpening
                sharpener = ImageEnhance.Sharpness(enhanced)
                enhanced = sharpener.enhance(1.2)

                # Use cached session (u2net_human_seg) for better human/hair detection
                session = get_rembg_session()

                # Try with alpha matting for better hair edges
                try:
                    output_image = remove(
                        enhanced,
                        session=session,
                        alpha_matting=True,
                        alpha_matting_foreground_threshold=270,
                        alpha_matting_background_threshold=20,
                        alpha_matting_erode_size=5,
                    )
                    logger.info("Background removal with alpha matting succeeded")
                except Exception as e:
                    # Fallback without alpha matting if it fails
                    logger.warning(f"Alpha matting failed, using basic removal: {e}")
                    output_image = remove(enhanced, session=session)

                # Resize back to original if we resized
                if max(original_size) > max_size:
                    output_image = output_image.resize(original_size, Image.LANCZOS)

                # Post-processing: Smooth and feather edges for natural look
                if output_image.mode == "RGBA":
                    r, g, b, alpha = output_image.split()

                    # 1. Light median filter to remove small artifacts
                    alpha = alpha.filter(ImageFilter.MedianFilter(size=3))

                    # 2. Edge-aware smoothing using multiple passes
                    # First pass: very light blur for micro-details
                    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.3))

                    # 3. Feather the edges slightly for natural transition
                    # Use MinFilter to slightly erode, then MaxFilter to restore
                    # This creates a natural feathered edge
                    alpha_eroded = alpha.filter(ImageFilter.MinFilter(size=3))
                    alpha = Image.blend(alpha, alpha_eroded, 0.15)

                    # 4. Final smooth pass
                    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.5))

                    output_image = Image.merge("RGBA", (r, g, b, alpha))

                # Apply background color if specified
                if bg_color:
                    rgb_color = self._parse_color(bg_color)
                    background = Image.new("RGBA", output_image.size, rgb_color + (255,))
                    background.paste(output_image, (0, 0), output_image)
                    output_image = background

                # Determine output format
                fmt = output_format.lower()
                if fmt in ("jpg", "jpeg"):
                    ext = ".jpg"
                    save_format = "JPEG"
                    if output_image.mode == "RGBA":
                        if not bg_color:
                            background = Image.new("RGBA", output_image.size, (255, 255, 255, 255))
                            background.paste(output_image, (0, 0), output_image)
                            output_image = background
                        output_image = output_image.convert("RGB")
                    save_kwargs = {"quality": quality, "optimize": True}
                elif fmt == "webp":
                    ext = ".webp"
                    save_format = "WEBP"
                    save_kwargs = {"quality": quality, "method": 6}
                else:
                    ext = ".png"
                    save_format = "PNG"
                    save_kwargs = {"optimize": True}

                out = output_path.with_suffix(ext)
                output_image.save(out, save_format, **save_kwargs)
                return out

            return await asyncio.to_thread(_remove_bg)

        except ImportError:
            raise ProcessingError(
                "rembg package not installed. Install with: pip install rembg"
            )
        except Exception as e:
            raise ProcessingError(f"Failed to remove background: {str(e)}")

    def _parse_color(self, color: str) -> Tuple[int, int, int]:
        """Parse color string to RGB tuple."""
        color = color.lower().strip()

        named_colors = {
            "white": (255, 255, 255),
            "black": (0, 0, 0),
            "red": (255, 0, 0),
            "green": (0, 255, 0),
            "blue": (0, 0, 255),
            "yellow": (255, 255, 0),
            "cyan": (0, 255, 255),
            "magenta": (255, 0, 255),
            "gray": (128, 128, 128),
            "grey": (128, 128, 128),
        }

        if color in named_colors:
            return named_colors[color]

        if color.startswith("#"):
            hex_color = color[1:]
            if len(hex_color) == 3:
                hex_color = "".join(c * 2 for c in hex_color)
            if len(hex_color) == 6:
                r = int(hex_color[0:2], 16)
                g = int(hex_color[2:4], 16)
                b = int(hex_color[4:6], 16)
                return (r, g, b)

        return (255, 255, 255)
