"""Background remover processor.

The segmentation model works on a small copy of the picture; the alpha mask it
produces is scaled up and applied to the ORIGINAL pixels, so the result keeps
the original resolution, colours and orientation.
"""

import asyncio
import logging
import threading
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from PIL import Image

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.image._common import (
    human_error,
    has_alpha,
    normalize_mode,
    open_image,
    parse_color,
    upright,
)

logger = logging.getLogger(__name__)

# Cache the rembg session globally to avoid reloading the model on every request
_rembg_session = None
_session_lock = threading.Lock()
# Each request holds several full-size arrays; two at a time fit the worker's memory
_slots = threading.BoundedSemaphore(2)

# Longest side of the copy handed to the model / alpha matting.
MODEL_SIDE = 1024
MATTING_SIDE = 768


def get_rembg_session():
    """Get or create cached rembg session for u2net_human_seg model."""
    global _rembg_session
    if _rembg_session is None:
        with _session_lock:
            if _rembg_session is None:
                from rembg import new_session
                logger.info("Loading rembg u2net_human_seg model (first time only)...")
                _rembg_session = new_session("u2net_human_seg")
                logger.info("rembg model loaded and cached")
    return _rembg_session


def _fit(size: Tuple[int, int], side: int) -> Tuple[int, int]:
    ratio = min(1.0, side / max(size))
    return max(1, round(size[0] * ratio)), max(1, round(size[1] * ratio))


class BackgroundRemover(BaseProcessor):
    """Remove background from images using AI."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        bg_color: Optional[str] = None,
        output_format: str = "png",
        quality: int = 90,
        fast_mode: bool = False,
    ) -> Path:
        """
        Remove background from image.

        Args:
            file: Input image file path
            output_path: Output file path
            bg_color: Background color (None/"transparent"=transparent, "white",
                "black", or hex "#RRGGBB")
            output_format: Output format (png, jpeg, webp)
            quality: Quality for JPEG/WebP (1-100)
            fast_mode: Skip alpha matting (faster, softer hair and fine edges)

        Returns:
            Path to output image
        """
        color = None
        if bg_color and bg_color.strip().lower() not in ("transparent", "none"):
            color = parse_color(bg_color)  # ProcessingError on a bad colour, not silent white
        try:
            import rembg  # noqa: F401
        except ImportError:
            raise ProcessingError("The background remover is not available right now.")

        try:
            return await asyncio.to_thread(
                self._run, file, output_path, color, output_format.lower(), quality, fast_mode
            )
        except ProcessingError:
            raise
        except Exception as e:
            logger.exception("background removal failed")
            raise human_error(e, "remove the background from")

    # ------------------------------------------------------------------

    def _run(self, file, output_path, color, fmt, quality, fast_mode) -> Path:
        with _slots:
            with open_image(file) as src:
                icc = src.info.get("icc_profile")
                cmyk = src.mode == "CMYK"
                src_alpha_present = has_alpha(src)
                img = upright(src)
                img = normalize_mode(img, keep_alpha=True)
            if cmyk:
                icc = None
            return self._process(img, icc, src_alpha_present, output_path, color, fmt, quality, fast_mode)

    def _process(self, img, icc, had_alpha, output_path, color, fmt, quality, fast_mode) -> Path:
        import numpy as np

        full_size = img.size
        rgb_full = img.convert("RGB")
        src_alpha = img.getchannel("A") if img.mode in ("RGBA", "LA") and had_alpha else None
        if img.mode in ("L", "LA"):
            rgb_full = img.convert("RGB")

        # The model sees the picture on white if it had transparency
        if src_alpha is not None:
            base = Image.new("RGB", full_size, (255, 255, 255))
            base.paste(rgb_full, mask=src_alpha)
        else:
            base = rgb_full
        work = base.resize(_fit(full_size, MODEL_SIDE), Image.Resampling.LANCZOS) \
            if max(full_size) > MODEL_SIDE else base

        from rembg import remove
        session = get_rembg_session()
        mask = remove(work, session=session, only_mask=True)  # "L", values 0..255
        if mask.mode != "L":
            mask = mask.convert("L")

        if not fast_mode:
            try:
                mask = self._matte(work, mask)
            except Exception as e:  # matting is an enhancement; keep the model mask
                logger.warning("alpha matting skipped: %s", e)

        # Clean model haze, keep a soft edge
        arr = np.asarray(mask).astype(np.float32)
        arr = np.clip((arr - 6) * (255.0 / (249 - 6)), 0, 255)
        mask = Image.fromarray(arr.astype(np.uint8), "L")
        if mask.size != full_size:
            mask = mask.resize(full_size, Image.Resampling.BICUBIC)
        if src_alpha is not None:
            from PIL import ImageChops
            mask = ImageChops.multiply(mask, src_alpha)

        # Original colours where something is visible; black under fully transparent
        # pixels so the PNG compresses (background noise there would only bloat it)
        visible = mask.point(lambda v: 255 if v else 0)
        out = Image.composite(rgb_full, Image.new("RGB", full_size, (0, 0, 0)), visible)
        out.putalpha(mask)  # RGBA at the original resolution

        if color is not None:
            solid = Image.new("RGBA", full_size, color + (255,))
            out = Image.alpha_composite(solid, out)

        kw_icc = {"icc_profile": icc} if icc else {}
        if fmt in ("jpg", "jpeg"):
            if out.mode == "RGBA":
                white = Image.new("RGBA", full_size, (255, 255, 255, 255))
                out = Image.alpha_composite(white, out)
            out.convert("RGB").save(
                output_path.with_suffix(".jpg"), "JPEG", quality=quality, optimize=True,
                progressive=True, subsampling="4:4:4" if quality >= 90 else "4:2:0", **kw_icc,
            )
            return output_path.with_suffix(".jpg")
        if fmt == "webp":
            target = output_path.with_suffix(".webp")
            out.save(target, "WEBP", quality=quality, method=5, **kw_icc)
            return target
        target = output_path.with_suffix(".png")
        # optimize=True is 2-3x slower and only worth it on small outputs
        out.save(target, "PNG", optimize=full_size[0] * full_size[1] <= 4_000_000,
                 compress_level=6, **kw_icc)
        return target

    @staticmethod
    def _matte(work: Image.Image, mask: Image.Image) -> Image.Image:
        """Refine the hair/edge band with closed-form alpha matting on a reduced copy."""
        import numpy as np
        from pymatting import estimate_alpha_cf
        from scipy.ndimage import binary_erosion

        size = _fit(work.size, MATTING_SIDE)
        small = work.resize(size, Image.Resampling.LANCZOS)
        m = np.asarray(mask.resize(size, Image.Resampling.BILINEAR)).astype(np.float32) / 255.0
        fg = binary_erosion(m > 0.94, iterations=6)
        bg = binary_erosion(m < 0.04, iterations=6)
        if not fg.any() or not bg.any():
            return mask  # nothing found, or everything: no band to refine
        trimap = np.full(m.shape, 0.5)
        trimap[fg] = 1.0
        trimap[bg] = 0.0
        alpha = estimate_alpha_cf(np.asarray(small).astype(np.float64) / 255.0, trimap)
        alpha = np.clip(alpha, 0, 1)
        return Image.fromarray((alpha * 255).astype(np.uint8), "L").resize(work.size, Image.Resampling.BICUBIC)
