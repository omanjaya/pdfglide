"""Image converter processor."""

import asyncio
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image, ImageSequence

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.image._common import (
    has_alpha,
    human_error,
    is_animated,
    open_image,
    parse_color,
    prepare_still,
    to_srgb,
    upright,
    flatten,
)
from app.processors.image.resizer import ImageResizer


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
        background: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Convert image to different format.

        Args:
            file: Input image file path
            output_path: Output file path
            target_format: Target format (jpg, png, webp, gif, bmp, tiff)
            quality: JPEG/WebP quality (1-100). WebP at 100 is lossless.
            background: Colour used instead of transparency when the target has
                no alpha channel (JPEG, BMP). Default white.

        Returns:
            Stats dict (source/target format, flags for flattened transparency
            or a dropped animation).
        """
        target_format = target_format.lower()
        pil_format = self.FORMAT_MAP.get(target_format)

        if not pil_format:
            raise ProcessingError(
                f"Unsupported format: {target_format}. Use JPG, PNG, WebP or GIF."
            )
        bg = parse_color(background) if background else (255, 255, 255)

        try:
            return await asyncio.to_thread(
                self._convert, file, output_path, pil_format, quality, bg
            )
        except ProcessingError:
            raise
        except Exception as e:
            raise human_error(e, "convert")

    # ------------------------------------------------------------------

    def _convert(self, file, output_path, pil_format, quality, bg):
        with open_image(file) as img:
            src_format = img.format
            multi = is_animated(img)
            animated = multi and pil_format in ("GIF", "WEBP")
            transparent = has_alpha(img)
            info = {
                "source_format": (src_format or "").lower(),
                "target_format": pil_format.lower(),
                "animation_dropped": multi and not animated,
                "flattened_transparency": False,
            }

            if animated:
                self._save_animated(img, output_path, pil_format, quality)
                return info

            # 16-bit greyscale PNG -> PNG keeps its depth
            if img.mode in ("I;16", "I;16L", "I;16B") and pil_format == "PNG":
                upright(img).save(output_path, "PNG", optimize=True,
                                  icc_profile=img.info.get("icc_profile"))
                return info

            if pil_format == "JPEG":
                im, icc, exif = prepare_still(img, keep_alpha=True)
                if im.mode in ("RGBA", "LA"):
                    im = flatten(im, bg)
                info["flattened_transparency"] = transparent
                kw: Dict[str, Any] = {}
                if icc:
                    kw["icc_profile"] = icc
                if exif:
                    kw["exif"] = exif
                im.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True,
                        subsampling="4:4:4" if quality >= 90 else "4:2:0", **kw)
            elif pil_format == "PNG":
                im, icc, exif = prepare_still(img, keep_alpha=True)
                kw = {"optimize": True}
                if icc:
                    kw["icc_profile"] = icc
                im.save(output_path, "PNG", **kw)
            elif pil_format == "WEBP":
                im, icc, exif = prepare_still(img, keep_alpha=True)
                kw = {"icc_profile": icc} if icc else {}
                if quality >= 100:
                    im.save(output_path, "WEBP", lossless=True, quality=100, method=5, **kw)
                else:
                    im.save(output_path, "WEBP", quality=quality, method=5, **kw)
            elif pil_format == "GIF":
                im, _, _ = prepare_still(to_srgb(upright(img)), keep_alpha=True)
                ImageResizer._gif_palette(im).save(output_path, "GIF", optimize=True)
                info["flattened_transparency"] = False
            else:  # BMP, TIFF
                im, icc, _ = prepare_still(to_srgb(upright(img)), keep_alpha=pil_format == "TIFF")
                if pil_format == "BMP" and im.mode in ("RGBA", "LA"):
                    im = flatten(im, bg)
                    info["flattened_transparency"] = transparent
                im.save(output_path, pil_format)
        return info

    @staticmethod
    def _save_animated(img, output_path, pil_format, quality):
        frames, durations = [], []
        for frame in ImageSequence.Iterator(img):
            durations.append(frame.info.get("duration", 100))
            frames.append(frame.convert("RGBA"))
        loop = img.info.get("loop", 0)
        if pil_format == "WEBP":
            frames[0].save(output_path, "WEBP", save_all=True, append_images=frames[1:],
                           duration=durations, loop=loop, quality=quality, method=4)
        else:
            ImageResizer._save_gif_frames([to_srgb(f) for f in frames], durations, loop, output_path)
