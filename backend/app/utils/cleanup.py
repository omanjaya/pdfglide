"""File cleanup utilities with GDPR-compliant data retention."""

import asyncio
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import OutputFile, Task, InputFile, UsageStats, AuditLog
from app.models.database import async_session_maker

logger = logging.getLogger(__name__)


async def cleanup_expired_files() -> int:
    """
    Clean up expired output files from storage and database.

    Returns:
        Number of files cleaned up
    """
    async with async_session_maker() as session:
        # Find expired files
        result = await session.execute(
            select(OutputFile).where(OutputFile.expires_at < datetime.utcnow())
        )
        expired_files = result.scalars().all()

        cleaned_count = 0
        for output_file in expired_files:
            # Delete physical file
            file_path = Path(output_file.file_path)
            try:
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Deleted output file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete file {file_path}: {e}")

            # Delete from database
            await session.delete(output_file)
            cleaned_count += 1

        await session.commit()
        logger.info(f"Cleaned up {cleaned_count} expired output files")

        return cleaned_count


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
        hours_old = settings.FILE_EXPIRY_HOURS + 1  # 1 hour after file expiry

    async with async_session_maker() as session:
        cutoff = datetime.utcnow() - timedelta(hours=hours_old)

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

    logger.info(f"Cleaned up {cleaned_count} upload files")
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
            logger.info("Running scheduled cleanup...")

            # Clean up expired output files
            await cleanup_expired_files()

            # Clean up completed tasks (after file expiry)
            await cleanup_completed_tasks()

            # Clean up orphaned tasks
            await cleanup_orphaned_tasks()

            # Clean up orphaned upload files on disk
            await cleanup_upload_files(settings.STORAGE_PATH)

            # Clean up old usage statistics
            await cleanup_usage_stats()

            # Clean up old audit logs
            await cleanup_audit_logs()

            logger.info("Scheduled cleanup completed")

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
