"""Base service class."""

from abc import ABC
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from app.core.file_handler import FileHandler, FileInfo
from app.config import settings


class ProcessedResult:
    """Processed file result."""

    def __init__(
        self,
        id: str,
        file_name: str,
        file_path: Path,
        file_size: int,
        mime_type: str,
    ):
        self.id = id
        self.file_name = file_name
        self.file_path = file_path
        self.file_size = file_size
        self.mime_type = mime_type


class BaseService(ABC):
    """Base service class with common operations."""

    ALLOWED_TYPES: list[str] = []

    def __init__(self, storage_path: Path):
        self.storage_path = Path(storage_path)
        self.upload_dir = self.storage_path / "uploads"
        self.processed_dir = self.storage_path / "processed"

        # Ensure directories exist
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)

    async def save_input_file(
        self,
        file: UploadFile,
        task_id: str,
        order: int = 0,
    ) -> FileInfo:
        """Save uploaded file."""
        # Validate file type if allowed types are set
        if self.ALLOWED_TYPES:
            await FileHandler.validate_file_type(file, self.ALLOWED_TYPES)

        # Validate file size
        await FileHandler.validate_file_size(file)

        # Save file
        file_id = f"{task_id}_{order}"
        return await FileHandler.save_upload(
            file,
            self.upload_dir,
            file_id,
        )

    def generate_output_id(self) -> str:
        """Generate unique output file ID."""
        return FileHandler.generate_file_id()

    def get_output_path(self, file_id: str, extension: str) -> Path:
        """Get output file path."""
        return self.processed_dir / f"{file_id}{extension}"

    @staticmethod
    def generate_output_name(
        input_path: Path,
        operation: str,
        extension: str = ".pdf"
    ) -> str:
        """
        Generate output filename based on input filename and operation.

        Args:
            input_path: Path to the input file
            operation: Name of the operation (e.g., 'merged', 'compressed')
            extension: Output file extension

        Returns:
            Filename like 'document_merged.pdf'
        """
        # Get filename stem
        stem = input_path.stem

        # Handle stored files with pattern: {uuid}_{timestamp}_{order}_{original_stem}
        # Try to extract original stem by skipping first 3 underscore-separated parts
        parts = stem.split("_")
        if len(parts) > 3:
            # Skip uuid, timestamp, order parts and join the rest
            stem = "_".join(parts[3:])

        # Sanitize: remove special chars, limit length
        stem = "".join(c for c in stem if c.isalnum() or c in "-_ ").strip()
        stem = stem[:50] if len(stem) > 50 else stem
        stem = stem or "file"
        return f"{stem}_{operation}{extension}"

    @staticmethod
    def generate_multi_output_name(
        input_paths: list[Path],
        operation: str,
        extension: str = ".pdf"
    ) -> str:
        """
        Generate output filename for multi-file operations.

        Args:
            input_paths: List of input file paths
            operation: Name of the operation
            extension: Output file extension

        Returns:
            Filename like 'document1_merged.pdf' (based on first file)
        """
        if input_paths:
            stem = input_paths[0].stem

            # Handle stored files with pattern: {uuid}_{timestamp}_{order}_{original_stem}
            parts = stem.split("_")
            if len(parts) > 3:
                stem = "_".join(parts[3:])

            stem = "".join(c for c in stem if c.isalnum() or c in "-_ ").strip()
            stem = stem[:50] if len(stem) > 50 else stem
            stem = stem or "files"
        else:
            stem = "files"
        return f"{stem}_{operation}{extension}"
