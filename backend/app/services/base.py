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
