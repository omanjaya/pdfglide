"""File cleanup utilities with GDPR-compliant data retention."""

import asyncio
import logging
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import OutputFile, Task, InputFile, UsageStats, AuditLog
from app.models.database import async_session_maker

logger = logging.getLogger(__name__)


def grace_expiry(now: datetime, current_expiry: datetime, grace_seconds: int) -> datetime:
    """Expiry after a download has started: never later than ``now + grace``.

    The result is the earlier of the existing expiry and ``now + grace``, so a
    download never extends the life of a file and repeated calls are
    idempotent-ish (the second call can only move the deadline earlier, and in
    practice returns ``current_expiry`` unchanged because it is already sooner).
    """
    return min(current_expiry, now + timedelta(seconds=max(0, grace_seconds)))


def is_within(path: Path, base: Path) -> bool:
    """True if ``path`` resolves to a location inside ``base``."""
    try:
        return path.resolve().is_relative_to(base.resolve())
    except (OSError, ValueError, RuntimeError):
        return False


def _unlink_inside(path: Path, base: Path) -> bool:
    """Delete a regular file only if it lives inside ``base``. Idempotent."""
    try:
        if not is_within(path, base):
            logger.warning(f"Refusing to delete path outside {base}: {path}")
            return False
        path.unlink(missing_ok=True)
        return True
    except Exception as e:
        logger.error(f"Failed to delete {path}: {e}")
        return False


async def purge_task(
    session: AsyncSession,
    task_id: str,
    upload_dir: Optional[Path] = None,
    processed_dir: Optional[Path] = None,
) -> dict:
    """
    Remove everything belonging to a task: files on disk and database rows.

    Input files are stored flat in the upload directory as
    ``{task_id}_{order}_{name}`` (see ``FileHandler.save_upload``), so they are
    found through the ``InputFile.file_path`` rows and, as a fallback for rows
    that are already gone, by that name prefix. A legacy ``uploads/{task_id}/``
    directory is removed too if it exists. Safe to call repeatedly and from
    several processes at once: every step tolerates "already gone".
    """
    from app.config import settings

    upload_dir = upload_dir or settings.upload_path
    processed_dir = processed_dir or settings.processed_path
    removed = {"input_files": 0, "output_files": 0}

    outputs = (
        await session.execute(select(OutputFile.file_path).where(OutputFile.task_id == task_id))
    ).scalars().all()
    inputs = (
        await session.execute(select(InputFile.file_path).where(InputFile.task_id == task_id))
    ).scalars().all()

    for raw in outputs:
        if _unlink_inside(Path(raw), processed_dir):
            removed["output_files"] += 1
    input_paths = {Path(raw) for raw in inputs}
    if upload_dir.exists():
        input_paths.update(p for p in upload_dir.glob(f"{task_id}_*") if p.is_file())
    for path in input_paths:
        if _unlink_inside(path, upload_dir):
            removed["input_files"] += 1
    legacy_dir = upload_dir / task_id
    if legacy_dir.is_dir() and not legacy_dir.is_symlink():
        shutil.rmtree(legacy_dir, ignore_errors=True)

    await session.execute(delete(OutputFile).where(OutputFile.task_id == task_id))
    await session.execute(delete(InputFile).where(InputFile.task_id == task_id))
    await session.execute(delete(Task).where(Task.id == task_id))
    await session.commit()
    return removed


# Strong references to pending delayed purges (the event loop only keeps weak ones).
_pending_purges: dict[str, "asyncio.Task[None]"] = {}


async def _purge_after(task_id: str, delay: float, session_maker) -> None:
    try:
        await asyncio.sleep(delay)
        async with session_maker() as session:
            await purge_task(session, task_id)
        logger.info(f"Purged task {task_id} after download grace period")
    except asyncio.CancelledError:
        raise
    except Exception as e:
        # The periodic sweeper still removes it: its output row is already expired.
        logger.error(f"Delayed purge of task {task_id} failed: {e}")
    finally:
        _pending_purges.pop(task_id, None)


def schedule_task_purge(task_id: str, delay_seconds: float, session_maker=None) -> bool:
    """Purge ``task_id`` after ``delay_seconds`` using the shared async session factory.

    Returns False if a purge for this task is already pending (idempotent), so
    repeated downloads do not stack up timers.
    """
    if task_id in _pending_purges:
        return False
    _pending_purges[task_id] = asyncio.get_running_loop().create_task(
        _purge_after(task_id, delay_seconds, session_maker or async_session_maker)
    )
    return True


async def cleanup_expired_files() -> int:
    """
    Clean up expired output files from storage and database.

    Removes each expired output together with its task's input files and rows,
    so nothing is left orphaned. Also catches tasks whose delayed post-download
    purge was lost (process restart) because the download shortened their expiry.

    Returns:
        Number of output files cleaned up
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(OutputFile.task_id).where(OutputFile.expires_at < datetime.utcnow())
        )
        task_ids = result.scalars().all()

        for task_id in set(task_ids):
            try:
                await purge_task(session, task_id)
            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to purge expired task {task_id}: {e}")

        logger.info(f"Cleaned up {len(task_ids)} expired output files")
        return len(task_ids)


async def cleanup_input_files(session: AsyncSession, task: Task) -> int:
    """
    Delete input files associated with a task from both database and disk.

    Args:
        session: Database session
        task: Task to clean up input files for

    Returns:
        Number of input files deleted
    """
    # Get all input files for this task
    result = await session.execute(
        select(InputFile).where(InputFile.task_id == task.id)
    )
    input_files = result.scalars().all()

    deleted_count = 0
    for input_file in input_files:
        # Delete physical file
        file_path = Path(input_file.file_path)
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted input file: {file_path}")
                deleted_count += 1
        except Exception as e:
            logger.error(f"Failed to delete input file {file_path}: {e}")

    return deleted_count


async def cleanup_orphaned_tasks(hours_old: Optional[int] = None) -> int:
    """
    Clean up old tasks that have no output files.

    Also deletes associated input files from disk.

    Args:
        hours_old: Delete tasks older than this many hours (uses config if not specified)

    Returns:
        Number of tasks cleaned up
    """
    from app.config import settings

    if hours_old is None:
        hours_old = settings.ORPHAN_TASK_RETENTION_HOURS

    async with async_session_maker() as session:
        cutoff = datetime.utcnow() - timedelta(hours=hours_old)

        # Find old tasks with no output files
        result = await session.execute(
            select(Task)
            .outerjoin(OutputFile)
            .where(Task.created_at < cutoff)
            .where(OutputFile.id.is_(None))
        )
        old_tasks = result.scalars().all()

        cleaned_count = 0
        input_files_deleted = 0

        for task in old_tasks:
            # Delete input files from disk first
            input_files_deleted += await cleanup_input_files(session, task)

            # Delete task (cascade will delete InputFile records)
            await session.delete(task)
            cleaned_count += 1

        await session.commit()
        logger.info(
            f"Cleaned up {cleaned_count} orphaned tasks "
            f"({input_files_deleted} input files deleted)"
        )

        return cleaned_count


async def cleanup_completed_tasks(hours_old: Optional[int] = None) -> int:
    """
    Clean up completed tasks and their associated files after expiry.

    Args:
        hours_old: Delete completed tasks older than this many hours

    Returns:
        Number of tasks cleaned up
    """
    from app.config import settings

    if hours_old is None:
        # Use minutes from config, add 5 minute buffer
        minutes_old = settings.FILE_EXPIRY_MINUTES + 5
        cutoff = datetime.utcnow() - timedelta(minutes=minutes_old)
    else:
        cutoff = datetime.utcnow() - timedelta(hours=hours_old)

    async with async_session_maker() as session:

        # Find old completed tasks
        result = await session.execute(
            select(Task)
            .where(Task.status == "completed")
            .where(Task.completed_at < cutoff)
        )
        old_tasks = result.scalars().all()

        cleaned_count = 0
        for task in old_tasks:
            # Delete input files from disk
            await cleanup_input_files(session, task)

            # Get and delete output files from disk
            output_result = await session.execute(
                select(OutputFile).where(OutputFile.task_id == task.id)
            )
            for output_file in output_result.scalars().all():
                file_path = Path(output_file.file_path)
                try:
                    if file_path.exists():
                        file_path.unlink()
                except Exception as e:
                    logger.error(f"Failed to delete output file {file_path}: {e}")

            # Delete task (cascade deletes file records)
            await session.delete(task)
            cleaned_count += 1

        await session.commit()
        if cleaned_count:
            logger.info(f"Cleaned up {cleaned_count} completed tasks")

        return cleaned_count


async def cleanup_upload_files(
    storage_path: Path, hours_old: Optional[int] = None
) -> int:
    """
    Clean up old upload files that may have been orphaned.

    Args:
        storage_path: Base storage path
        hours_old: Delete files older than this many hours (uses config if not specified)

    Returns:
        Number of files cleaned up
    """
    from app.config import settings

    if hours_old is None:
        hours_old = settings.UPLOAD_RETENTION_HOURS

    upload_dir = storage_path / "uploads"
    if not upload_dir.exists():
        return 0

    cutoff = datetime.utcnow() - timedelta(hours=hours_old)
    cleaned_count = 0

    for file_path in upload_dir.iterdir():
        if file_path.is_file():
            try:
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff:
                    file_path.unlink()
                    cleaned_count += 1
                    logger.info(f"Deleted upload file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete upload file {file_path}: {e}")

    if cleaned_count:

        logger.info(f"Cleaned up {cleaned_count} upload files")
    return cleaned_count


async def cleanup_processed_files(storage_path: Path, minutes_old: int = 60) -> int:
    """
    Delete anything left in the processed directory beyond its lifetime.

    Results expire after FILE_EXPIRY_MINUTES and are removed through their
    database rows. This is the safety net for files with no row at all
    (intermediate pages, temp files of a crashed conversion): whatever is
    older than ``minutes_old`` is user data that should already be gone.
    """
    from app.config import settings

    processed_dir = Path(storage_path) / "processed"
    if not processed_dir.exists():
        return 0

    minutes_old = max(minutes_old, settings.FILE_EXPIRY_MINUTES * 2)
    cutoff = datetime.now().timestamp() - minutes_old * 60
    cleaned_count = 0

    for file_path in processed_dir.rglob("*"):
        try:
            if file_path.is_file() and not file_path.is_symlink():
                if file_path.stat().st_mtime < cutoff:
                    file_path.unlink()
                    cleaned_count += 1
        except Exception as e:
            logger.error(f"Failed to delete stale processed file {file_path}: {e}")

    if cleaned_count:
        if cleaned_count:
            logger.info(f"Cleaned up {cleaned_count} stale processed files")
    return cleaned_count


async def cleanup_usage_stats(days_old: Optional[int] = None) -> int:
    """
    Clean up old usage statistics.

    Args:
        days_old: Delete stats older than this many days (uses config if not specified)

    Returns:
        Number of records deleted
    """
    from app.config import settings

    if days_old is None:
        days_old = settings.USAGE_STATS_RETENTION_DAYS

    async with async_session_maker() as session:
        cutoff = datetime.utcnow() - timedelta(days=days_old)

        result = await session.execute(
            delete(UsageStats).where(UsageStats.created_at < cutoff)
        )

        await session.commit()
        deleted_count = result.rowcount

        if deleted_count:

            logger.info(f"Cleaned up {deleted_count} usage stats records")
        return deleted_count


async def cleanup_audit_logs(days_old: Optional[int] = None) -> int:
    """
    Clean up old audit logs.

    Args:
        days_old: Delete logs older than this many days (uses config if not specified)

    Returns:
        Number of records deleted
    """
    from app.config import settings

    if days_old is None:
        days_old = settings.AUDIT_LOG_RETENTION_DAYS

    async with async_session_maker() as session:
        cutoff = datetime.utcnow() - timedelta(days=days_old)

        result = await session.execute(
            delete(AuditLog).where(AuditLog.created_at < cutoff)
        )

        await session.commit()
        deleted_count = result.rowcount

        if deleted_count:

            logger.info(f"Cleaned up {deleted_count} audit log records")
        return deleted_count


async def run_cleanup_scheduler(interval_minutes: int = 30):
    """
    Run periodic cleanup tasks.

    Args:
        interval_minutes: Interval between cleanup runs
    """
    from app.config import settings

    logger.info(f"Starting cleanup scheduler (interval: {interval_minutes} minutes)")

    while True:
        try:
            logger.debug("Running scheduled cleanup...")

            # Clean up expired output files
            await cleanup_expired_files()

            # Clean up completed tasks (after file expiry)
            await cleanup_completed_tasks()

            # Clean up orphaned tasks
            await cleanup_orphaned_tasks()

            # Clean up orphaned upload files on disk
            await cleanup_upload_files(settings.STORAGE_PATH)

            # Clean up processed files that outlived their expiry (no DB row)
            await cleanup_processed_files(settings.STORAGE_PATH)

            # Clean up old usage statistics
            await cleanup_usage_stats()

            # Clean up old audit logs
            await cleanup_audit_logs()

            logger.debug("Scheduled cleanup completed")

        except Exception as e:
            logger.error(f"Cleanup error: {e}", exc_info=True)

        await asyncio.sleep(interval_minutes * 60)


async def purge_all_user_data(client_ip_hash: Optional[str] = None) -> dict:
    """
    GDPR: Purge all data for a specific client or all data.

    This is a destructive operation - use with caution.

    Args:
        client_ip_hash: If provided, only purge data for this client

    Returns:
        Dictionary with counts of deleted records
    """
    from app.config import settings

    result = {
        "tasks_deleted": 0,
        "input_files_deleted": 0,
        "output_files_deleted": 0,
        "audit_logs_deleted": 0,
    }

    async with async_session_maker() as session:
        if client_ip_hash:
            # Delete audit logs for specific client
            audit_result = await session.execute(
                delete(AuditLog).where(AuditLog.client_ip == client_ip_hash)
            )
            result["audit_logs_deleted"] = audit_result.rowcount
        else:
            # Full data purge - delete all tasks (cascades to files)
            all_tasks = await session.execute(select(Task))
            tasks = all_tasks.scalars().all()

            for task in tasks:
                # Delete input files from disk
                input_count = await cleanup_input_files(session, task)
                result["input_files_deleted"] += input_count

                # Delete output files from disk
                output_result = await session.execute(
                    select(OutputFile).where(OutputFile.task_id == task.id)
                )
                for output_file in output_result.scalars().all():
                    file_path = Path(output_file.file_path)
                    try:
                        if file_path.exists():
                            file_path.unlink()
                            result["output_files_deleted"] += 1
                    except Exception as e:
                        logger.error(f"Failed to delete: {e}")

                await session.delete(task)
                result["tasks_deleted"] += 1

            # Delete all audit logs
            audit_result = await session.execute(delete(AuditLog))
            result["audit_logs_deleted"] = audit_result.rowcount

        await session.commit()

    logger.warning(f"GDPR purge completed: {result}")
    return result
