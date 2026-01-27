"""Core utilities."""

from app.core.exceptions import (
    PDFGlideException,
    InvalidFileTypeError,
    FileSizeExceededError,
    ProcessingError,
    FileNotFoundError,
)
from app.core.file_handler import FileHandler
from app.core.logging import get_logger, setup_logging, log_operation
from app.core.validators import (
    sanitize_filename,
    validate_upload_file,
    validate_page_range,
    validate_password_strength,
    validate_url,
    sanitize_text_input,
    validate_integer_range,
    ValidationResult,
)

# Note: TaskHandler and handle_task are imported directly from
# app.core.task_handler to avoid circular imports

__all__ = [
    # Exceptions
    "PDFGlideException",
    "InvalidFileTypeError",
    "FileSizeExceededError",
    "ProcessingError",
    "FileNotFoundError",
    # Handlers
    "FileHandler",
    # Logging
    "get_logger",
    "setup_logging",
    "log_operation",
    # Validators
    "sanitize_filename",
    "validate_upload_file",
    "validate_page_range",
    "validate_password_strength",
    "validate_url",
    "sanitize_text_input",
    "validate_integer_range",
    "ValidationResult",
]
