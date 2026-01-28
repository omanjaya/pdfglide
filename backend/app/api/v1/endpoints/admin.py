"""Admin endpoints for data retention and GDPR compliance."""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import DbSession
from app.schemas.response import APIResponse
from app.utils.cleanup import (
    cleanup_expired_files,
    cleanup_orphaned_tasks,
    cleanup_completed_tasks,
    cleanup_upload_files,
    cleanup_usage_stats,
    cleanup_audit_logs,
    purge_all_user_data,
)
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class RetentionSettings(BaseModel):
    """Current retention settings."""

    file_expiry_minutes: int
    delete_after_download: bool
    upload_retention_hours: int
    orphan_task_retention_hours: int
    usage_stats_retention_days: int
    audit_log_retention_days: int
    audit_logging_enabled: bool


class CleanupResult(BaseModel):
    """Result of cleanup operation."""

    expired_files: int
    orphaned_tasks: int
    completed_tasks: int
    upload_files: int
    usage_stats: int
    audit_logs: int


class PurgeResult(BaseModel):
    """Result of data purge operation."""

    tasks_deleted: int
    input_files_deleted: int
    output_files_deleted: int
    audit_logs_deleted: int


@router.get("/retention/settings", response_model=APIResponse[RetentionSettings])
async def get_retention_settings():
    """Get current data retention settings."""
    return APIResponse(
        success=True,
        data=RetentionSettings(
            file_expiry_minutes=settings.FILE_EXPIRY_MINUTES,
            delete_after_download=settings.DELETE_AFTER_DOWNLOAD,
            upload_retention_hours=settings.UPLOAD_RETENTION_HOURS,
            orphan_task_retention_hours=settings.ORPHAN_TASK_RETENTION_HOURS,
            usage_stats_retention_days=settings.USAGE_STATS_RETENTION_DAYS,
            audit_log_retention_days=settings.AUDIT_LOG_RETENTION_DAYS,
            audit_logging_enabled=settings.ENABLE_AUDIT_LOGGING,
        ),
    )


@router.post("/retention/cleanup", response_model=APIResponse[CleanupResult])
async def run_cleanup():
    """
    Manually trigger cleanup of expired data.

    This runs all cleanup tasks immediately instead of waiting for the scheduler.
    """
    try:
        result = CleanupResult(
            expired_files=await cleanup_expired_files(),
            orphaned_tasks=await cleanup_orphaned_tasks(),
            completed_tasks=await cleanup_completed_tasks(),
            upload_files=await cleanup_upload_files(settings.STORAGE_PATH),
            usage_stats=await cleanup_usage_stats(),
            audit_logs=await cleanup_audit_logs(),
        )

        logger.info(f"Manual cleanup completed: {result}")

        return APIResponse(
            success=True,
            data=result,
        )

    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Cleanup operation failed",
        )


@router.post("/gdpr/purge", response_model=APIResponse[PurgeResult])
async def gdpr_purge_data(
    confirm: bool = Query(
        ...,
        description="Must be true to confirm data deletion",
    ),
    client_ip_hash: Optional[str] = Query(
        default=None,
        description="Hash of client IP to purge data for (optional, purges all if not provided)",
    ),
):
    """
    GDPR: Purge user data.

    This is a destructive operation that permanently deletes data.

    - If `client_ip_hash` is provided, only audit logs for that client are deleted.
    - If not provided, ALL data (tasks, files, audit logs) is deleted.

    **WARNING**: This operation cannot be undone.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must confirm deletion by setting confirm=true",
        )

    try:
        result = await purge_all_user_data(client_ip_hash)

        logger.warning(
            f"GDPR data purge executed",
            extra={
                "client_ip_hash": client_ip_hash,
                "result": result,
            },
        )

        return APIResponse(
            success=True,
            data=PurgeResult(**result),
        )

    except Exception as e:
        logger.error(f"GDPR purge failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Purge operation failed",
        )


@router.get("/gdpr/export-info")
async def gdpr_export_info():
    """
    GDPR: Get information about data export capabilities.

    Note: Since this service doesn't store user accounts,
    data is identified by IP address hash or task ID.
    """
    return APIResponse(
        success=True,
        data={
            "message": "PDFGlide does not store personal user accounts.",
            "data_types_stored": [
                "Uploaded files (temporary, auto-deleted after configured retention period)",
                "Processed output files (temporary, auto-deleted after expiry)",
                "Task metadata (tool type, timestamps, file sizes)",
                "Audit logs (hashed IP, user agent, event types)",
                "Usage statistics (aggregated, no personal data)",
            ],
            "retention_periods": {
                "output_files": f"{settings.FILE_EXPIRY_MINUTES} minutes (delete after download: {settings.DELETE_AFTER_DOWNLOAD})",
                "input_files": f"{settings.UPLOAD_RETENTION_HOURS} hours",
                "audit_logs": f"{settings.AUDIT_LOG_RETENTION_DAYS} days",
                "usage_stats": f"{settings.USAGE_STATS_RETENTION_DAYS} days",
            },
            "data_access": "Use GET /api/v1/admin/audit-logs with your IP hash to retrieve your activity logs.",
            "data_deletion": "Use POST /api/v1/admin/gdpr/purge with your IP hash to delete your data.",
        },
    )


@router.get("/audit-logs")
async def get_audit_logs(
    db: DbSession,
    client_ip_hash: Optional[str] = Query(
        default=None,
        description="Filter by client IP hash",
    ),
    event_type: Optional[str] = Query(
        default=None,
        description="Filter by event type (upload, download, process, delete, error)",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=1000,
        description="Maximum number of records to return",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Number of records to skip",
    ),
):
    """
    Get audit logs with optional filtering.

    For GDPR compliance, users can retrieve their activity logs
    by providing their IP address hash.
    """
    from sqlalchemy import select, desc
    from app.models.task import AuditLog

    query = select(AuditLog)

    if client_ip_hash:
        query = query.where(AuditLog.client_ip == client_ip_hash)

    if event_type:
        query = query.where(AuditLog.event_type == event_type)

    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()

    return APIResponse(
        success=True,
        data={
            "count": len(logs),
            "logs": [
                {
                    "id": log.id,
                    "event_type": log.event_type,
                    "task_id": log.task_id,
                    "file_id": log.file_id,
                    "client_ip": log.client_ip,
                    "details": log.details,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ],
        },
    )
