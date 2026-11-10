"""
Image processing endpoints - Clean version.

Uses TaskHandler for minimal boilerplate.
"""

from typing import Any, Awaitable, Callable, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.api.deps import DbSession, ImageServiceDep
from app.schemas.response import APIResponse
from app.schemas.task import TaskResponse
from app.schemas.file import ImageCompressOptions, ImageResizeOptions, ImageConvertOptions
from app.core.task_handler import handle_task

router = APIRouter()

MAX_WATERMARK_IMAGE_BYTES = 10 * 1024 * 1024


async def _run_with_stats(
    db,
    service,
    tool_type: str,
    process: Callable[[list], Awaitable[Any]],
    file: UploadFile,
    metadata: dict,
):
    """
    Run a task through the shared handler and return the processing facts
    (sizes, dimensions, compression ratio, ...) in ``data.metadata``, the same
    place the PDF compressor reports its stats.
    """
    facts: dict = {}

    async def wrapped(paths):
        result = await process(paths)
        facts.update(getattr(result, "stats", None) or {})
        metadata["result"] = dict(facts)  # also stored with the task record
        return result

    response = await handle_task(
        db, service, tool_type, process_func=wrapped, file=file, metadata=metadata
    )
    if response.data is not None and facts:
        response.data.metadata = facts
    return response


@router.post("/compress", response_model=APIResponse[TaskResponse])
async def compress_image(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file to compress"),
    quality: int = Form(default=80, ge=1, le=100, description="Quality 1-100"),
    strip_metadata: bool = Form(default=True, description="Remove EXIF/GPS data (orientation is applied, ICC profile kept)"),
):
    """
    Compress image to reduce file size. The format is kept (JPEG, PNG, WebP, GIF).

    `data.metadata` reports original_size, compressed_size, saved_bytes and
    compression_ratio (percent saved); if the image cannot be made smaller the
    original bytes are returned and `kept_original` is true.
    """
    return await _run_with_stats(
        db, service, "image_compress",
        lambda paths: service.compress(
            paths[0], ImageCompressOptions(quality=quality, strip_metadata=strip_metadata)
        ),
        file,
        {"quality": quality, "strip_metadata": strip_metadata},
    )


@router.post("/resize", response_model=APIResponse[TaskResponse])
async def resize_image(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file to resize"),
    width: int = Form(None, ge=1, le=10000, description="Target width"),
    height: int = Form(None, ge=1, le=10000, description="Target height"),
    maintain_ratio: bool = Form(default=True, description="Maintain aspect ratio"),
    fit: str = Form(default=None, description="contain, cover (fill + crop) or exact; overrides maintain_ratio"),
    percentage: float = Form(default=None, gt=0, le=1000, description="Scale by percent instead of width/height"),
    no_upscale: bool = Form(default=False, description="Never enlarge beyond the source size"),
    quality: int = Form(default=90, ge=1, le=100, description="JPEG/WebP output quality"),
):
    """Resize image to specified dimensions."""
    if width is None and height is None and percentage is None:
        raise HTTPException(status_code=400, detail="Provide width or height")
    if fit is not None and fit not in ("contain", "cover", "exact"):
        raise HTTPException(status_code=400, detail="fit must be contain, cover or exact")

    return await _run_with_stats(
        db, service, "image_resize",
        lambda paths: service.resize(
            paths[0],
            ImageResizeOptions(
                width=width, height=height, maintain_ratio=maintain_ratio, fit=fit,
                percentage=percentage, no_upscale=no_upscale, quality=quality,
            ),
        ),
        file,
        {"width": width, "height": height, "maintain_ratio": maintain_ratio},
    )


@router.post("/convert", response_model=APIResponse[TaskResponse])
async def convert_image(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file to convert"),
    format: str = Form(..., description="Target: jpg, png, webp, gif"),
    quality: int = Form(default=90, ge=1, le=100, description="Quality 1-100 (WebP 100 = lossless)"),
    background: str = Form(default=None, description="Colour that replaces transparency for JPG (default white)"),
):
    """Convert image to different format."""
    valid_formats = ["jpg", "jpeg", "png", "webp", "gif"]
    if format.lower() not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Invalid format. Use: {valid_formats}")

    return await _run_with_stats(
        db, service, "image_convert",
        lambda paths: service.convert(
            paths[0],
            ImageConvertOptions(format=format, quality=quality, background=background or None),
        ),
        file,
        {"format": format, "quality": quality},
    )


@router.post("/remove-background", response_model=APIResponse[TaskResponse])
async def remove_background(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file"),
    bg_color: str = Form(default=None, description="Background color: transparent (default), white, black, or hex #RRGGBB"),
    output_format: str = Form(default="png", description="Output format: png, jpeg, webp"),
    quality: int = Form(default=90, ge=1, le=100, description="Quality for JPEG/WebP (1-100)"),
    fast_mode: bool = Form(default=False, description="Fast mode: skip alpha matting and post-processing for quicker results"),
):
    """
    Remove background from image using AI.

    Automatically detects and removes background from any image -
    works for people, products, animals, and objects.

    - **bg_color**: Background color
      - None/empty: Transparent (PNG only)
      - white, black: Named colors
      - #RRGGBB: Custom hex color
    - **output_format**: Output format (png, jpeg, webp)
    - **quality**: Quality for JPEG/WebP (1-100)
    - **fast_mode**: Skip alpha matting for faster processing (less detail on hair/edges)
    """
    return await _run_with_stats(
        db, service, "image_remove_bg",
        lambda paths: service.remove_background(
            paths[0],
            bg_color=bg_color if bg_color else None,
            output_format=output_format,
            quality=quality,
            fast_mode=fast_mode,
        ),
        file,
        {
            "bg_color": bg_color,
            "output_format": output_format,
            "quality": quality,
            "fast_mode": fast_mode,
        },
    )


@router.post("/watermark", response_model=APIResponse[TaskResponse])
async def add_watermark(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file"),
    text: str = Form(default="", description="Watermark text (any script the installed fonts support)"),
    position: str = Form(default="center", description="top|center|bottom x left|center|right (e.g. top-left, center, bottom-right) or tile"),
    opacity: float = Form(default=0.3, ge=0.1, le=1.0),
    font_size: int = Form(default=40, ge=10, le=200, description="Size for a 1000 px wide picture; scales with the image"),
    color: str = Form(default="white", description="Colour name or hex code"),
    rotation: int = Form(default=0, ge=0, le=360, description="Degrees, clockwise"),
    tile: bool = Form(default=False, description="Repeat the watermark over the whole image"),
    watermark_image: Optional[UploadFile] = File(default=None, description="Logo to use instead of text"),
    image_scale: int = Form(default=20, ge=2, le=100, description="Logo width as percent of the image width"),
):
    """Add a text (or image) watermark to image."""
    logo = None
    if watermark_image is not None and watermark_image.filename:
        logo = await watermark_image.read(MAX_WATERMARK_IMAGE_BYTES + 1)
        if len(logo) > MAX_WATERMARK_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="The watermark image is too large (maximum 10 MB).")
    if not text.strip() and not logo:
        raise HTTPException(status_code=400, detail="Enter the watermark text (or upload a watermark image).")

    return await _run_with_stats(
        db, service, "image_watermark",
        lambda paths: service.add_watermark(
            paths[0], text, position, opacity, font_size, color, rotation,
            tile=tile, watermark_image=logo, image_scale=image_scale,
        ),
        file,
        {"text": text, "position": position},
    )
