"""
Structured logging configuration for PDFGlide.

Provides consistent logging across all modules with:
- JSON format for production
- Human-readable format for development
- Request tracking
- Performance metrics
"""

import logging
import sys
import json
from datetime import datetime
from typing import Any, Optional
from functools import wraps
import time

from app.config import settings


class JSONFormatter(logging.Formatter):
    """JSON log formatter for production."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields
        if hasattr(record, "task_id"):
            log_data["task_id"] = record.task_id
        if hasattr(record, "tool_type"):
            log_data["tool_type"] = record.tool_type
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms
        if hasattr(record, "file_size"):
            log_data["file_size"] = record.file_size

        # Add exception info
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


class DevFormatter(logging.Formatter):
    """Human-readable formatter for development."""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET

        # Basic format
        msg = f"{color}[{record.levelname}]{reset} {record.name}: {record.getMessage()}"

        # Add context
        extras = []
        if hasattr(record, "task_id"):
            extras.append(f"task={record.task_id[:8]}")
        if hasattr(record, "tool_type"):
            extras.append(f"tool={record.tool_type}")
        if hasattr(record, "duration_ms"):
            extras.append(f"duration={record.duration_ms}ms")

        if extras:
            msg += f" ({', '.join(extras)})"

        return msg


def setup_logging():
    """Configure application logging."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)

    if settings.APP_ENV == "production":
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(DevFormatter())

    root_logger.addHandler(console_handler)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)


class LogContext:
    """Context manager for adding extra fields to logs."""

    def __init__(self, logger: logging.Logger, **kwargs):
        self.logger = logger
        self.extras = kwargs
        self.old_factory = None

    def __enter__(self):
        self.old_factory = logging.getLogRecordFactory()

        extras = self.extras

        def record_factory(*args, **kwargs):
            record = self.old_factory(*args, **kwargs)
            for key, value in extras.items():
                setattr(record, key, value)
            return record

        logging.setLogRecordFactory(record_factory)
        return self

    def __exit__(self, *args):
        logging.setLogRecordFactory(self.old_factory)


def log_operation(logger: logging.Logger):
    """Decorator to log function execution with timing."""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = await func(*args, **kwargs)
                duration = (time.perf_counter() - start) * 1000
                logger.info(
                    f"{func.__name__} completed",
                    extra={"duration_ms": round(duration, 2)},
                )
                return result
            except Exception as e:
                duration = (time.perf_counter() - start) * 1000
                logger.error(
                    f"{func.__name__} failed: {e}",
                    extra={"duration_ms": round(duration, 2)},
                    exc_info=True,
                )
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration = (time.perf_counter() - start) * 1000
                logger.info(
                    f"{func.__name__} completed",
                    extra={"duration_ms": round(duration, 2)},
                )
                return result
            except Exception as e:
                duration = (time.perf_counter() - start) * 1000
                logger.error(
                    f"{func.__name__} failed: {e}",
                    extra={"duration_ms": round(duration, 2)},
                    exc_info=True,
                )
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# Initialize on import
import asyncio
setup_logging()
