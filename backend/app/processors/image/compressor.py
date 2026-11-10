"""Image compressor processor."""

import asyncio
import io
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from PIL import Image, ImageSequence, features

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.image._common import (
    has_gps,
    human_error,
    is_animated,
    open_image,
    exif_orientation,
    prepare_still,
    strip_jpeg_exif,
    upright,
)

# At or above this quality PNG is only optimised losslessly; below it the
# palette-quantised candidate is tried as well (see _png_candidates).
PNG_LOSSY_BELOW = 90


def _png_colors(quality: int) -> int:
    """Palette size for lossy PNG: 256 colours down to 32 as quality drops."""
    if quality >= 70:
        return 256
    if quality >= 50:
        return 128
    if quality >= 30:
        return 64
    return 32


class ImageCompressor(BaseProcessor):
    """Compress image to reduce file size."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        quality: int = 80,
        strip_metadata: bool = True,
    ) -> Dict[str, Any]:
        """
        Compress an image, keeping its format (JPEG, PNG, WebP, GIF).

        The smallest valid candidate wins; if nothing is smaller than the
        input, the input bytes are returned unchanged.

        Args:
            file: Input image file path
            output_path: Output file path (extension must match the format)
            quality: 1-100. JPEG/WebP: encoder quality. PNG: 90+ is lossless
                optimisation, lower values also try palette quantisation
                (256 -> 32 colours).
            strip_metadata: Drop EXIF/GPS/text metadata. The orientation is
                applied to the pixels and the ICC profile is always kept.

        Returns:
            Stats dict (original_size, compressed_size, saved_bytes,
            compression_ratio, format, method, kept_original, metadata_removed).
        """
        try:
            return await asyncio.to_thread(
                self._compress, file, output_path, quality, strip_metadata
            )
        except ProcessingError:
            raise
        except Exception as e:
            raise human_error(e, "compress")

    # ------------------------------------------------------------------ core

    def _compress(self, file: Path, output_path: Path, quality: int, strip: bool) -> Dict[str, Any]:
        original_size = file.stat().st_size
        with open_image(file) as img:
            src_format = img.format
            animated = is_animated(img)
            had_gps = has_gps(img)
            had_meta = bool(img.getexif())
            orientation = exif_orientation(img)
            target = self._target_format(src_format)
            if target == "GIF" or (animated and target == "WEBP"):
                candidates = self._animated_candidates(img, target, quality)
            elif target == "JPEG":
                candidates = self._jpeg_candidates(img, quality, strip)
            elif target == "PNG":
                candidates = self._png_candidates(img, quality, strip)
            else:
                candidates = self._webp_candidates(img, quality, strip)

        method, data = min(candidates, key=lambda c: len(c[1]))
        keep_original = target == src_format and len(data) >= original_size
        removed = bool(strip and not keep_original)
        if keep_original:
            shutil.copyfile(file, output_path)
            final_size, method = original_size, "original kept (already optimal)"
            if strip and src_format == "JPEG" and (had_gps or had_meta) and orientation in (None, 1):
                # Nothing smaller was possible, but location data can still be
                # dropped losslessly (no re-encode) when no rotation depends on it.
                output_path.write_bytes(strip_jpeg_exif(file.read_bytes()))
                final_size = output_path.stat().st_size
                method, removed = "original kept, metadata stripped losslessly", True
        else:
            output_path.write_bytes(data)
            final_size = len(data)

        return {
            "original_size": original_size,
            "compressed_size": final_size,
            "saved_bytes": original_size - final_size,
            "compression_ratio": round((1 - final_size / original_size) * 100, 1)
            if original_size > 0 else 0,
            "format": target.lower(),
            "quality": quality,
            "method": method,
            "kept_original": keep_original,
            # False when the original file was returned unchanged and it carried EXIF/GPS
            "metadata_removed": removed,
            "had_location_data": had_gps,
            "had_metadata": had_meta,
            "animated": animated,
        }

    @staticmethod
    def _target_format(src_format: Optional[str]) -> str:
        if src_format in ("JPEG", "PNG", "WEBP", "GIF"):
            return src_format
        return "JPEG"  # BMP/TIFF/... -> JPEG

    # --------------------------------------------------------------- encoders

    @staticmethod
    def _encode(im: Image.Image, fmt: str, **kw) -> bytes:
        buf = io.BytesIO()
        im.save(buf, format=fmt, **kw)
        return buf.getvalue()

    def _jpeg_candidates(self, img, quality, strip):
        im, icc, exif = prepare_still(img, keep_alpha=False)
        kw: Dict[str, Any] = {"quality": quality, "optimize": True}
        if icc:
            kw["icc_profile"] = icc
        if exif and not strip:
            kw["exif"] = exif
        if im.mode == "RGB":
            # 4:2:0 saves ~25% and is invisible below q90; keep full chroma above
            kw["subsampling"] = "4:2:0" if quality < 90 else "4:4:4"
        out = [("jpeg progressive", self._encode(im, "JPEG", progressive=True, **kw))]
        if im.width * im.height < 400_000:  # tiny images: baseline can be smaller
            out.append(("jpeg baseline", self._encode(im, "JPEG", **kw)))
        return out

    def _png_candidates(self, img, quality, strip):
        if img.mode in ("I;16", "I;16L", "I;16B", "I") and quality >= PNG_LOSSY_BELOW:
            # Keep the full bit depth when the user asked for no quality loss
            kw16 = {"icc_profile": img.info["icc_profile"]} if img.info.get("icc_profile") else {}
            return [("png lossless 16-bit", self._encode(upright(img), "PNG", optimize=True,
                                                         compress_level=9, **kw16))]
        im, icc, exif = prepare_still(img, keep_alpha=True)
        kw: Dict[str, Any] = {"optimize": True}
        if icc:
            kw["icc_profile"] = icc
        if exif and not strip:
            kw["exif"] = exif

        # Lossless reductions: drop an all-opaque alpha channel, use a palette
        # when the image has <= 256 colours.
        lossless = im
        if im.mode in ("RGBA", "LA"):
            if im.getchannel("A").getextrema()[0] == 255:
                lossless = im.convert("RGB" if im.mode == "RGBA" else "L")
        if lossless.mode == "RGB":
            colors = lossless.getcolors(256)
            if colors is not None:
                lossless = lossless.convert("P", palette=Image.Palette.ADAPTIVE, colors=len(colors))
        out = [("png lossless", self._encode(lossless, "PNG", compress_level=9, **kw))]

        if quality < PNG_LOSSY_BELOW:
            n = _png_colors(quality)
            if im.mode in ("RGB", "RGBA"):
                if features.check("libimagequant"):
                    method = Image.Quantize.LIBIMAGEQUANT
                elif im.mode == "RGBA":
                    method = Image.Quantize.FASTOCTREE
                else:
                    method = Image.Quantize.MEDIANCUT
                pal = im.quantize(colors=n, method=method, dither=Image.Dither.FLOYDSTEINBERG)
                out.append((f"png {n}-colour palette", self._encode(pal, "PNG", compress_level=9, **kw)))
        return out

    def _webp_candidates(self, img, quality, strip):
        im, icc, exif = prepare_still(img, keep_alpha=True)
        kw: Dict[str, Any] = {"quality": quality, "method": 5}
        if icc:
            kw["icc_profile"] = icc
        if exif and not strip:
            kw["exif"] = exif
        if im.mode in ("L", "LA"):
            im = im.convert("RGBA" if im.mode == "LA" else "RGB")
        return [("webp lossy", self._encode(im, "WEBP", **kw))]

    def _animated_candidates(self, img, target, quality):
        """Animated GIF/WebP: keep every frame and its timing."""
        frames, durations = [], []
        for frame in ImageSequence.Iterator(img):
            durations.append(frame.info.get("duration", 100))
            frames.append(frame.convert("RGBA") if target == "WEBP" else frame.copy())
        loop = img.info.get("loop", 0)
        if target == "WEBP":
            data = self._encode(
                frames[0], "WEBP", save_all=True, append_images=frames[1:],
                duration=durations, loop=loop, quality=quality, method=4,
            )
            return [("animated webp", data)]
        data = self._encode(
            frames[0], "GIF", save_all=True, append_images=frames[1:],
            duration=durations, loop=loop, optimize=True,
        )
        return [("animated gif optimised", data)]
