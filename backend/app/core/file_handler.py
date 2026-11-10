"""File handling utilities."""

import os
import time
import unicodedata
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

UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1 MiB
MAX_STEM_CHARS = 50
MAX_EXT_CHARS = 10  # including the dot
MAX_ORIGINAL_NAME_BYTES = 200
MAX_STORED_NAME_BYTES = 255  # common filesystem limit (ext4, xfs, overlayfs)

_RESERVED_NAMES = {
    "con", "prn", "aux", "nul",
    *(f"com{i}" for i in range(1, 10)),
    *(f"lpt{i}" for i in range(1, 10)),
}


def _truncate_bytes(text: str, max_bytes: int) -> str:
    """Cut ``text`` to at most ``max_bytes`` UTF-8 bytes without splitting a character."""
    return text.encode("utf-8")[: max(0, max_bytes)].decode("utf-8", errors="ignore")


def _clean_component(text: str) -> str:
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in "LMN":  # letters, combining marks (needed by Thai/Hindi/Arabic), digits
            out.append(ch)
        elif cat[0] == "C":  # control, format (bidi/zero-width), surrogates, unassigned
            continue
        else:  # whitespace, punctuation, symbols
            out.append("." if ch == "." else "-" if ch == "-" else "_")
    return "".join(out)


def sanitize_filename(filename: str) -> str:
    """See ``FileHandler.sanitize_filename``."""
    name = unicodedata.normalize("NFC", filename or "")
    name = name.replace("\\", "/").rsplit("/", 1)[-1]  # last path component, / or \
    name = _clean_component(name)
    name = unicodedata.normalize("NFC", name).lstrip(".-").rstrip(".")
    if not name.strip("._-") or name.split(".")[0].lower() in _RESERVED_NAMES:
        return "unnamed"
    stem, dot, ext = name.rpartition(".")
    if not dot or not stem:  # no extension (leading dots already stripped)
        stem, ext = name, ""
    else:
        ext = "." + ext[: MAX_EXT_CHARS - 1]
    stem = _truncate_bytes(stem, MAX_ORIGINAL_NAME_BYTES - len(ext.encode("utf-8")))
    return (stem or "unnamed") + ext


def build_stored_name(file_id: str, original_name: str) -> str:
    """``{file_id}_{stem}{ext}`` with the stem limited to 50 characters and the whole
    name to 255 UTF-8 bytes (filesystems limit bytes, not characters)."""
    stem, dot, ext = original_name.rpartition(".")
    if dot and stem:
        ext = "." + ext
    else:
        stem, ext = original_name, ""
    prefix = f"{file_id}_"
    budget = MAX_STORED_NAME_BYTES - len((prefix + ext).encode("utf-8"))
    stem = _truncate_bytes(stem[:MAX_STEM_CHARS], budget)
    return f"{prefix}{stem}{ext}"


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
        """Make an uploaded file name safe to use as part of a path.

        Unicode letters, combining marks and digits are kept (Thai, Chinese,
        Arabic, Hindi, ... names survive), the result is NFC-normalised, and
        everything else becomes ``_``: path separators (``/`` and ``\\``),
        control and format characters (incl. null bytes and bidi overrides),
        punctuation, symbols and whitespace. Leading dots/dashes are removed,
        so the result can be neither ``..`` nor an option-looking name, and
        empty or reserved device names become ``unnamed``. The total length is
        capped at ``MAX_ORIGINAL_NAME_BYTES`` UTF-8 bytes.
        """
        return sanitize_filename(filename)

    @staticmethod
    async def validate_file_type(
        file: UploadFile,
        allowed_types: list[str],
    ) -> str:
        """Validate file type by magic bytes."""
        # Read first bytes for magic number check
        header = await file.read(16)
        await file.seek(0)

        # Several types can share a signature (DOCX and XLSX are both ZIP)
        matches = [
            mime_type
            for mime_type, magic_list in MAGIC_BYTES.items()
            if any(header.startswith(magic) for magic in magic_list)
        ]

        if matches:
            detected_type = next((m for m in matches if m in allowed_types), matches[0])
        else:
            # No known signature: trust the declared type only for formats we
            # cannot verify. A declared PDF/JPEG/PNG... whose bytes do not match
            # its signature is not that type.
            detected_type = file.content_type
            if detected_type in MAGIC_BYTES:
                raise InvalidFileTypeError(
                    f"File content does not match its type '{detected_type}'."
                )

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
        max_size: Optional[int] = None,
    ) -> FileInfo:
        """Save uploaded file to storage, streaming in chunks.

        Raises FileSizeExceededError (and removes the partial file) as soon as
        more than ``max_size`` (default MAX_UPLOAD_SIZE) bytes have been read.
        """
        file_id = file_id or FileHandler.generate_file_id()
        original_name = FileHandler.sanitize_filename(file.filename or "unnamed")
        stored_name = build_stored_name(file_id, original_name)
        file_path = directory / stored_name
        max_size = settings.MAX_UPLOAD_SIZE if max_size is None else max_size

        # Ensure directory exists
        directory.mkdir(parents=True, exist_ok=True)

        # Stream to disk in chunks; the size limit is enforced as bytes arrive
        # so an oversized upload is rejected without being held in memory.
        file_size = 0
        try:
            async with aiofiles.open(file_path, "wb") as f:
                while True:
                    chunk = await file.read(UPLOAD_CHUNK_SIZE)
                    if not chunk:
                        break
                    file_size += len(chunk)
                    if file_size > max_size:
                        raise FileSizeExceededError(
                            f"File size exceeds limit ({max_size} bytes)"
                        )
                    await f.write(chunk)
        except BaseException:
            # Oversized, client disconnect, cancellation, disk full: no partial file
            file_path.unlink(missing_ok=True)
            raise

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
