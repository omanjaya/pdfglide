"""Audit logging service for GDPR compliance."""

import hashlib
import logging
from datetime import datetime
from typing import Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import AuditLog
from app.config import settings

logger = logging.getLogger(__name__)


class AuditEventType:
    """Audit event types."""

    UPLOAD = "upload"
    DOWNLOAD = "download"
    PROCESS = "process"
    DELETE = "delete"
    ACCESS = "access"
    ERROR = "error"


def hash_ip(ip: str) -> str:
    """
    Hash an IP address for privacy.

    Uses SHA-256 with a salt derived from the app name.
    """
    salt = settings.APP_NAME.encode()
    return hashlib.sha256(salt + ip.encode()).hexdigest()[:16]


def get_client_info(request: Request) -> dict:
    """
    Extract client information from request.

    Returns:
        Dictionary with hashed client IP and user agent
    """
    client_ip = request.client.host if request.client else "unknown"

    # Check X-Forwarded-For if behind proxy
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Get the first (original client) IP
        client_ip = forwarded_for.split(",")[0].strip()

    return {
        "client_ip_hash": hash_ip(client_ip),
        "user_agent": request.headers.get("User-Agent", "")[:500],  # Limit length
    }


async def log_audit_event(
    db: AsyncSession,
    event_type: str,
    request: Optional[Request] = None,
    task_id: Optional[str] = None,
    file_id: Optional[str] = None,
    details: Optional[dict] = None,
) -> Optional[AuditLog]:
    """
    Log an audit event.

    Args:
        db: Database session
        event_type: Type of event (upload, download, process, delete, access, error)
        request: FastAPI request object (for client info)
        task_id: Related task ID
        file_id: Related file ID
        details: Additional event details

    Returns:
        Created AuditLog entry or None if audit logging is disabled
    """
    if not settings.ENABLE_AUDIT_LOGGING:
        return None

    try:
        client_info = get_client_info(request) if request else {}

        audit_entry = AuditLog(
            event_type=event_type,
            task_id=task_id,
            file_id=file_id,
            client_ip=client_info.get("client_ip_hash"),
            user_agent=client_info.get("user_agent"),
            details=details,
        )

        db.add(audit_entry)
        # Note: Caller is responsible for commit

        logger.debug(
            f"Audit log: {event_type}",
            extra={
                "event_type": event_type,
                "task_id": task_id,
                "file_id": file_id,
            },
        )

        return audit_entry

    except Exception as e:
        # Don't fail the request if audit logging fails
        logger.error(f"Failed to create audit log: {e}")
        return None


async def log_upload(
    db: AsyncSession,
    request: Request,
    task_id: str,
    file_name: str,
    file_size: int,
) -> Optional[AuditLog]:
    """Log a file upload event."""
    return await log_audit_event(
        db=db,
        event_type=AuditEventType.UPLOAD,
        request=request,
        task_id=task_id,
        details={
            "file_name": file_name[:255],  # Limit filename length
            "file_size": file_size,
        },
    )


async def log_download(
    db: AsyncSession,
    request: Request,
    task_id: str,
    file_id: str,
    file_name: str,
) -> Optional[AuditLog]:
    """Log a file download event."""
    return await log_audit_event(
        db=db,
        event_type=AuditEventType.DOWNLOAD,
        request=request,
        task_id=task_id,
        file_id=file_id,
        details={
            "file_name": file_name[:255],
        },
    )


async def log_process(
    db: AsyncSession,
    request: Request,
    task_id: str,
    tool_type: str,
    input_files: int,
    output_size: int,
    processing_time_ms: int,
) -> Optional[AuditLog]:
    """Log a file processing event."""
    return await log_audit_event(
        db=db,
        event_type=AuditEventType.PROCESS,
        request=request,
        task_id=task_id,
        details={
            "tool_type": tool_type,
            "input_files": input_files,
            "output_size": output_size,
            "processing_time_ms": processing_time_ms,
        },
    )


async def log_delete(
    db: AsyncSession,
    request: Optional[Request],
    task_id: str,
    reason: str = "manual",
) -> Optional[AuditLog]:
    """Log a file deletion event."""
    return await log_audit_event(
        db=db,
        event_type=AuditEventType.DELETE,
        request=request,
        task_id=task_id,
        details={
            "reason": reason,
        },
    )


async def log_error(
    db: AsyncSession,
    request: Request,
    error_id: str,
    error_type: str,
    task_id: Optional[str] = None,
) -> Optional[AuditLog]:
    """Log an error event."""
    return await log_audit_event(
        db=db,
        event_type=AuditEventType.ERROR,
        request=request,
        task_id=task_id,
        details={
            "error_id": error_id,
            "error_type": error_type,
        },
    )
