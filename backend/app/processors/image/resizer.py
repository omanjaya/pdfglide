"""Image resizer processor."""

import asyncio
import io
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from PIL import Image, ImageOps, ImageSequence

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.image._common import (
    MAX_INPUT_PIXELS,
    exif_bytes_without_orientation,
    human_error,
    is_animated,
    normalize_mode,
    open_image,
    prepare_still,
    upright,
)

FIT_MODES = ("contain", "cover", "exact")


def compute_size(
    src: Tuple[int, int],
    width: Optional[int],
    height: Optional[int],
    fit: str,
    percentage: Optional[float] = None,
    no_upscale: bool = False,
) -> Tuple[int, int]:
    """
    Output size for a resize request.

    contain: keep the aspect ratio and fit inside width x height (one side
             alone: the other follows the ratio).
    cover / exact: output is exactly width x height (cover crops, exact
             stretches); a missing side is derived from the ratio.
    The side that limits the fit is returned exactly as requested (no off-by-one).
    """
    sw, sh = src
    if percentage:
        w, h = max(1, round(sw * percentage / 100)), max(1, round(sh * percentage / 100))
    elif fit == "contain":
        if width and height:
            if width * sh <= height * sw:  # width is the limiting side
                w, h = width, max(1, round(sh * width / sw))
            else:
                w, h = max(1, round(sw * height / sh)), height
        elif width:
            w, h = width, max(1, round(sh * width / sw))
        else:
            w, h = max(1, round(sw * height / sh)), height
    else:
        w = width or max(1, round(sw * height / sh))
        h = height or max(1, round(sh * width / sw))

    if no_upscale and (w > sw or h > sh):
        if fit == "contain" or percentage:
            scale = min(sw / w, sh / h, 1.0)
            w, h = max(1, round(w * scale)), max(1, round(h * scale))
        else:
            w, h = min(w, sw), min(h, sh)
    return w, h


class ImageResizer(BaseProcessor):
    """Resize image to specified dimensions."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        width: Optional[int] = None,
        height: Optional[int] = None,
        maintain_ratio: bool = True,
        fit: Optional[str] = None,
        percentage: Optional[float] = None,
        no_upscale: bool = False,
        quality: int = 90,
    ) -> Dict[str, Any]:
        """
        Resize image file.

        Args:
            file: Input image file path
            output_path: Output file path (extension decides the format)
            width: Target width in pixels
            height: Target height in pixels
            maintain_ratio: True -> fit inside the box keeping the ratio
                ("contain"); False -> stretch to exactly width x height.
            fit: Optional explicit mode: contain, cover (fill the box and crop
                the overflow, centred) or exact. Overrides maintain_ratio.
            percentage: Scale both sides by this percent instead of width/height.
            no_upscale: Never enlarge: the result is capped at the source size.
            quality: JPEG/WebP quality of the output.

        Returns:
            Stats dict (original/new width and height, flags).
        """
        if width is None and height is None and not percentage:
            raise ProcessingError("At least one of width or height is required")
        fit = fit or ("contain" if maintain_ratio else "exact")
        if fit not in FIT_MODES:
            raise ProcessingError(f"Unknown fit mode '{fit}'. Use contain, cover or exact.")

        try:
            return await asyncio.to_thread(
                self._resize, file, output_path, width, height, fit, percentage, no_upscale, quality
            )
        except ProcessingError:
            raise
        except Exception as e:
            raise human_error(e, "resize")

    def _resize(self, file, output_path, width, height, fit, percentage, no_upscale, quality):
        ext = output_path.suffix.lower()
        with open_image(file) as img:
            multi = is_animated(img)
            animated = multi and ext in (".gif", ".webp")
            dropped = multi and not animated  # target cannot animate: first frame only
            src_size = img.size
            if not animated:
                img = upright(img)
                src_size = img.size
            new_size = compute_size(src_size, width, height, fit, percentage, no_upscale)
            if new_size[0] * new_size[1] > MAX_INPUT_PIXELS:
                raise ProcessingError(
                    f"The requested size {new_size[0]} x {new_size[1]} is too large "
                    f"(maximum {MAX_INPUT_PIXELS // 1_000_000} megapixels)."
                )

            if animated:
                self._save_animated(img, output_path, ext, new_size, fit, quality)
            else:
                self._save_still(img, output_path, ext, new_size, fit, quality)

        return {
            "original_width": src_size[0],
            "original_height": src_size[1],
            "width": new_size[0],
            "height": new_size[1],
            "fit": fit,
            "upscaled": new_size[0] > src_size[0] or new_size[1] > src_size[1],
            "animation_dropped": dropped,
        }

    @staticmethod
    def _scale(im: Image.Image, size: Tuple[int, int], fit: str) -> Image.Image:
        if im.size == size:
            return im.copy()
        if fit == "cover":
            return ImageOps.fit(im, size, Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        return im.resize(size, Image.Resampling.LANCZOS)

    def _save_still(self, img, output_path, ext, size, fit, quality):
        keep_alpha = ext in (".png", ".webp", ".gif")
        sixteen = img.mode in ("I;16", "I;16L", "I;16B") and ext == ".png"
        if sixteen:
            # Pillow cannot resample "I;16": go through 32-bit float and back
            import numpy as np

            im, icc, exif = img, img.info.get("icc_profile"), None
            as_float = Image.fromarray(np.asarray(img).astype(np.float32), "F")
            scaled = np.asarray(self._scale(as_float, size, fit))
            resized = Image.fromarray(np.clip(scaled + 0.5, 0, 65535).astype(np.uint16))
        else:
            # Palette images must be expanded first: Pillow resamples "P" with
            # NEAREST, which makes hard, jagged edges.
            im, icc, exif = prepare_still(img, keep_alpha)
            resized = self._scale(im, size, fit)
            exif = exif_bytes_without_orientation(img, size) if exif else None
        dpi = img.info.get("dpi")

        kw: Dict[str, Any] = {}
        if icc:
            kw["icc_profile"] = icc
        if exif:
            kw["exif"] = exif
        if dpi:
            kw["dpi"] = dpi
        if ext in (".jpg", ".jpeg"):
            resized.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True,
                         subsampling="4:4:4" if quality >= 90 else "4:2:0", **kw)
        elif ext == ".png":
            resized.save(output_path, "PNG", optimize=True, **kw)
        elif ext == ".webp":
            kw.pop("dpi", None)
            resized.save(output_path, "WEBP", quality=quality, method=5, **kw)
        elif ext == ".gif":
            self._save_gif_still(resized, output_path)
        else:
            resized.save(output_path, **kw)

    @staticmethod
    def _gif_palette(frame: Image.Image) -> Image.Image:
        """RGBA -> palette image whose transparent pixels use index 255."""
        if frame.mode == "RGBA":
            alpha = frame.getchannel("A")
            pal = frame.convert("RGB").quantize(colors=255, dither=Image.Dither.FLOYDSTEINBERG)
            mask = alpha.point(lambda a: 255 if a < 128 else 0)
            pal.paste(255, mask=mask)
            pal.info["transparency"] = 255
            return pal
        return frame.convert("RGB").quantize(colors=256, dither=Image.Dither.FLOYDSTEINBERG)

    def _save_gif_still(self, im, output_path):
        self._gif_palette(im).save(output_path, "GIF", optimize=True)

    def _save_animated(self, img, output_path, ext, size, fit, quality):
        frames, durations = [], []
        for frame in ImageSequence.Iterator(img):
            durations.append(frame.info.get("duration", 100))
            rgba = normalize_mode(frame.copy(), keep_alpha=True)
            rgba = rgba.convert("RGBA")
            frames.append(self._scale(rgba, size, fit))
        loop = img.info.get("loop", 0)
        if ext == ".webp":
            frames[0].save(output_path, "WEBP", save_all=True, append_images=frames[1:],
                           duration=durations, loop=loop, quality=quality, method=4)
        else:
            self._save_gif_frames(frames, durations, loop, output_path)

    @classmethod
    def _save_gif_frames(cls, frames, durations, loop, output_path):
        """Write RGBA frames as an animated GIF (transparent pixels use index 255)."""
        pal = [cls._gif_palette(f) for f in frames]
        see_through = any(f.getchannel("A").getextrema()[0] < 128 for f in frames)
        # Frames with transparent areas must be cleared between frames
        extra = {"disposal": 2} if see_through else {"optimize": True}
        pal[0].save(output_path, "GIF", save_all=True, append_images=pal[1:],
                    duration=durations, loop=loop, **extra)
