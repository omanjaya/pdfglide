"""Shared helpers for the image processors.

Everything here is synchronous Pillow work; callers run it in a worker thread.
"""

from __future__ import annotations

import io
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional, Tuple

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import ProcessingError

# Largest input we accept, in pixels. 100 MP is a 10 000 x 10 000 image: about
# 400 MB as RGBA in memory, which is what one worker can afford. Anything larger
# gets a clear message instead of an OOM kill.
MAX_INPUT_PIXELS = 100_000_000

EXIF_ORIENTATION = 0x0112

SUPPORTED_NAMES = "JPG, PNG, WebP or GIF"

# Pillow format name -> (extension, MIME type)
FORMAT_INFO = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
    "GIF": (".gif", "image/gif"),
}


@contextmanager
def open_image(path: Path) -> Iterator[Image.Image]:
    """
    Open and fully decode an image, mapping Pillow failures to ProcessingError.

    The format is detected from the bytes, never from the file name. The file
    is decoded here so a truncated upload fails now, with a readable message.
    """
    img = None
    try:
        try:
            img = Image.open(path)
            width, height = img.size
            if width * height > MAX_INPUT_PIXELS:
                raise ProcessingError(_too_large(width, height))
            img.load()
        except ProcessingError:
            raise
        except Image.DecompressionBombError:
            raise ProcessingError(
                f"This image is too large to process (more than "
                f"{MAX_INPUT_PIXELS // 1_000_000} megapixels). "
                "Please use a smaller image."
            )
        except UnidentifiedImageError:
            raise ProcessingError(
                f"This file is not a valid image, or its format is not supported. "
                f"Please upload a {SUPPORTED_NAMES} file."
            )
        except (OSError, SyntaxError, ValueError, EOFError):
            raise ProcessingError(
                "This image file looks damaged or incomplete and could not be read. "
                "Please try another copy of the image."
            )
        yield img
    finally:
        if img is not None:
            img.close()


def _too_large(width: int, height: int) -> str:
    return (
        f"This image is too large to process ({width} x {height} pixels, "
        f"{width * height / 1_000_000:.0f} megapixels). "
        f"The maximum is {MAX_INPUT_PIXELS // 1_000_000} megapixels."
    )


def detect_format(path: Path) -> Optional[str]:
    """Return the Pillow format name from the file content (None if unknown)."""
    try:
        with Image.open(path) as img:
            return img.format
    except Exception:
        return None


def is_animated(img: Image.Image) -> bool:
    return bool(getattr(img, "is_animated", False)) and getattr(img, "n_frames", 1) > 1


def has_alpha(img: Image.Image) -> bool:
    return (
        img.mode in ("RGBA", "LA", "PA", "RGBa", "La")
        or (img.mode == "P" and "transparency" in img.info)
        or (img.mode in ("L", "RGB", "1") and "transparency" in img.info)
    )


def upright(img: Image.Image) -> Image.Image:
    """Apply EXIF orientation. The returned image no longer carries the tag."""
    try:
        out = ImageOps.exif_transpose(img)
    except Exception:
        out = img
    return out if out is not None else img


def exif_bytes_without_orientation(
    img: Image.Image, size: Optional[Tuple[int, int]] = None
) -> Optional[bytes]:
    """
    EXIF block of ``img`` with the orientation tag removed (None if empty).

    The pixels have already been rotated upright, so a leftover tag would
    rotate the picture a second time in viewers. When ``size`` is given, the
    stored pixel dimensions are updated to match the new image.
    """
    try:
        exif = img.getexif()
        if not exif:
            return None
        if EXIF_ORIENTATION in exif:
            del exif[EXIF_ORIENTATION]
        try:
            sub = exif.get_ifd(0x8769)
            if size is not None:
                if 0xA002 in sub:
                    sub[0xA002] = size[0]
                if 0xA003 in sub:
                    sub[0xA003] = size[1]
        except Exception:
            pass
        if not exif:
            return None
        return exif.tobytes()
    except Exception:
        return None


def exif_orientation(img: Image.Image) -> Optional[int]:
    try:
        return img.getexif().get(EXIF_ORIENTATION)
    except Exception:
        return None


def has_gps(img: Image.Image) -> bool:
    try:
        return bool(img.getexif().get_ifd(0x8825))
    except Exception:
        return False


def _srgb_profile():
    from PIL import ImageCms

    return ImageCms.createProfile("sRGB")


def icc_is_srgb(icc: Optional[bytes]) -> bool:
    if not icc:
        return True
    try:
        from PIL import ImageCms

        prof = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        return "srgb" in (ImageCms.getProfileDescription(prof) or "").lower()
    except Exception:
        return False


def to_srgb(img: Image.Image) -> Image.Image:
    """Convert pixels to sRGB using the embedded profile (profile is dropped)."""
    icc = img.info.get("icc_profile")
    if not icc or icc_is_srgb(icc):
        img.info.pop("icc_profile", None)
        return img
    try:
        from PIL import ImageCms

        src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
        mode = img.mode if img.mode in ("RGB", "RGBA", "L", "CMYK") else "RGB"
        out_mode = "RGBA" if mode == "RGBA" else "RGB"
        rgb = ImageCms.profileToProfile(
            img if img.mode == mode else img.convert(mode),
            src,
            _srgb_profile(),
            outputMode=out_mode,
            renderingIntent=ImageCms.Intent.PERCEPTUAL,
        )
        if rgb is not None:
            rgb.info.pop("icc_profile", None)
            return rgb
    except Exception:
        pass
    img.info.pop("icc_profile", None)
    return img


def to_8bit(img: Image.Image) -> Image.Image:
    """16-bit / 32-bit greyscale to 8-bit by scaling (Pillow's convert clips)."""
    import numpy as np

    arr = np.asarray(img).astype(np.int64)
    top = int(arr.max(initial=0))
    if img.mode == "F" or top <= 255:
        out = np.clip(arr, 0, 255)
    elif top <= 65535:
        out = arr >> 8
    else:
        out = (arr * 255 // top)
    return Image.fromarray(out.astype(np.uint8), "L")


def normalize_mode(img: Image.Image, keep_alpha: bool) -> Image.Image:
    """
    Bring any Pillow mode to one of L, LA, RGB, RGBA.

    CMYK is converted through its ICC profile (or plainly when there is none),
    16-bit greyscale is scaled to 8-bit, palette images keep their transparency.
    ``keep_alpha=False`` flattens transparency onto white.
    """
    mode = img.mode
    if mode in ("I;16", "I;16L", "I;16B", "I", "F"):
        img = to_8bit(img)
    elif mode == "CMYK":
        icc = img.info.get("icc_profile")
        converted = None
        if icc:
            try:
                from PIL import ImageCms

                src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
                converted = ImageCms.profileToProfile(
                    img, src, _srgb_profile(), outputMode="RGB",
                    renderingIntent=ImageCms.Intent.PERCEPTUAL,
                )
            except Exception:
                converted = None
        img = converted if converted is not None else img.convert("RGB")
        img.info.pop("icc_profile", None)
    elif mode in ("P", "PA") or has_alpha(img):
        img = img.convert("RGBA") if (has_alpha(img) or mode == "PA") else img.convert("RGB")
    elif mode in ("1", "YCbCr", "LAB", "HSV"):
        img = img.convert("RGB" if mode != "1" else "L")
    elif mode in ("RGBa", "La"):
        img = img.convert("RGBA" if mode == "RGBa" else "LA")

    if img.mode not in ("L", "LA", "RGB", "RGBA"):
        img = img.convert("RGB")
    if not keep_alpha and img.mode in ("LA", "RGBA"):
        img = flatten(img)
    return img


def flatten(img: Image.Image, background: Tuple[int, int, int] = (255, 255, 255)) -> Image.Image:
    """Composite transparency over a solid colour (white by default)."""
    rgba = img.convert("RGBA")
    base = Image.new("RGBA", rgba.size, background + (255,))
    out = Image.alpha_composite(base, rgba).convert("RGB")
    out.info.update({k: v for k, v in img.info.items() if k == "icc_profile"})
    return out


def prepare_still(img: Image.Image, keep_alpha: bool) -> Tuple[Image.Image, Optional[bytes], Optional[bytes]]:
    """
    Upright + mode-normalised copy plus (icc_profile, exif_without_orientation).

    The ICC profile is returned only when the pixels are still in that profile's
    space, so callers can embed it as is.
    """
    img = upright(img)
    exif = exif_bytes_without_orientation(img)
    icc = img.info.get("icc_profile")
    was_cmyk = img.mode == "CMYK"
    img = normalize_mode(img, keep_alpha)
    if was_cmyk:
        icc = None  # pixels were converted to sRGB
    elif icc and img.mode in ("L", "LA") and icc[16:20] != b"GRAY":
        icc = None  # an RGB profile cannot describe grey pixels
    return img, icc, exif


def human_error(exc: Exception, action: str) -> ProcessingError:
    """Wrap an unexpected failure in a message that is safe to show a user."""
    if isinstance(exc, ProcessingError):
        return exc
    if isinstance(exc, MemoryError):
        return ProcessingError(
            f"The image is too large to {action} with the memory available. "
            "Please use a smaller image."
        )
    return ProcessingError(
        f"Could not {action} this image. The file may be damaged or use an unsupported option."
    )


_NAMED_COLORS = {
    "white": (255, 255, 255), "black": (0, 0, 0), "red": (255, 0, 0),
    "green": (0, 128, 0), "blue": (0, 0, 255), "yellow": (234, 179, 8),
    "purple": (168, 85, 247), "gray": (128, 128, 128), "grey": (128, 128, 128),
    "cyan": (0, 255, 255), "magenta": (255, 0, 255), "orange": (249, 115, 22),
    "pink": (236, 72, 153),
}


def parse_color(value: str) -> Tuple[int, int, int]:
    """Colour name or #RGB / #RRGGBB to an RGB tuple; ProcessingError if invalid."""
    text = (value or "").strip().lower()
    if text in _NAMED_COLORS:
        return _NAMED_COLORS[text]
    hex_part = text[1:] if text.startswith("#") else text
    if len(hex_part) == 3:
        hex_part = "".join(c * 2 for c in hex_part)
    if len(hex_part) == 6:
        try:
            return (int(hex_part[0:2], 16), int(hex_part[2:4], 16), int(hex_part[4:6], 16))
        except ValueError:
            pass
    raise ProcessingError(
        f"'{value}' is not a valid colour. Use a name such as white or black, "
        "or a hex code such as #FF8800."
    )


def strip_jpeg_exif(data: bytes) -> bytes:
    """Remove EXIF/XMP (APP1) segments from JPEG bytes without re-encoding."""
    if data[:2] != b"\xff\xd8":
        return data
    out = bytearray(data[:2])
    pos = 2
    while pos + 4 <= len(data):
        if data[pos] != 0xFF:
            break
        marker = data[pos + 1]
        if marker == 0xDA:  # start of scan: the rest is image data
            break
        length = int.from_bytes(data[pos + 2:pos + 4], "big")
        segment = data[pos:pos + 2 + length]
        if not (marker == 0xE1 and (segment[4:10] == b"Exif\x00\x00" or b"xap" in segment[4:32])):
            out += segment
        pos += 2 + length
    out += data[pos:]
    return bytes(out)
