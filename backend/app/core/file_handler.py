"""File handling utilities."""

import os
import time
import zipfile
import mimetypes
from pathlib import Path
from typing import Optional
from uuid import uuid4

import aiofiles
from fastapi import UploadFile

from app.config import settings
from app.core.exceptions import InvalidFileTypeError, FileSizeExceededError


# Magic bytes for file type validation
MAGIC_BYTES = {
    "application/pdf": [b"%PDF"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        b"PK\x03\x04"
    ],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        b"PK\x03\x04"
    ],
}


class FileInfo:
    """File information container."""

    def __init__(
        self,
        original_name: str,
        stored_name: str,
        file_path: Path,
        file_size: int,
        mime_type: str,
    ):
        self.original_name = original_name
        self.stored_name = stored_name
        self.file_path = file_path
        self.file_size = file_size
        self.mime_type = mime_type


class FileHandler:
    """Centralized file handling operations."""

    @staticmethod
    def generate_file_id() -> str:
        """Generate unique file ID."""
        return f"{uuid4().hex}_{int(time.time())}"

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent path traversal."""
        # Remove path separators and null bytes
        filename = os.path.basename(filename)
        filename = filename.replace("\x00", "")
        # Keep only safe characters
        safe_chars = set(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_"
        )
        filename = "".join(c if c in safe_chars else "_" for c in filename)
        return filename or "unnamed"

    @staticmethod
    async def validate_file_type(
        file: UploadFile,
        allowed_types: list[str],
    ) -> str:
        """Validate file type by magic bytes."""
        # Read first bytes for magic number check
        header = await file.read(16)
        await file.seek(0)

        detected_type = None
        for mime_type, magic_list in MAGIC_BYTES.items():
            for magic in magic_list:
                if header.startswith(magic):
                    detected_type = mime_type
                    break
            if detected_type:
                break

        if detected_type is None:
            # Fallback to content-type header
            detected_type = file.content_type

        if detected_type not in allowed_types:
            raise InvalidFileTypeError(
                f"File type '{detected_type}' not allowed. Expected: {allowed_types}"
            )

        return detected_type

    @staticmethod
    async def validate_file_size(file: UploadFile, max_size: Optional[int] = None) -> int:
        """Validate file size."""
        max_size = max_size or settings.MAX_UPLOAD_SIZE

        # Get file size by seeking to end
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)

        if size > max_size:
            raise FileSizeExceededError(
                f"File size ({size} bytes) exceeds limit ({max_size} bytes)"
            )

        return size

    @staticmethod
    async def save_upload(
        file: UploadFile,
        directory: Path,
        file_id: Optional[str] = None,
    ) -> FileInfo:
        """Save uploaded file to storage."""
        file_id = file_id or FileHandler.generate_file_id()
        original_name = FileHandler.sanitize_filename(file.filename or "unnamed")

        # Get extension and stem from original filename
        original_path = Path(original_name)
        ext = original_path.suffix
        stem = original_path.stem[:50]  # Limit length
        stored_name = f"{file_id}_{stem}{ext}"
        file_path = directory / stored_name

        # Ensure directory exists
        directory.mkdir(parents=True, exist_ok=True)

        # Save file
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        # Get file size
        file_size = file_path.stat().st_size

        # Get mime type
        mime_type = file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

        return FileInfo(
            original_name=original_name,
            stored_name=stored_name,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
        )

    @staticmethod
    async def create_zip(files: list[Path], output_path: Path) -> Path:
        """Create ZIP archive from multiple files."""
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file_path in files:
                zipf.write(file_path, file_path.name)
        return output_path

    @staticmethod
    async def delete_file(file_path: Path) -> bool:
        """Delete a file."""
        try:
            if file_path.exists():
                file_path.unlink()
                return True
        except Exception:
            pass
        return False
