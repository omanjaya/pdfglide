"""Custom exceptions and error handling utilities."""

import uuid
import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)


class PDFGlideException(Exception):
    """Base exception for PDFGlide."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def raise_safe_http_error(
    exc: Exception,
    status_code: int = 500,
    safe_message: str = "An error occurred while processing your request",
    log_context: Optional[dict] = None,
) -> None:
    """
    Raise an HTTP exception with safe error handling.

    Logs the full error details but returns a sanitized message to the client.
    For known/expected errors (ProcessingError, etc.), the original message is used.

    Args:
        exc: The original exception
        status_code: HTTP status code to return
        safe_message: Safe message to return to client for unknown errors
        log_context: Additional context for logging
    """
    error_id = str(uuid.uuid4())[:8]

    # For our custom exceptions, use the original message (it's controlled)
    if isinstance(exc, PDFGlideException):
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )

    # For unknown exceptions, log and return safe message
    context = log_context or {}
    logger.error(
        f"Error [id={error_id}]: {type(exc).__name__}: {str(exc)}",
        extra={
            "error_id": error_id,
            "error_type": type(exc).__name__,
            **context,
        },
        exc_info=True,
    )

    raise HTTPException(
        status_code=status_code,
        detail=f"{safe_message} (Error ID: {error_id})",
    )


class InvalidFileTypeError(PDFGlideException):
    """Raised when file type is not allowed."""

    def __init__(self, message: str = "Invalid file type"):
        super().__init__(message, status_code=400)


class FileSizeExceededError(PDFGlideException):
    """Raised when file size exceeds limit."""

    def __init__(self, message: str = "File size exceeded"):
        super().__init__(message, status_code=413)


class ProcessingError(PDFGlideException):
    """Raised when file processing fails."""

    def __init__(self, message: str = "Processing failed"):
        super().__init__(message, status_code=400)


class FileNotFoundError(PDFGlideException):
    """Raised when file is not found."""

    def __init__(self, message: str = "File not found"):
        super().__init__(message, status_code=404)


class TaskNotFoundError(PDFGlideException):
    """Raised when task is not found."""

    def __init__(self, message: str = "Task not found"):
        super().__init__(message, status_code=404)


class FileExpiredError(PDFGlideException):
    """Raised when file has expired."""

    def __init__(self, message: str = "File has expired"):
        super().__init__(message, status_code=410)
