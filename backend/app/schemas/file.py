"""File-related schemas."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FileInfo(BaseModel):
    """File information schema."""

    id: str
    original_name: str
    stored_name: str
    file_path: str
    file_size: int
    mime_type: str
    upload_order: int = 0


class ProcessedFile(BaseModel):
    """Processed file result schema."""

    id: str
    file_name: str
    file_size: int
    mime_type: str
    download_url: str
    expires_at: datetime


class PDFMergeOptions(BaseModel):
    """Options for PDF merge operation."""

    pass  # No specific options needed for basic merge


class PDFSplitOptions(BaseModel):
    """Options for PDF split operation."""

    pages: str = Field(..., description="Page ranges (e.g., '1-3,5,7-10' or 'all')")


class PDFCompressOptions(BaseModel):
    """Options for PDF compression."""

    quality: str = Field(
        default="medium",
        description="Compression quality: extreme, low, medium, high",
    )
    compress_images: bool = Field(
        default=True,
        description="Whether to compress embedded images (uses Ghostscript)",
    )
    image_dpi: Optional[int] = Field(
        default=None,
        ge=72,
        le=600,
        description="Target DPI for images (overrides quality preset)",
    )
    remove_metadata: bool = Field(
        default=False,
        description="Remove document metadata for additional size reduction",
    )
    grayscale: bool = Field(
        default=False,
        description="Convert to grayscale for additional size reduction",
    )
    target_size_kb: Optional[int] = Field(
        default=None,
        ge=10,
        le=102400,
        description="Target file size in KB (auto-adjusts compression to reach target)",
    )
    preserve_quality: bool = Field(
        default=True,
        description="Prioritize image quality with bicubic downsampling and high JPEG quality",
    )


class ImageCompressOptions(BaseModel):
    """Options for image compression."""

    quality: int = Field(
        default=80,
        ge=1,
        le=100,
        description="Compression quality (1-100)",
    )


class ImageResizeOptions(BaseModel):
    """Options for image resize."""

    width: Optional[int] = Field(None, ge=1, le=10000)
    height: Optional[int] = Field(None, ge=1, le=10000)
    maintain_ratio: bool = Field(default=True)


class ImageConvertOptions(BaseModel):
    """Options for image format conversion."""

    format: str = Field(
        ...,
        description="Target format: jpg, png, webp, gif",
    )
    quality: int = Field(default=90, ge=1, le=100)
