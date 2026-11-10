"""Base service class."""

import zipfile
from abc import ABC
from pathlib import Path
from typing import Optional

from fastapi import UploadFile

from app.core.file_handler import FileHandler, FileInfo
from app.config import settings
from app.utils.naming import build_download_name, clean_stem

# Longest stem of a single input shown in a multi-file download name
MULTI_NAME_PART_LENGTH = 30


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
    def create_named_zip(entries: list[tuple[Path, str]], zip_path: Path) -> Path:
        """
        Create a ZIP whose entries use user-facing names, not stored names.

        Args:
            entries: (file on disk, name inside the archive) pairs
            zip_path: Where to write the archive

        Returns:
            Path to the created archive
        """
        used: set[str] = set()
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file_path, arcname in entries:
                candidate, counter = arcname, 1
                while candidate in used:
                    counter += 1
                    candidate = f"{Path(arcname).stem}_{counter}{Path(arcname).suffix}"
                used.add(candidate)
                zipf.write(file_path, candidate)
        return zip_path

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
        return build_download_name(input_path, operation, extension)

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
            One file: ``A_merged.pdf``. Two files: ``A_and_B_merged.pdf``.
            Three or more: ``A_and_2_more_merged.pdf``. No files:
            ``files_merged.pdf``. Each stem is shortened and every stored
            input path is stripped of its internal ID by the naming helper.
        """
        if len(input_paths) < 2:
            source = input_paths[0] if input_paths else None
            return build_download_name(source, operation, extension, fallback="files")

        def stem_of(path: Path) -> str:
            stem = build_download_name(path, None, "", fallback="file")
            return clean_stem(stem[:MULTI_NAME_PART_LENGTH], fallback="file")

        first = stem_of(input_paths[0])
        if len(input_paths) == 2:
            combined = f"{first}_and_{stem_of(input_paths[1])}"
        else:
            combined = f"{first}_and_{len(input_paths) - 1}_more"

        # Re-enter through the naming helper so the result is cleaned like
        # every other download name. The extension is part of the source so a
        # dot inside the stem is never mistaken for it.
        ext = "." + extension.lstrip(".") if extension else ""
        return build_download_name(
            f"{combined}{ext}", operation, extension, fallback="files"
        )
