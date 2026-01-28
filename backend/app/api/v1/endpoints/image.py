"""
Image processing endpoints - Clean version.

Uses TaskHandler for minimal boilerplate.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.api.deps import DbSession, ImageServiceDep
from app.schemas.response import APIResponse
from app.schemas.task import TaskResponse
from app.schemas.file import ImageCompressOptions, ImageResizeOptions, ImageConvertOptions
from app.core.task_handler import handle_task

router = APIRouter()


@router.post("/compress", response_model=APIResponse[TaskResponse])
async def compress_image(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file to compress"),
    quality: int = Form(default=80, ge=1, le=100, description="Quality 1-100"),
):
    """Compress image to reduce file size."""
    return await handle_task(
        db, service, "image_compress",
        process_func=lambda paths: service.compress(
            paths[0], ImageCompressOptions(quality=quality)
        ),
        file=file,
        metadata={"quality": quality},
    )


@router.post("/resize", response_model=APIResponse[TaskResponse])
async def resize_image(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file to resize"),
    width: int = Form(None, ge=1, le=10000, description="Target width"),
    height: int = Form(None, ge=1, le=10000, description="Target height"),
    maintain_ratio: bool = Form(default=True, description="Maintain aspect ratio"),
):
    """Resize image to specified dimensions."""
    if width is None and height is None:
        raise HTTPException(status_code=400, detail="Provide width or height")

    return await handle_task(
        db, service, "image_resize",
        process_func=lambda paths: service.resize(
            paths[0], ImageResizeOptions(width=width, height=height, maintain_ratio=maintain_ratio)
        ),
        file=file,
        metadata={"width": width, "height": height, "maintain_ratio": maintain_ratio},
    )


@router.post("/convert", response_model=APIResponse[TaskResponse])
async def convert_image(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file to convert"),
    format: str = Form(..., description="Target: jpg, png, webp, gif"),
    quality: int = Form(default=90, ge=1, le=100, description="Quality 1-100"),
):
    """Convert image to different format."""
    valid_formats = ["jpg", "jpeg", "png", "webp", "gif"]
    if format.lower() not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Invalid format. Use: {valid_formats}")

    return await handle_task(
        db, service, "image_convert",
        process_func=lambda paths: service.convert(
            paths[0], ImageConvertOptions(format=format, quality=quality)
        ),
        file=file,
        metadata={"format": format, "quality": quality},
    )


@router.post("/remove-background", response_model=APIResponse[TaskResponse])
async def remove_background(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file"),
    bg_color: str = Form(default=None, description="Background color: transparent (default), white, black, or hex #RRGGBB"),
    output_format: str = Form(default="png", description="Output format: png, jpeg, webp"),
    quality: int = Form(default=90, ge=1, le=100, description="Quality for JPEG/WebP (1-100)"),
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
    """
    return await handle_task(
        db, service, "image_remove_bg",
        process_func=lambda paths: service.remove_background(
            paths[0],
            bg_color=bg_color if bg_color else None,
            output_format=output_format,
            quality=quality,
        ),
        file=file,
        metadata={
            "bg_color": bg_color,
            "output_format": output_format,
            "quality": quality,
        },
    )


@router.post("/watermark", response_model=APIResponse[TaskResponse])
async def add_watermark(
    db: DbSession,
    service: ImageServiceDep,
    file: UploadFile = File(..., description="Image file"),
    text: str = Form(..., description="Watermark text"),
    position: str = Form(default="center"),
    opacity: float = Form(default=0.3, ge=0.1, le=1.0),
    font_size: int = Form(default=40, ge=10, le=200),
    color: str = Form(default="white"),
    rotation: int = Form(default=0, ge=0, le=360),
):
    """Add text watermark to image."""
    return await handle_task(
        db, service, "image_watermark",
        process_func=lambda paths: service.add_watermark(
            paths[0], text, position, opacity, font_size, color, rotation
        ),
        file=file,
        metadata={"text": text, "position": position},
    )
