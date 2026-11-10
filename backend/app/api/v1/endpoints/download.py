"""Download endpoint with delete-after-download security."""

import os
import re
from datetime import datetime, timedelta
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
from app.utils.cleanup import grace_expiry, schedule_task_purge
from app.utils.naming import clean_download_name

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


DEFAULT_DOWNLOAD_GRACE_SECONDS = 120
EXPIRY_LEEWAY_SECONDS = 15


def get_download_grace_seconds() -> int:
    """Seconds a file stays fetchable after its first download (DOWNLOAD_GRACE_SECONDS)."""
    try:
        return max(0, int(os.getenv("DOWNLOAD_GRACE_SECONDS", DEFAULT_DOWNLOAD_GRACE_SECONDS)))
    except ValueError:
        return DEFAULT_DOWNLOAD_GRACE_SECONDS


@router.api_route("/download/{file_id}", methods=["GET", "HEAD"])
async def download_file(
    request: Request,
    db: DbSession,
    file_id: str,
):
    """
    Download processed file by ID.

    Security features:
    - With DELETE_AFTER_DOWNLOAD=True the first GET starts a short grace
      window (DOWNLOAD_GRACE_SECONDS, default 120): retries, double clicks and
      resume/range requests still work inside it, then the file, the task's
      input files and the DB rows are deleted. HEAD never starts the clock.
    - Files auto-expire after FILE_EXPIRY_MINUTES
    """
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
    # A few seconds of leeway so a countdown shown in the browser (which starts
    # when the result arrives, slightly after the server created it) never
    # reaches the server later than the server's own clock allows.
    if output_file.expires_at + timedelta(seconds=EXPIRY_LEEWAY_SECONDS) < datetime.utcnow():
        raise HTTPException(
            status_code=410,
            detail="This file has been deleted. Files are kept for 2 minutes — please process it again.",
        )

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

    # Name shown to the user; also cleans legacy rows stored with internal IDs
    download_name = clean_download_name(output_file.file_name)

    # HEAD is a probe (browsers, download managers, scanners): serve headers
    # only, count nothing and do not start the grace window.
    if request.method == "HEAD":
        return FileResponse(
            path=file_path,
            filename=download_name,
            media_type=output_file.mime_type,
        )

    output_file.download_count += 1
    task_id = output_file.task_id

    # Log download for audit trail
    await log_download(
        db=db,
        request=request,
        task_id=task_id,
        file_id=file_id,
        file_name=download_name,
    )

    # Privacy: start the grace window. The expiry only ever moves earlier, so
    # further requests cannot extend the file's life, and the periodic sweeper
    # (cleanup_expired_files) agrees with the delayed purge below.
    grace = get_download_grace_seconds()
    if settings.DELETE_AFTER_DOWNLOAD:
        output_file.expires_at = grace_expiry(datetime.utcnow(), output_file.expires_at, grace)

    await db.commit()

    # The purge is scheduled now, as an independent task on the shared async
    # session factory, rather than as a response background task: those only
    # run if the response completes (a dropped connection would skip them) and
    # a long sleep there would block the keep-alive connection.
    if settings.DELETE_AFTER_DOWNLOAD:
        if schedule_task_purge(task_id, grace + 1):
            logger.info(f"Scheduled purge of task {task_id} in {grace}s")

    return FileResponse(
        path=file_path,
        filename=download_name,
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
