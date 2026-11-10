"""Quality and correctness tests for the image tools (compress, resize, convert,
remove background, watermark).

Fixtures are built with Pillow so every expectation has a known ground truth:
orientation is checked by where coloured corner markers end up, colour by pixel
values, transparency by alpha values, size by byte counts.
"""

import io
import os
from pathlib import Path

import numpy as np
import pytest
from httpx import AsyncClient
from PIL import Image, ImageCms, ImageDraw

from app.core.exceptions import ProcessingError
from app.processors.image import _common
from app.processors.image.background_remover import BackgroundRemover
from app.processors.image.compressor import ImageCompressor
from app.processors.image.converter import ImageConverter
from app.processors.image.resizer import ImageResizer, compute_size
from app.processors.image.watermark import ImageWatermark, _installed_fonts, pick_font

RED, GREEN, BLUE = (255, 0, 0), (0, 255, 0), (0, 0, 255)


# --------------------------------------------------------------------- helpers


def upright_image(w: int = 400, h: int = 300) -> Image.Image:
    """Gradient + noise with red top-left, green top-right, blue bottom-left markers."""
    rng = np.random.default_rng(7)
    y, x = np.mgrid[0:h, 0:w]
    a = np.stack([x / w * 200 + 30, y / h * 180 + 40, (x + y) / (w + h) * 150 + 60], -1)
    a += rng.normal(0, 5, a.shape)
    im = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    d, s = ImageDraw.Draw(im), h // 6
    d.rectangle([0, 0, s, s], fill=RED)
    d.rectangle([w - s, 0, w, s], fill=GREEN)
    d.rectangle([0, h - s, s, h], fill=BLUE)
    return im


def corner_colours(im: Image.Image) -> dict:
    im = im.convert("RGB")
    w, h = im.size
    s = max(2, h // 12)
    return {
        "TL": im.getpixel((s // 2, s // 2)),
        "TR": im.getpixel((w - s // 2 - 1, s // 2)),
        "BL": im.getpixel((s // 2, h - s // 2 - 1)),
    }


def assert_upright(im: Image.Image) -> None:
    """Red marker top-left, green top-right, blue bottom-left (landscape)."""
    c = corner_colours(im)
    assert im.width > im.height, f"expected landscape, got {im.size}"
    assert c["TL"][0] > 200 and c["TL"][1] < 80 and c["TL"][2] < 80, c
    assert c["TR"][1] > 200 and c["TR"][0] < 80, c
    assert c["BL"][2] > 200 and c["BL"][0] < 80, c


def make_oriented(path: Path, orientation: int, with_icc: bool = False, gps: bool = False) -> Path:
    """Save the upright picture the way a camera would for the given EXIF orientation."""
    inverse = {
        3: Image.Transpose.ROTATE_180,
        6: Image.Transpose.ROTATE_90,
        8: Image.Transpose.ROTATE_270,
    }[orientation]
    stored = upright_image().transpose(inverse)
    exif = Image.Exif()
    exif[0x0112] = orientation
    if gps:
        exif[0x8825] = {1: "S", 2: (6.0, 0.0, 0.0), 3: "E", 4: (106.0, 0.0, 0.0)}
    kwargs = {"exif": exif}
    if with_icc:
        kwargs["icc_profile"] = srgb_icc()
    stored.save(path, **({"quality": 90} if path.suffix == ".jpg" else {}), **kwargs)
    return path


_SRGB_ICC = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def srgb_icc() -> bytes:
    # Built once: createProfile() stamps the creation time into the header
    return _SRGB_ICC


async def run(proc, *args, **kwargs):
    return await proc.execute(*args, **kwargs)


def rembg_model_available() -> bool:
    home = os.environ.get("U2NET_HOME") or os.path.join(os.path.expanduser("~"), ".u2net")
    return os.path.exists(os.path.join(home, "u2net_human_seg.onnx"))


# -------------------------------------------------------------------- compress


@pytest.mark.asyncio
@pytest.mark.parametrize("orientation", [3, 6, 8])
async def test_compress_applies_orientation_and_drops_tag(tmp_path, orientation):
    src = make_oriented(tmp_path / "in.jpg", orientation)
    out = tmp_path / "out.jpg"
    await ImageCompressor(tmp_path).execute(src, out, 60)
    with Image.open(out) as im:
        assert im.getexif().get(0x0112) in (None, 1)
        assert_upright(im)


@pytest.mark.asyncio
async def test_compress_keeps_icc_and_strips_gps(tmp_path):
    src = make_oriented(tmp_path / "in.jpg", 6, with_icc=True, gps=True)
    out = tmp_path / "out.jpg"
    stats = await ImageCompressor(tmp_path).execute(src, out, 60)
    with Image.open(out) as im:
        assert im.info.get("icc_profile") == srgb_icc()
        assert not im.getexif().get_ifd(0x8825)
    assert stats["metadata_removed"] is True and stats["had_location_data"] is True

    out2 = tmp_path / "out2.jpg"
    await ImageCompressor(tmp_path).execute(src, out2, 60, strip_metadata=False)
    with Image.open(out2) as im:
        assert im.getexif().get_ifd(0x8825), "strip_metadata=False must keep GPS"
        assert im.getexif().get(0x0112) in (None, 1), "orientation must never be left behind"


@pytest.mark.asyncio
async def test_compress_never_larger_and_stats_are_honest(tmp_path):
    src = tmp_path / "in.jpg"
    upright_image().save(src, quality=60)  # already small: re-encoding at 95 would grow it
    out = tmp_path / "out.jpg"
    stats = await ImageCompressor(tmp_path).execute(src, out, 95)
    assert out.stat().st_size <= src.stat().st_size
    assert stats["compressed_size"] == out.stat().st_size
    assert stats["original_size"] == src.stat().st_size
    assert stats["saved_bytes"] == stats["original_size"] - stats["compressed_size"]
    assert stats["kept_original"] is True
    assert out.read_bytes() != b""


@pytest.mark.asyncio
async def test_compress_quality_changes_size(tmp_path):
    src = tmp_path / "in.jpg"
    upright_image(800, 600).save(src, quality=95)
    sizes = []
    for q in (90, 70, 40):
        out = tmp_path / f"o{q}.jpg"
        await ImageCompressor(tmp_path).execute(src, out, q)
        sizes.append(out.stat().st_size)
    assert sizes[0] > sizes[1] > sizes[2]


@pytest.mark.asyncio
async def test_compress_png_alpha_survives_and_palette_for_strong(tmp_path):
    src = tmp_path / "soft.png"
    h = w = 200
    yy, xx = np.mgrid[0:h, 0:w]
    alpha = np.clip((80 - np.hypot(xx - 100, yy - 100)) / 20 * 255, 0, 255).astype("uint8")
    rgba = np.zeros((h, w, 4), "uint8")
    rgba[..., 0], rgba[..., 1], rgba[..., 3] = 255, 60, alpha
    Image.fromarray(rgba).save(src)

    for q in (95, 40):
        out = tmp_path / f"o{q}.png"
        await ImageCompressor(tmp_path).execute(src, out, q)
        with Image.open(out) as im:
            a = im.convert("RGBA")
            assert a.getpixel((100, 100))[3] >= 250  # palette mode may round alpha slightly
            assert a.getpixel((2, 2))[3] <= 5, "transparent corner must stay transparent"
            assert 20 < a.getpixel((100 + 70, 100))[3] < 235, "soft edge must stay soft"
    lossless = (tmp_path / "o95.png").stat().st_size
    strong = (tmp_path / "o40.png").stat().st_size
    assert strong < lossless


@pytest.mark.asyncio
async def test_compress_png_lossless_is_pixel_exact(tmp_path):
    src = tmp_path / "in.png"
    upright_image(200, 150).save(src)
    out = tmp_path / "out.png"
    await ImageCompressor(tmp_path).execute(src, out, 95)
    with Image.open(src) as a, Image.open(out) as b:
        assert np.array_equal(np.asarray(a.convert("RGB")), np.asarray(b.convert("RGB")))


@pytest.mark.asyncio
async def test_compress_16bit_grey_is_not_clipped(tmp_path):
    src = tmp_path / "g16.png"
    Image.fromarray(np.tile(np.linspace(0, 65535, 256), (64, 1)).astype("uint16")).save(src)
    for q, expected_mid in ((95, 32896), (50, 128)):
        out = tmp_path / f"o{q}.png"
        await ImageCompressor(tmp_path).execute(src, out, q)
        with Image.open(out) as im:
            assert abs(im.getpixel((128, 5)) - expected_mid) <= 600 if q == 95 else abs(im.getpixel((128, 5)) - 128) <= 2


@pytest.mark.asyncio
async def test_compress_cmyk_becomes_rgb_with_right_colours(tmp_path):
    src = tmp_path / "cmyk.jpg"
    c = Image.new("CMYK", (100, 100), (0, 0, 0, 0))
    ImageDraw.Draw(c).rectangle([0, 0, 49, 99], fill=(255, 0, 0, 0))  # cyan
    c.save(src, quality=90)
    out = tmp_path / "out.jpg"
    await ImageCompressor(tmp_path).execute(src, out, 80)
    with Image.open(out) as im:
        assert im.mode == "RGB"
        r, g, b = im.getpixel((20, 50))
        assert r < 60 and g > 200 and b > 200, "cyan must stay cyan"


@pytest.mark.asyncio
async def test_compress_keeps_animation(tmp_path):
    frames = []
    for i in range(5):
        f = Image.new("RGB", (80, 60), (240, 240, 240))
        ImageDraw.Draw(f).rectangle([i * 10, 20, i * 10 + 15, 40], fill=(200, 0, 0))
        frames.append(f)
    src = tmp_path / "a.webp"
    frames[0].save(src, save_all=True, append_images=frames[1:], duration=80, loop=0)
    out = tmp_path / "out.webp"
    stats = await ImageCompressor(tmp_path).execute(src, out, 60)
    with Image.open(out) as im:
        assert im.n_frames == 5
    assert stats["animated"] is True


# ---------------------------------------------------------------------- resize


def test_compute_size_exact_and_no_off_by_one():
    assert compute_size((1000, 667), 333, None, "contain") == (333, 222)
    assert compute_size((1000, 667), None, 333, "contain") == (499, 333)
    # the limiting side is exactly what was asked for
    assert compute_size((1000, 667), 500, 500, "contain") == (500, 334)
    assert compute_size((667, 1000), 500, 500, "contain") == (334, 500)
    assert compute_size((1000, 667), 500, 500, "exact") == (500, 500)
    assert compute_size((1000, 667), 500, 500, "cover") == (500, 500)
    assert compute_size((6000, 4000), 1, None, "contain") == (1, 1)  # never 0
    assert compute_size((500, 300), None, None, "contain", percentage=50) == (250, 150)
    assert compute_size((500, 300), 1000, None, "contain", no_upscale=True) == (500, 300)
    assert compute_size((500, 300), 1000, 1000, "exact", no_upscale=True) == (500, 300)


@pytest.mark.asyncio
@pytest.mark.parametrize("orientation", [6, 8])
async def test_resize_upright_and_dimensions(tmp_path, orientation):
    src = make_oriented(tmp_path / "in.jpg", orientation, with_icc=True)
    out = tmp_path / "out.jpg"
    stats = await ImageResizer(tmp_path).execute(src, out, width=200)
    with Image.open(out) as im:
        assert im.size == (200, 150)
        assert im.getexif().get(0x0112) in (None, 1)
        assert im.info.get("icc_profile") == srgb_icc()
        assert_upright(im)
    assert (stats["width"], stats["height"]) == (200, 150)
    assert (stats["original_width"], stats["original_height"]) == (400, 300)


@pytest.mark.asyncio
async def test_resize_cover_crops_to_exact_box(tmp_path):
    src = tmp_path / "in.png"
    upright_image().save(src)
    out = tmp_path / "out.png"
    await ImageResizer(tmp_path).execute(src, out, width=100, height=100, fit="cover")
    with Image.open(out) as im:
        assert im.size == (100, 100)


@pytest.mark.asyncio
async def test_resize_palette_png_keeps_transparency_and_16bit_works(tmp_path):
    p = Image.new("P", (100, 100), 0)
    p.putpalette([0, 0, 0, 255, 0, 0] + [0] * (254 * 3))
    ImageDraw.Draw(p).ellipse([20, 20, 80, 80], fill=1)
    src = tmp_path / "p.png"
    p.save(src, transparency=0)
    out = tmp_path / "o.png"
    await ImageResizer(tmp_path).execute(src, out, width=37)
    with Image.open(out) as im:
        a = im.convert("RGBA")
        assert a.getpixel((0, 0))[3] == 0 and a.getpixel((18, 18))[3] == 255
        assert len(set(a.getdata())) > 3, "edges must be anti-aliased, not nearest-neighbour"

    g = tmp_path / "g.png"
    Image.fromarray(np.tile(np.linspace(0, 65535, 256), (64, 1)).astype("uint16")).save(g)
    out2 = tmp_path / "g2.png"
    await ImageResizer(tmp_path).execute(g, out2, width=128)
    with Image.open(out2) as im:
        assert im.size[0] == 128 and im.getpixel((127, 5)) > 60000


@pytest.mark.asyncio
async def test_resize_animated_gif_keeps_frames(tmp_path):
    frames = [Image.new("RGB", (60, 40), (i * 40, 0, 0)) for i in range(4)]
    src = tmp_path / "a.gif"
    frames[0].save(src, save_all=True, append_images=frames[1:], duration=50, loop=0)
    out = tmp_path / "o.gif"
    stats = await ImageResizer(tmp_path).execute(src, out, width=30)
    with Image.open(out) as im:
        assert im.n_frames == 4 and im.size == (30, 20)
    assert stats["animation_dropped"] is False


@pytest.mark.asyncio
async def test_decompression_bomb_gets_a_clear_error(tmp_path, monkeypatch):
    src = tmp_path / "big.png"
    Image.new("RGB", (400, 300), "white").save(src)
    monkeypatch.setattr(_common, "MAX_INPUT_PIXELS", 10_000)
    with pytest.raises(ProcessingError) as exc:
        await ImageResizer(tmp_path).execute(src, tmp_path / "o.png", width=100)
    assert "too large" in exc.value.message.lower()
    assert "Traceback" not in exc.value.message


@pytest.mark.asyncio
async def test_requested_output_too_large_is_refused(tmp_path, monkeypatch):
    src = tmp_path / "in.png"
    Image.new("RGB", (100, 100), "white").save(src)
    monkeypatch.setattr("app.processors.image.resizer.MAX_INPUT_PIXELS", 1_000_000)
    with pytest.raises(ProcessingError) as exc:
        await ImageResizer(tmp_path).execute(src, tmp_path / "o.png", width=2000, height=2000, fit="exact")
    assert "too large" in exc.value.message.lower()


@pytest.mark.asyncio
@pytest.mark.parametrize("which", ["truncated", "text"])
async def test_corrupt_inputs_get_human_messages(tmp_path, which):
    good = tmp_path / "g.jpg"
    upright_image().save(good, quality=90)
    bad = tmp_path / "bad.jpg"
    if which == "truncated":
        bad.write_bytes(good.read_bytes()[: good.stat().st_size // 2])
    else:
        bad.write_text("not an image at all\n" * 10)
    for proc, args in (
        (ImageCompressor(tmp_path), (bad, tmp_path / "o.jpg", 80)),
        (ImageResizer(tmp_path), (bad, tmp_path / "o2.jpg")),
        (ImageConverter(tmp_path), (bad, tmp_path / "o3.png", "png")),
    ):
        kwargs = {"width": 50} if isinstance(proc, ImageResizer) else {}
        with pytest.raises(ProcessingError) as exc:
            await proc.execute(*args, **kwargs)
        msg = exc.value.message
        assert "image" in msg.lower() and "Error" not in msg and "PIL" not in msg


# --------------------------------------------------------------------- convert


@pytest.mark.asyncio
@pytest.mark.parametrize("target,pil", [("jpg", "JPEG"), ("png", "PNG"), ("webp", "WEBP"), ("gif", "GIF")])
@pytest.mark.parametrize("source", ["jpg", "png", "webp", "gif"])
async def test_convert_every_pair_and_upright(tmp_path, source, target, pil):
    src = make_oriented(tmp_path / f"in.{source}", 6) if source in ("jpg", "png", "webp") else None
    if src is None:
        src = tmp_path / "in.gif"
        upright_image().transpose(Image.Transpose.ROTATE_90).save(src)  # GIF has no EXIF
    out = tmp_path / f"out.{target}"
    await ImageConverter(tmp_path).execute(src, out, target, 85)
    with Image.open(out) as im:
        assert im.format == pil
        if source != "gif":
            assert_upright(im)


@pytest.mark.asyncio
async def test_convert_transparency_rules(tmp_path):
    src = tmp_path / "soft.png"
    h = w = 100
    rgba = np.zeros((h, w, 4), "uint8")
    rgba[..., 0], rgba[..., 1] = 255, 60
    rgba[20:80, 20:80, 3] = 255
    Image.fromarray(rgba).save(src)

    out = tmp_path / "o.jpg"
    stats = await ImageConverter(tmp_path).execute(src, out, "jpg", 90)
    with Image.open(out) as im:
        assert min(im.getpixel((2, 2))) > 240, "transparent area must become white, not black"
    assert stats["flattened_transparency"] is True

    out = tmp_path / "o2.jpg"
    await ImageConverter(tmp_path).execute(src, out, "jpg", 90, background="#00ff00")
    with Image.open(out) as im:
        r, g, b = im.getpixel((2, 2))
        assert g > 200 and r < 60

    for fmt in ("webp", "png", "gif"):
        out = tmp_path / f"o.{fmt}"
        await ImageConverter(tmp_path).execute(src, out, fmt, 90)
        with Image.open(out) as im:
            a = im.convert("RGBA")
            assert a.getpixel((2, 2))[3] == 0, fmt
            assert a.getpixel((50, 50))[3] == 255, fmt


@pytest.mark.asyncio
async def test_convert_16bit_and_cmyk(tmp_path):
    g = tmp_path / "g.png"
    Image.fromarray(np.tile(np.linspace(0, 65535, 256), (32, 1)).astype("uint16")).save(g)
    out = tmp_path / "g.jpg"
    await ImageConverter(tmp_path).execute(g, out, "jpg", 95)
    with Image.open(out) as im:
        assert abs(im.getpixel((128, 5)) - 128) <= 3, "16-bit grey must be scaled, not clipped to white"
    out = tmp_path / "g2.png"
    await ImageConverter(tmp_path).execute(g, out, "png")
    with Image.open(out) as im:
        assert im.mode.startswith("I")

    c = tmp_path / "c.jpg"
    Image.new("CMYK", (40, 40), (0, 255, 255, 0)).save(c)  # red
    for fmt in ("png", "webp", "gif", "jpg"):
        out = tmp_path / f"c.{fmt}"
        await ImageConverter(tmp_path).execute(c, out, fmt, 90)
        with Image.open(out) as im:
            r, gg, b = im.convert("RGB").getpixel((20, 20))
            assert r > 200 and gg < 60 and b < 60, fmt


@pytest.mark.asyncio
async def test_convert_animation_rules(tmp_path):
    frames = [Image.new("RGB", (60, 40), (i * 50, 0, 0)) for i in range(4)]
    src = tmp_path / "a.gif"
    frames[0].save(src, save_all=True, append_images=frames[1:], duration=50, loop=0)
    out = tmp_path / "a.webp"
    stats = await ImageConverter(tmp_path).execute(src, out, "webp", 80)
    with Image.open(out) as im:
        assert im.n_frames == 4
    assert stats["animation_dropped"] is False
    stats = await ImageConverter(tmp_path).execute(src, tmp_path / "a.png", "png")
    assert stats["animation_dropped"] is True


@pytest.mark.asyncio
async def test_convert_quality_is_honoured(tmp_path):
    src = tmp_path / "in.png"
    upright_image(500, 400).save(src)
    sizes = []
    for q in (95, 60, 20):
        out = tmp_path / f"o{q}.webp"
        await ImageConverter(tmp_path).execute(src, out, "webp", q)
        sizes.append(out.stat().st_size)
    assert sizes[0] > sizes[1] > sizes[2]


@pytest.mark.asyncio
async def test_convert_rejects_unknown_format(tmp_path):
    src = tmp_path / "in.png"
    Image.new("RGB", (10, 10)).save(src)
    with pytest.raises(ProcessingError) as exc:
        await ImageConverter(tmp_path).execute(src, tmp_path / "o.heic", "heic")
    assert "Unsupported format" in exc.value.message


# ------------------------------------------------------------------- watermark


def _diff_box(a: Path, b: Path):
    with Image.open(a) as x, Image.open(b) as y:
        d = np.abs(np.asarray(x.convert("RGB")).astype(int) - np.asarray(y.convert("RGB")).astype(int)).sum(2)
    ys, xs = np.nonzero(d > 24)
    return (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "position,col,row",
    [(f"{v}-{h}" if (v, h) != ("center", "center") else "center", c, r)
     for r, v in enumerate(("top", "center", "bottom"))
     for c, h in enumerate(("left", "center", "right"))],
)
async def test_watermark_nine_positions(tmp_path, position, col, row):
    src = tmp_path / "in.png"
    Image.new("RGB", (600, 400), (90, 90, 90)).save(src)
    out = tmp_path / "o.png"
    await ImageWatermark(tmp_path).execute(src, out, "TEST", position, 1.0, 40, "white")
    box = _diff_box(src, out)
    assert box, "watermark must be visible"
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    assert abs(cx - (600 / 6 * (1 + 2 * col))) < 600 / 3.2 * (0.5 if col == 1 else 0.6), (position, box)
    assert abs(cy - (400 / 6 * (1 + 2 * row))) < 400 / 3.2 * (0.5 if row == 1 else 0.6), (position, box)
    assert box[0] >= 0 and box[2] < 600 and box[1] >= 0 and box[3] < 400


@pytest.mark.asyncio
async def test_watermark_size_scales_with_image(tmp_path):
    widths = {}
    for w in (500, 2000):
        src = tmp_path / f"in{w}.png"
        Image.new("RGB", (w, w * 3 // 4), (90, 90, 90)).save(src)
        out = tmp_path / f"o{w}.png"
        await ImageWatermark(tmp_path).execute(src, out, "PDFGlide", "center", 1.0, 40, "white")
        box = _diff_box(src, out)
        widths[w] = (box[2] - box[0]) / w
    assert abs(widths[500] - widths[2000]) < 0.01, widths


@pytest.mark.asyncio
async def test_watermark_rotation_stays_where_asked(tmp_path):
    src = tmp_path / "in.png"
    Image.new("RGB", (600, 400), (90, 90, 90)).save(src)
    out = tmp_path / "o.png"
    await ImageWatermark(tmp_path).execute(src, out, "CONFIDENTIAL", "bottom-right", 1.0, 40, "white", 45)
    box = _diff_box(src, out)
    assert box[2] < 600 and box[3] < 400, "rotated text must not be cut off by the image edge"
    assert box[0] > 300 and box[1] > 150, "must stay in the bottom-right quadrant"


@pytest.mark.asyncio
async def test_watermark_opacity_and_colour(tmp_path):
    src = tmp_path / "in.png"
    Image.new("RGB", (300, 200), (0, 0, 0)).save(src)
    for opacity in (0.3, 1.0):
        out = tmp_path / f"o{opacity}.png"
        await ImageWatermark(tmp_path).execute(src, out, "MMMM", "center", opacity, 60, "yellow")
        with Image.open(out) as im:
            peak = max(im.getdata())
        assert abs(peak[0] / 255 - opacity * 234 / 255) < 0.04, peak  # yellow is (234, 179, 8)
    with pytest.raises(ProcessingError):
        await ImageWatermark(tmp_path).execute(src, tmp_path / "x.png", "A", "center", 1.0, 40, "notacolour")
    with pytest.raises(ProcessingError):
        await ImageWatermark(tmp_path).execute(src, tmp_path / "x.png", "A", "upper-middle", 1.0, 40, "white")


@pytest.mark.asyncio
async def test_watermark_keeps_orientation_alpha_format(tmp_path):
    src = make_oriented(tmp_path / "in.jpg", 6, with_icc=True)
    out = tmp_path / "o.jpg"
    await ImageWatermark(tmp_path).execute(src, out, "TEST", "center", 0.5, 40, "white")
    with Image.open(out) as im:
        assert im.format == "JPEG" and im.getexif().get(0x0112) in (None, 1)
        assert im.info.get("icc_profile") == srgb_icc()
        assert_upright(im)

    rgba = tmp_path / "in.png"
    Image.new("RGBA", (200, 100), (255, 0, 0, 0)).save(rgba)
    out = tmp_path / "o.png"
    await ImageWatermark(tmp_path).execute(rgba, out, "A", "center", 1.0, 60, "white")
    with Image.open(out) as im:
        assert im.mode == "RGBA" and im.getpixel((2, 2))[3] == 0, "transparent areas stay transparent"


@pytest.mark.asyncio
async def test_watermark_tile_and_logo(tmp_path):
    src = tmp_path / "in.png"
    Image.new("RGB", (600, 400), (90, 90, 90)).save(src)
    out = tmp_path / "t.png"
    await ImageWatermark(tmp_path).execute(src, out, "DRAFT", "center", 1.0, 30, "white", 30, tile=True)
    box = _diff_box(src, out)
    assert box[0] < 60 and box[2] > 540 and box[1] < 60 and box[3] > 340, "tile must cover the image"

    logo = io.BytesIO()
    Image.new("RGBA", (100, 50), (255, 0, 0, 255)).save(logo, "PNG")
    out = tmp_path / "l.png"
    stats = await ImageWatermark(tmp_path).execute(
        src, out, "", "bottom-right", 1.0, 40, "white", 0, watermark_image=logo.getvalue(), image_scale=20
    )
    assert stats["watermark_type"] == "image"
    box = _diff_box(src, out)
    assert abs((box[2] - box[0] + 1) - 120) <= 2  # 20 % of 600 px


def _have_font_for(sample: str) -> bool:
    try:
        pick_font(sample, 30)
        return True
    except ProcessingError:
        return False


@pytest.mark.asyncio
@pytest.mark.parametrize("sample", ["สวัสดี", "版权所有", "مرحبا", "नमस्ते"])
async def test_watermark_non_latin_text_is_not_boxes(tmp_path, sample):
    """Either a font draws the text, or the user gets a clear error: never boxes."""
    src = tmp_path / "in.png"
    Image.new("RGB", (600, 300), (0, 0, 0)).save(src)
    names = {Path(p).name for p in _installed_fonts()}
    script_fonts = {
        "สวัสดี": ("NotoSansThai", "Garuda", "Loma"),
        "版权所有": ("NotoSansCJK", "DroidSansFallback"),
        "مرحبا": ("NotoSansArabic", "Amiri", "DejaVu", "NotoNaskh"),
        "नमस्ते": ("NotoSansDevanagari",),
    }[sample]
    if not any(n.startswith(p) for n in names for p in script_fonts):
        pytest.skip("no font for this script in this image")
    out = tmp_path / "o.png"
    stats = await ImageWatermark(tmp_path).execute(src, out, sample, "center", 1.0, 60, "white")
    assert stats["font"] != "pillow-default"
    # A font box (.notdef) would repeat the same glyph; real text has varied columns
    box = _diff_box(src, out)
    assert box and (box[2] - box[0]) > 40


# ------------------------------------------------------------- remove background


@pytest.mark.skipif(not rembg_model_available(), reason="rembg model files not available here")
@pytest.mark.asyncio
async def test_remove_background_real_alpha_original_size_and_upright(tmp_path):
    src = tmp_path / "in.jpg"
    # A person-like blob; the exact mask does not matter here, the pipeline contract does
    im = Image.new("RGB", (900, 600), (30, 120, 200))
    d = ImageDraw.Draw(im)
    d.ellipse([350, 80, 550, 300], fill=(220, 170, 140))
    d.rectangle([300, 300, 600, 600], fill=(200, 30, 30))
    exif = Image.Exif()
    exif[0x0112] = 6
    im.transpose(Image.Transpose.ROTATE_90).save(src, quality=95, exif=exif, icc_profile=srgb_icc())
    out = tmp_path / "o.png"
    result = await BackgroundRemover(tmp_path).execute(src, out, fast_mode=True)
    with Image.open(result) as r:
        assert r.mode == "RGBA" and r.size == (900, 600), "original resolution, upright"
        assert r.info.get("icc_profile") == srgb_icc()
        alpha = np.asarray(r.getchannel("A"))
        assert alpha.min() == 0 or alpha.max() == 255
    out_jpg = await BackgroundRemover(tmp_path).execute(
        src, tmp_path / "x.jpg", bg_color="#336699", output_format="jpeg", fast_mode=True
    )
    assert out_jpg.suffix == ".jpg"
    with pytest.raises(ProcessingError):
        await BackgroundRemover(tmp_path).execute(src, tmp_path / "y.png", bg_color="nonsense")


# ------------------------------------------------------------------------- API


async def _post(client: AsyncClient, url: str, path: Path, name: str, ctype: str, **data):
    with open(path, "rb") as f:
        return await client.post(url, files=[("file", (name, f, ctype))], data={k: str(v) for k, v in data.items()})


@pytest.mark.asyncio
async def test_api_compress_reports_stats_like_pdf(client: AsyncClient, tmp_path):
    src = tmp_path / "in.jpg"
    upright_image(800, 600).save(src, quality=95)
    r = await _post(client, "/api/v1/image/compress", src, "photo.jpg", "image/jpeg", quality=60)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    meta = data["metadata"]
    assert meta["original_size"] == src.stat().st_size
    assert meta["compressed_size"] == data["file_size"]
    assert meta["saved_bytes"] == meta["original_size"] - meta["compressed_size"]
    assert meta["compression_ratio"] == pytest.approx((1 - meta["compressed_size"] / meta["original_size"]) * 100, abs=0.1)
    assert data["file_name"].endswith(".jpg")


@pytest.mark.asyncio
async def test_api_output_follows_content_not_file_name(client: AsyncClient, tmp_path):
    """A PNG uploaded as .jpg must come back as a PNG with a .png name and image/png bytes."""
    src = tmp_path / "x.png"
    upright_image(200, 150).save(src)
    r = await _post(client, "/api/v1/image/compress", src, "liar.jpg", "image/png", quality=50)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["file_name"].endswith(".png")
    dl = await client.get(data["download_url"])
    assert dl.status_code == 200 and dl.content[:8] == b"\x89PNG\r\n\x1a\n"


@pytest.mark.asyncio
async def test_api_resize_convert_watermark_metadata_and_errors(client: AsyncClient, tmp_path):
    src = make_oriented(tmp_path / "in.jpg", 6)
    r = await _post(client, "/api/v1/image/resize", src, "a.jpg", "image/jpeg", width=200)
    assert r.status_code == 200, r.text
    meta = r.json()["data"]["metadata"]
    assert (meta["width"], meta["height"]) == (200, 150)

    r = await _post(client, "/api/v1/image/convert", src, "a.jpg", "image/jpeg", format="webp", quality=80)
    d = r.json()["data"]
    assert d["file_name"].endswith(".webp")
    dl = await client.get(d["download_url"])
    assert dl.headers["content-type"].startswith("image/webp")

    r = await _post(client, "/api/v1/image/watermark", src, "a.jpg", "image/jpeg",
                    text="PDFGlide", position="bottom-center", color="purple", font_size=40, opacity=0.5)
    assert r.status_code == 200, r.text
    assert r.json()["data"]["metadata"]["position"] == "bottom-center"

    r = await _post(client, "/api/v1/image/watermark", src, "a.jpg", "image/jpeg", text="x", position="nowhere")
    assert r.status_code in (400, 422) and "position" in r.json()["error"].lower()

    # a text file pretending to be a JPEG is refused with a readable message
    fake = tmp_path / "fake.jpg"
    fake.write_text("hello " * 50)
    r = await _post(client, "/api/v1/image/compress", fake, "fake.jpg", "image/jpeg")
    assert r.status_code == 400 and r.json()["error"]
    assert "Traceback" not in r.json()["error"]
