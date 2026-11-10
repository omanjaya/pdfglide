"""Image processing service."""

import asyncio
from pathlib import Path
from typing import Any, Dict, Optional

from app.services.base import BaseService, ProcessedResult
from app.schemas.file import ImageCompressOptions, ImageResizeOptions, ImageConvertOptions
from app.processors.image.compressor import ImageCompressor
from app.processors.image.resizer import ImageResizer
from app.processors.image.converter import ImageConverter
from app.processors.image.background_remover import BackgroundRemover
from app.processors.image.watermark import ImageWatermark
from app.processors.image._common import FORMAT_INFO, detect_format, open_image
from app.core.exceptions import ProcessingError


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

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _require_format(file: Path) -> str:
        """Pillow format name from the file CONTENT (the stored name can lie)."""
        fmt = detect_format(file)
        if fmt is None:
            raise ProcessingError(
                "This file is not a valid image, or its format is not supported. "
                "Please upload a JPG, PNG, WebP or GIF file."
            )
        return fmt

    def _result(
        self,
        output_id: str,
        file: Path,
        operation: str,
        path: Path,
        ext: str,
        mime_type: str,
        stats: Optional[Dict[str, Any]] = None,
    ) -> ProcessedResult:
        result = ProcessedResult(
            id=output_id,
            file_name=self.generate_output_name(file, operation, ext),
            file_path=path,
            file_size=path.stat().st_size,
            mime_type=mime_type,
        )
        # Extra, JSON-friendly facts for the API response `metadata`
        stats = dict(stats or {})
        stats.setdefault("original_size", file.stat().st_size)
        stats.setdefault("output_size", result.file_size)
        result.stats = stats
        return result

    # ------------------------------------------------------------------ tools

    async def compress(
        self,
        file: Path,
        options: ImageCompressOptions,
    ) -> ProcessedResult:
        """Compress image to reduce file size (format is kept)."""
        output_id = self.generate_output_id()

        # Keep the real format (by content); BMP/TIFF and other inputs become JPEG
        src_format = self._require_format(file)
        ext, mime_type = FORMAT_INFO.get(src_format, FORMAT_INFO["JPEG"])

        output_path = self.get_output_path(output_id, ext)

        stats = await self.compressor.execute(
            file, output_path, options.quality, strip_metadata=options.strip_metadata
        )
        return self._result(output_id, file, "compressed", output_path, ext, mime_type, stats)

    async def resize(
        self,
        file: Path,
        options: ImageResizeOptions,
    ) -> ProcessedResult:
        """Resize image to specified dimensions."""
        output_id = self.generate_output_id()

        src_format = self._require_format(file)
        ext, mime_type = FORMAT_INFO.get(src_format, FORMAT_INFO["JPEG"])

        output_path = self.get_output_path(output_id, ext)

        stats = await self.resizer.execute(
            file,
            output_path,
            width=options.width,
            height=options.height,
            maintain_ratio=options.maintain_ratio,
            fit=options.fit,
            percentage=options.percentage,
            no_upscale=options.no_upscale,
            quality=options.quality,
        )
        return self._result(output_id, file, "resized", output_path, ext, mime_type, stats)

    async def convert(
        self,
        file: Path,
        options: ImageConvertOptions,
    ) -> ProcessedResult:
        """Convert image to different format."""
        output_id = self.generate_output_id()
        self._require_format(file)

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
        elif fmt == "bmp":
            ext, mime_type = ".bmp", "image/bmp"
        elif fmt in ("tif", "tiff"):
            ext, mime_type, fmt = ".tiff", "image/tiff", "tiff"
        else:
            raise ProcessingError(
                f"Unsupported output format '{options.format}'. Use JPG, PNG, WebP or GIF."
            )

        output_path = self.get_output_path(output_id, ext)

        stats = await self.converter.execute(
            file, output_path, fmt, options.quality, background=options.background
        )
        return self._result(output_id, file, "converted", output_path, ext, mime_type, stats)

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
            fast_mode: Skip alpha matting
        """
        output_id = self.generate_output_id()
        self._require_format(file)

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

        def _dims():
            with open_image(result_path) as im:
                return im.size

        width, height = await asyncio.to_thread(_dims)
        stats = {
            "width": width,
            "height": height,
            "has_transparency": ext != ".jpg" and not (bg_color and bg_color.lower() not in ("transparent", "none")),
            "matting": not fast_mode,
        }
        return self._result(output_id, file, "nobg", result_path, ext, mime_type, stats)

    async def add_watermark(
        self,
        file: Path,
        text: str = "",
        position: str = "center",
        opacity: float = 0.3,
        font_size: int = 40,
        color: str = "white",
        rotation: int = 0,
        tile: bool = False,
        watermark_image: Optional[bytes] = None,
        image_scale: int = 20,
    ) -> ProcessedResult:
        """Add a text (or image) watermark to image."""
        output_id = self.generate_output_id()

        # Keep original format (by content); GIF and others become PNG
        src_format = self._require_format(file)
        ext, mime_type = FORMAT_INFO.get(src_format, FORMAT_INFO["PNG"])
        if src_format == "GIF":
            ext, mime_type = FORMAT_INFO["PNG"]

        output_path = self.get_output_path(output_id, ext)

        stats = await self.watermark.execute(
            file, output_path, text, position, opacity, font_size, color, rotation,
            tile=tile, watermark_image=watermark_image, image_scale=image_scale,
        )
        return self._result(output_id, file, "watermarked", output_path, ext, mime_type, stats)
