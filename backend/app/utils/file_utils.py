"""File utility functions."""

import mimetypes
from pathlib import Path
from typing import Optional


def get_mime_type(file_path: Path) -> str:
    """
    Get MIME type for a file.

    Args:
        file_path: Path to the file

    Returns:
        MIME type string
    """
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return mime_type or "application/octet-stream"


def get_file_extension(mime_type: str) -> str:
    """
    Get file extension for a MIME type.

    Args:
        mime_type: MIME type string

    Returns:
        File extension including the dot (e.g., '.pdf')
    """
    ext = mimetypes.guess_extension(mime_type)
    return ext or ""


def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human-readable format.

    Args:
        size_bytes: Size in bytes

    Returns:
        Formatted size string (e.g., '1.5 MB')
    """
    if size_bytes == 0:
        return "0 B"

    units = ["B", "KB", "MB", "GB", "TB"]
    unit_index = 0
    size = float(size_bytes)

    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1

    return f"{size:.2f} {units[unit_index]}"


def is_valid_filename(filename: str) -> bool:
    """
    Check if filename is valid and safe.

    Args:
        filename: Filename to check

    Returns:
        True if valid, False otherwise
    """
    if not filename:
        return False

    # Check for path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return False

    # Check for null bytes
    if "\x00" in filename:
        return False

    # Check length
    if len(filename) > 255:
        return False

    return True


def ensure_directory(path: Path) -> Path:
    """
    Ensure directory exists, create if not.

    Args:
        path: Directory path

    Returns:
        The path
    """
    path.mkdir(parents=True, exist_ok=True)
    return path
