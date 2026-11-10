"""Image watermark processor (text or image watermark)."""

import asyncio
import io
import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageSequence

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.image._common import (
    human_error,
    is_animated,
    open_image,
    parse_color,
    prepare_still,
    upright,
)

# Font files in order of preference (matched by file name anywhere under
# /usr/share/fonts). The first font that has every character of the text wins,
# so Latin text uses Noto Sans and Thai / Arabic / CJK / Devanagari fall through
# to a font that covers them.
FONT_FILES = [
    "NotoSans-Bold.ttf", "NotoSans-Regular.ttf",
    "NotoSansThai-Bold.ttf", "NotoSansThai-Regular.ttf", "NotoSansThaiUI-Regular.ttf",
    "NotoSansArabic-Bold.ttf", "NotoSansArabic-Regular.ttf", "NotoNaskhArabic-Bold.ttf",
    "NotoSansDevanagari-Bold.ttf", "NotoSansDevanagari-Regular.ttf",
    "NotoSansCJK-Bold.ttc", "NotoSansCJK-Regular.ttc",
    "DejaVuSans-Bold.ttf", "DejaVuSans.ttf",
    "LiberationSans-Bold.ttf", "LiberationSans-Regular.ttf",
    "Loma-Bold.ttf", "Garuda-Bold.ttf", "Loma.ttf", "Garuda.ttf",
    "Amiri-Bold.ttf", "Amiri-Regular.ttf",
    "DroidSansFallbackFull.ttf", "FreeSansBold.ttf", "FreeSans.ttf",
]

POSITIONS = {
    "top-left": (0, 0), "top-center": (1, 0), "top-right": (2, 0),
    "center-left": (0, 1), "center": (1, 1), "center-right": (2, 1),
    "bottom-left": (0, 2), "bottom-center": (1, 2), "bottom-right": (2, 2),
}
MAX_IMAGE_WATERMARK_BYTES = 10 * 1024 * 1024


@lru_cache(maxsize=1)
def _installed_fonts() -> List[str]:
    found: Dict[str, str] = {}
    for root in ("/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts")):
        for dirpath, _dirs, files in os.walk(root):
            for name in files:
                found.setdefault(name, os.path.join(dirpath, name))
    return [found[n] for n in FONT_FILES if n in found]


def _glyph(font: ImageFont.FreeTypeFont, ch: str) -> bytes:
    box = int(font.size * 2) + 8
    canvas = Image.new("L", (box, box), 0)
    ImageDraw.Draw(canvas).text((4, 4), ch, font=font, fill=255)
    return canvas.tobytes()


def _covers(font: ImageFont.FreeTypeFont, text: str) -> bool:
    """True if the font has a real glyph for every printable character."""
    notdef = _glyph(font, "\uffff")  # U+FFFF is never assigned: renders the .notdef box
    for ch in set(text):
        if ch.isspace() or ord(ch) < 32:
            continue
        if _glyph(font, ch) == notdef:
            return False
    return True


def pick_font(text: str, size: int) -> Tuple[ImageFont.ImageFont, str]:
    """Return (font, file name) able to draw ``text``; ProcessingError if none."""
    for path in _installed_fonts():
        try:
            font = ImageFont.truetype(path, size, index=0)
        except OSError:
            continue
        if _covers(font, text):
            return font, os.path.basename(path)
    if all(ord(c) < 128 for c in text):
        return ImageFont.load_default(size), "pillow-default"
    raise ProcessingError(
        "The watermark text contains characters that no installed font can draw "
        "(for example emoji). Please use letters, numbers or symbols."
    )


def _scaled_size(font_size: int, img_size: Tuple[int, int]) -> int:
    """font_size is defined for a 1000 px wide picture and scales with the image."""
    return max(8, round(font_size * max(img_size) / 1000))


def _text_tile(text, font_size, rgb, opacity, rotation, img_size) -> Tuple[Image.Image, Dict[str, Any]]:
    px = _scaled_size(font_size, img_size)
    font, font_name = pick_font(text, px)
    probe = ImageDraw.Draw(Image.new("L", (1, 1)))
    stroke = 0
    bbox = probe.multiline_textbbox((0, 0), text, font=font, align="center")
    pad = max(2, px // 8)
    bbox = (math.floor(bbox[0]), math.floor(bbox[1]), math.ceil(bbox[2]), math.ceil(bbox[3]))
    mask = Image.new("L", (bbox[2] - bbox[0] + 2 * pad, bbox[3] - bbox[1] + 2 * pad), 0)
    ImageDraw.Draw(mask).multiline_text(
        (pad - bbox[0], pad - bbox[1]), text, font=font, fill=255, align="center", stroke_width=stroke
    )
    alpha = mask.point(lambda v: round(v * opacity))
    tile = Image.new("RGBA", mask.size, rgb + (0,))
    tile.putalpha(alpha)
    return _rotate(tile, rotation), {"font": font_name, "font_size_px": px}


def _rotate(tile: Image.Image, rotation: int) -> Image.Image:
    # The page preview rotates clockwise (CSS); Pillow's angle is counter-clockwise
    if rotation % 360 == 0:
        return tile
    return tile.rotate(-rotation, resample=Image.Resampling.BICUBIC, expand=True)


def _image_tile(data: bytes, scale_pct: int, opacity: float, rotation: int, img_size) -> Image.Image:
    if len(data) > MAX_IMAGE_WATERMARK_BYTES:
        raise ProcessingError("The watermark image is too large (maximum 10 MB).")
    try:
        with Image.open(io.BytesIO(data)) as logo:
            logo.load()
            logo = upright(logo)
            logo, _, _ = prepare_still(logo, keep_alpha=True)
            logo = logo.convert("RGBA")
    except Exception:
        raise ProcessingError("The watermark image could not be read. Please use a PNG, JPG or WebP file.")
    target_w = max(8, round(img_size[0] * scale_pct / 100))
    target_h = max(1, round(logo.height * target_w / logo.width))
    logo = logo.resize((target_w, target_h), Image.Resampling.LANCZOS)
    alpha = logo.getchannel("A").point(lambda v: round(v * opacity))
    logo.putalpha(alpha)
    return _rotate(logo, rotation)


def _place(base: Image.Image, tile: Image.Image, x: int, y: int) -> None:
    """Alpha-composite ``tile`` onto RGBA ``base`` at (x, y), clipping at the edges."""
    left, top = max(0, x), max(0, y)
    right, bottom = min(base.width, x + tile.width), min(base.height, y + tile.height)
    if right <= left or bottom <= top:
        return
    part = tile.crop((left - x, top - y, right - x, bottom - y))
    region = base.crop((left, top, right, bottom))
    base.paste(Image.alpha_composite(region, part), (left, top))


def _apply(base: Image.Image, tile: Image.Image, position: str, tiled: bool) -> None:
    w, h = base.size
    if tiled:
        step_x = round(tile.width * 1.6)
        step_y = round(tile.height * 2.4)
        for row, y in enumerate(range(-tile.height // 2, h, step_y)):
            shift = step_x // 2 if row % 2 else 0
            for x in range(-tile.width // 2 + shift - step_x, w, step_x):
                _place(base, tile, x, y)
        return
    col, row = POSITIONS[position]
    margin = max(8, round(0.04 * min(w, h)))
    x = (margin, (w - tile.width) // 2, w - tile.width - margin)[col]
    y = (margin, (h - tile.height) // 2, h - tile.height - margin)[row]
    _place(base, tile, x, y)


def normalize_position(position: Optional[str]) -> str:
    p = (position or "center").strip().lower().replace("_", "-").replace(" ", "-")
    p = {"middle": "center", "centre": "center", "middle-center": "center"}.get(p, p)
    if p in POSITIONS or p in ("tile", "tiled"):
        return p
    raise ProcessingError(
        "Unknown position '%s'. Use one of: %s, or tile." % (position, ", ".join(POSITIONS))
    )


class ImageWatermark(BaseProcessor):
    """Add a text or image watermark to images."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        text: str = "",
        position: str = "center",
        opacity: float = 0.3,
        font_size: int = 40,
        color: str = "white",
        rotation: int = 0,
        tile: bool = False,
        watermark_image: Optional[bytes] = None,
        image_scale: int = 20,
    ) -> Dict[str, Any]:
        """
        Add watermark to image.

        Args:
            file: Input image file path
            output_path: Output file path (extension decides the format)
            text: Watermark text (any script the installed fonts support)
            position: top-left, top-center, top-right, center-left, center,
                center-right, bottom-left, bottom-center, bottom-right, or tile
            opacity: 0.0 to 1.0
            font_size: Size in px for a 1000 px wide image; it scales with the
                picture so the watermark looks the same on every resolution
            color: Colour name or hex code
            rotation: Degrees, clockwise (as in the page preview)
            tile: Repeat the watermark across the whole image
            watermark_image: Bytes of a logo to use instead of text
            image_scale: Logo width as a percent of the image width

        Returns:
            Stats dict (font used, size in pixels, flags).
        """
        if not (text or "").strip() and not watermark_image:
            raise ProcessingError("Enter the watermark text (or upload a watermark image).")
        position = normalize_position(position)
        rgb = parse_color(color)
        opacity = min(1.0, max(0.0, float(opacity)))
        try:
            return await asyncio.to_thread(
                self._watermark, file, output_path, text.strip(), position, opacity,
                font_size, rgb, rotation, tile or position in ("tile", "tiled"),
                watermark_image, image_scale,
            )
        except ProcessingError:
            raise
        except Exception as e:
            raise human_error(e, "add a watermark to")

    def _watermark(self, file, output_path, text, position, opacity, font_size, rgb,
                   rotation, tiled, logo, image_scale):
        ext = output_path.suffix.lower()
        with open_image(file) as img:
            src_format = img.format
            multi = is_animated(img)
            animated = multi and ext == ".webp"
            src_alpha = img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info
            sampling = None
            if src_format == "JPEG":
                from PIL import JpegImagePlugin
                sampling = JpegImagePlugin.get_sampling(img)  # 0 = 4:4:4, 1 = 4:2:2, 2 = 4:2:0
            if animated:
                frames = [f.convert("RGBA") for f in ImageSequence.Iterator(img)]
                durations = [f.info.get("duration", 100) for f in ImageSequence.Iterator(img)]
                loop = img.info.get("loop", 0)
                icc, exif = img.info.get("icc_profile"), None
                size = img.size
            else:
                base_img, icc, exif = prepare_still(img, keep_alpha=True)
                frames, size = [base_img.convert("RGBA")], base_img.size

            if logo:
                wm = _image_tile(logo, image_scale, opacity, rotation, size)
                stats: Dict[str, Any] = {"watermark_type": "image"}
            else:
                wm, stats = _text_tile(text, font_size, rgb, opacity, rotation, size)
                stats["watermark_type"] = "text"
            for f in frames:
                _apply(f, wm, position, tiled)
            stats.update({
                "position": "tile" if tiled else position,
                "animation_dropped": multi and not animated,
            })

            kw: Dict[str, Any] = {}
            if icc:
                kw["icc_profile"] = icc
            if ext in (".jpg", ".jpeg"):
                if exif:
                    kw["exif"] = exif
                out = frames[0].convert("RGB")
                # Match the source's chroma subsampling so size and look stay close
                out.save(output_path, "JPEG", quality=95, optimize=True, progressive=True,
                         subsampling=sampling if sampling in (0, 1, 2) else 0, **kw)
            elif ext == ".webp":
                if animated:
                    frames[0].save(output_path, "WEBP", save_all=True, append_images=frames[1:],
                                   duration=durations, loop=loop, quality=92, method=4, **kw)
                else:
                    frames[0].save(output_path, "WEBP", quality=92, method=5, **kw)
            else:
                out = frames[0] if src_alpha else frames[0].convert("RGB")
                out.save(output_path, "PNG", optimize=True, **kw)
        return stats
