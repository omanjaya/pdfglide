"""Download endpoint."""

import re
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.deps import DbSession
from app.config import settings
from app.models.task import OutputFile, Task
from app.schemas.response import APIResponse
from app.schemas.task import TaskStatus, TaskStatusEnum
from app.core.logging import get_logger
from app.utils.audit import log_download

logger = get_logger(__name__)

router = APIRouter()


def validate_file_path_safe(file_path: Path, allowed_dir: Path) -> bool:
    """
    Validate that a file path is within the allowed directory.

    This prevents path traversal attacks where an attacker could
    potentially read arbitrary files by manipulating the path.

    Args:
        file_path: The file path to validate
        allowed_dir: The directory the file must be within

    Returns:
        True if path is safe, False otherwise
    """
    try:
        # Resolve both paths to absolute paths, resolving symlinks
        file_resolved = file_path.resolve()
        allowed_resolved = allowed_dir.resolve()

        # Check if the file is within the allowed directory
        # Using is_relative_to for Python 3.9+
        return file_resolved.is_relative_to(allowed_resolved)
    except (ValueError, RuntimeError):
        return False


def validate_filename_format(filename: str) -> bool:
    """
    Validate that a filename matches the expected UUID-based format.

    Expected format: {uuid}_{timestamp}.{extension}
    Example: a1b2c3d4e5f6_1234567890.pdf

    Args:
        filename: The filename to validate

    Returns:
        True if filename matches expected format
    """
    # Pattern: alphanumeric/hex characters, underscore, digits, dot, extension
    pattern = r"^[a-f0-9]+_\d+\.\w+$"
    return bool(re.match(pattern, filename, re.IGNORECASE))


@router.get("/download/{file_id}")
async def download_file(
    request: Request,
    db: DbSession,
    file_id: str,
):
    """Download processed file by ID."""
    # Validate file_id format (should be alphanumeric with underscore)
    if not re.match(r"^[a-zA-Z0-9_]+$", file_id):
        logger.warning(f"Invalid file_id format attempted: {file_id[:50]}")
        raise HTTPException(status_code=400, detail="Invalid file ID format")

    # Find file
    result = await db.execute(
        select(OutputFile).where(OutputFile.id == file_id)
    )
    output_file = result.scalar_one_or_none()

    if not output_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check expiration
    if output_file.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="File has expired")

    # SECURITY: Validate file path is within allowed directory
    file_path = Path(output_file.file_path)

    # Path traversal protection - ensure file is within processed directory
    if not validate_file_path_safe(file_path, settings.processed_path):
        logger.error(
            f"Path traversal attempt detected. file_id={file_id}, "
            f"path={output_file.file_path}"
        )
        raise HTTPException(status_code=404, detail="File not found")

    # Validate filename format
    if not validate_filename_format(file_path.name):
        logger.error(
            f"Invalid filename format. file_id={file_id}, "
            f"filename={file_path.name}"
        )
        raise HTTPException(status_code=404, detail="File not found")

    # Check if file exists
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # Additional check: verify file is a regular file (not a symlink to elsewhere)
    if not file_path.is_file():
        logger.error(f"Not a regular file: {file_path}")
        raise HTTPException(status_code=404, detail="File not found")

    # Update download count
    output_file.download_count += 1

    # Log download for audit trail
    await log_download(
        db=db,
        request=request,
        task_id=output_file.task_id,
        file_id=file_id,
        file_name=output_file.file_name,
    )

    await db.commit()

    return FileResponse(
        path=file_path,
        filename=output_file.file_name,
        media_type=output_file.mime_type,
    )


@router.get("/task/{task_id}/status", response_model=APIResponse[TaskStatus])
async def get_task_status(
    db: DbSession,
    task_id: str,
):
    """Get task processing status."""
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get download URL if completed
    download_url = None
    if task.status == "completed":
        result = await db.execute(
            select(OutputFile).where(OutputFile.task_id == task_id)
        )
        output_file = result.scalar_one_or_none()
        if output_file:
            download_url = f"/api/v1/download/{output_file.id}"

    status_map = {
        "pending": TaskStatusEnum.PENDING,
        "processing": TaskStatusEnum.PROCESSING,
        "completed": TaskStatusEnum.COMPLETED,
        "failed": TaskStatusEnum.FAILED,
    }

    return APIResponse(
        success=True,
        data=TaskStatus(
            task_id=task_id,
            status=status_map.get(task.status, TaskStatusEnum.PENDING),
            progress=100 if task.status == "completed" else 0,
            download_url=download_url,
            error_message=task.error_message,
        ),
    )
