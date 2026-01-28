"""Image processing service."""

from pathlib import Path

from app.services.base import BaseService, ProcessedResult
from app.schemas.file import ImageCompressOptions, ImageResizeOptions, ImageConvertOptions
from app.processors.image.compressor import ImageCompressor
from app.processors.image.resizer import ImageResizer
from app.processors.image.converter import ImageConverter
from app.processors.image.background_remover import BackgroundRemover
from app.processors.image.watermark import ImageWatermark


class ImageService(BaseService):
    """Service for image operations."""

    ALLOWED_TYPES = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    ]

    def __init__(self, storage_path: Path):
        super().__init__(storage_path)
        self.compressor = ImageCompressor(self.processed_dir)
        self.resizer = ImageResizer(self.processed_dir)
        self.converter = ImageConverter(self.processed_dir)
        self.bg_remover = BackgroundRemover(self.processed_dir)
        self.watermark = ImageWatermark(self.processed_dir)

    async def compress(
        self,
        file: Path,
        options: ImageCompressOptions,
    ) -> ProcessedResult:
        """Compress image to reduce file size."""
        output_id = self.generate_output_id()

        # Keep original format
        ext = file.suffix.lower()
        if ext in [".jpg", ".jpeg"]:
            ext = ".jpg"
            mime_type = "image/jpeg"
        elif ext == ".png":
            mime_type = "image/png"
        elif ext == ".webp":
            mime_type = "image/webp"
        else:
            ext = ".jpg"
            mime_type = "image/jpeg"

        output_path = self.get_output_path(output_id, ext)

        await self.compressor.execute(file, output_path, options.quality)

        return ProcessedResult(
            id=output_id,
            file_name=self.generate_output_name(file, "compressed", ext),
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type=mime_type,
        )

    async def resize(
        self,
        file: Path,
        options: ImageResizeOptions,
    ) -> ProcessedResult:
        """Resize image to specified dimensions."""
        output_id = self.generate_output_id()

        # Keep original format
        ext = file.suffix.lower()
        if ext in [".jpg", ".jpeg"]:
            ext = ".jpg"
            mime_type = "image/jpeg"
        elif ext == ".png":
            mime_type = "image/png"
        elif ext == ".webp":
            mime_type = "image/webp"
        elif ext == ".gif":
            mime_type = "image/gif"
        else:
            ext = ".jpg"
            mime_type = "image/jpeg"

        output_path = self.get_output_path(output_id, ext)

        await self.resizer.execute(
            file,
            output_path,
            width=options.width,
            height=options.height,
            maintain_ratio=options.maintain_ratio,
        )

        return ProcessedResult(
            id=output_id,
            file_name=self.generate_output_name(file, "resized", ext),
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type=mime_type,
        )

    async def convert(
        self,
        file: Path,
        options: ImageConvertOptions,
    ) -> ProcessedResult:
        """Convert image to different format."""
        output_id = self.generate_output_id()

        # Normalize format
        fmt = options.format.lower()
        if fmt in ["jpg", "jpeg"]:
            ext = ".jpg"
            mime_type = "image/jpeg"
        elif fmt == "png":
            ext = ".png"
            mime_type = "image/png"
        elif fmt == "webp":
            ext = ".webp"
            mime_type = "image/webp"
        elif fmt == "gif":
            ext = ".gif"
            mime_type = "image/gif"
        else:
            ext = ".jpg"
            mime_type = "image/jpeg"

        output_path = self.get_output_path(output_id, ext)

        await self.converter.execute(file, output_path, fmt, options.quality)

        return ProcessedResult(
            id=output_id,
            file_name=self.generate_output_name(file, "converted", ext),
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type=mime_type,
        )

    async def remove_background(
        self,
        file: Path,
        bg_color: str | None = None,
        output_format: str = "png",
        quality: int = 90,
        fast_mode: bool = False,
    ) -> ProcessedResult:
        """
        Remove background from image.

        Args:
            file: Input image file path
            bg_color: Background color (None=transparent, "white", "#RRGGBB", etc.)
            output_format: Output format (png, jpeg, webp)
            quality: Quality for JPEG/WebP (1-100)
        """
        output_id = self.generate_output_id()

        # Determine extension and mime type based on format
        fmt = output_format.lower()
        if fmt in ("jpg", "jpeg"):
            ext = ".jpg"
            mime_type = "image/jpeg"
        elif fmt == "webp":
            ext = ".webp"
            mime_type = "image/webp"
        else:
            ext = ".png"
            mime_type = "image/png"

        output_path = self.get_output_path(output_id, ext)

        result_path = await self.bg_remover.execute(
            file,
            output_path,
            bg_color=bg_color,
            output_format=output_format,
            quality=quality,
            fast_mode=fast_mode,
        )

        return ProcessedResult(
            id=output_id,
            file_name=self.generate_output_name(file, "nobg", ext),
            file_path=result_path,
            file_size=result_path.stat().st_size,
            mime_type=mime_type,
        )

    async def add_watermark(
        self,
        file: Path,
        text: str,
        position: str = "center",
        opacity: float = 0.3,
        font_size: int = 40,
        color: str = "white",
        rotation: int = 0,
    ) -> ProcessedResult:
        """Add watermark to image."""
        output_id = self.generate_output_id()

        # Keep original format
        ext = file.suffix.lower()
        if ext in [".jpg", ".jpeg"]:
            ext = ".jpg"
            mime_type = "image/jpeg"
        elif ext == ".png":
            mime_type = "image/png"
        elif ext == ".webp":
            mime_type = "image/webp"
        else:
            ext = ".png"
            mime_type = "image/png"

        output_path = self.get_output_path(output_id, ext)

        await self.watermark.execute(
            file, output_path, text, position, opacity, font_size, color, rotation
        )

        return ProcessedResult(
            id=output_id,
            file_name=self.generate_output_name(file, "watermarked", ext),
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type=mime_type,
        )
