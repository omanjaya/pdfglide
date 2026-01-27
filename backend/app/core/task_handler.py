"""
Generic Task Handler - Eliminates boilerplate in endpoints.

This module provides a generic handler that manages the entire task lifecycle:
- Task creation
- File upload handling
- Processing delegation
- Output saving
- Error handling
- Response generation

Usage:
    handler = TaskHandler(db, service, "pdf_merge")
    result = await handler.execute(
        files=files,
        process_func=lambda paths: service.merge(paths),
    )
"""

import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable, Awaitable, Optional, Union, List, Any
from dataclasses import dataclass

from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, InputFile, OutputFile
from app.services.base import BaseService, ProcessedResult
from app.schemas.response import APIResponse
from app.schemas.task import TaskResponse, TaskStatusEnum
from app.core.file_handler import FileHandler
from app.core.exceptions import PDFGlideException
from app.core.logging import get_logger
from app.config import settings

logger = get_logger(__name__)


@dataclass
class TaskResult:
    """Result from task execution."""
    task_id: str
    status: TaskStatusEnum
    tool_type: str
    created_at: datetime
    completed_at: Optional[datetime]
    file_name: str
    file_size: int
    download_url: str
    expires_at: datetime


class TaskHandler:
    """
    Generic handler for file processing tasks.

    Handles all the common boilerplate:
    - Task creation and tracking
    - Input file saving
    - Processing execution
    - Output file saving
    - Error handling
    - Response generation
    """

    def __init__(
        self,
        db: AsyncSession,
        service: BaseService,
        tool_type: str,
    ):
        self.db = db
        self.service = service
        self.tool_type = tool_type

    async def execute(
        self,
        process_func: Callable[..., Awaitable[ProcessedResult]],
        files: Optional[List[UploadFile]] = None,
        file: Optional[UploadFile] = None,
        metadata: Optional[dict] = None,
        alt_service: Optional[BaseService] = None,
    ) -> APIResponse[TaskResponse]:
        """
        Execute a file processing task.

        Args:
            process_func: Async function that processes files and returns ProcessedResult
            files: List of files for multi-file operations
            file: Single file for single-file operations
            metadata: Additional task metadata
            alt_service: Alternative service for file validation (e.g., ImageService for images)

        Returns:
            APIResponse with TaskResponse data
        """
        start_time = time.perf_counter()
        task_id = None

        try:
            # Use alternative service if provided (for mixed file types)
            upload_service = alt_service or self.service

            # Create task
            task_id = FileHandler.generate_file_id()
            task = Task(
                id=task_id,
                tool_type=self.tool_type,
                status="processing",
                metadata=metadata or {},
            )
            self.db.add(task)

            logger.info(
                f"Task started: {self.tool_type}",
                extra={"task_id": task_id, "tool_type": self.tool_type},
            )

            # Save input files
            input_paths: List[Path] = []
            total_input_size = 0

            if files:
                for idx, f in enumerate(files):
                    file_info = await upload_service.save_input_file(f, task_id, idx)
                    self._add_input_file(task_id, file_info, idx)
                    input_paths.append(file_info.file_path)
                    total_input_size += file_info.file_size
            elif file:
                file_info = await upload_service.save_input_file(file, task_id, 0)
                self._add_input_file(task_id, file_info, 0)
                input_paths.append(file_info.file_path)
                total_input_size = file_info.file_size

            # Execute processing
            result = await process_func(input_paths)

            # Save output
            expires_at = datetime.utcnow() + timedelta(hours=settings.FILE_EXPIRY_HOURS)
            output_file = OutputFile(
                id=result.id,
                task_id=task_id,
                file_name=result.file_name,
                file_path=str(result.file_path),
                file_size=result.file_size,
                mime_type=result.mime_type,
                expires_at=expires_at,
            )
            self.db.add(output_file)

            # Complete task
            task.status = "completed"
            task.completed_at = datetime.utcnow()

            await self.db.commit()

            # Log success
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(
                f"Task completed: {self.tool_type}",
                extra={
                    "task_id": task_id,
                    "tool_type": self.tool_type,
                    "duration_ms": duration_ms,
                    "input_size": total_input_size,
                    "output_size": result.file_size,
                },
            )

            # Return response
            return APIResponse(
                success=True,
                data=TaskResponse(
                    task_id=task_id,
                    status=TaskStatusEnum.COMPLETED,
                    tool_type=self.tool_type,
                    created_at=task.created_at,
                    completed_at=task.completed_at,
                    file_name=result.file_name,
                    file_size=result.file_size,
                    download_url=f"/api/v1/download/{result.id}",
                    expires_at=expires_at,
                ),
            )

        except PDFGlideException as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.warning(
                f"Task failed (validation): {e.message}",
                extra={"task_id": task_id, "tool_type": self.tool_type, "duration_ms": duration_ms},
            )
            raise HTTPException(status_code=e.status_code, detail=e.message)
        except Exception as e:
            import uuid
            error_id = str(uuid.uuid4())[:8]
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"Task failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
                extra={
                    "task_id": task_id,
                    "tool_type": self.tool_type,
                    "duration_ms": duration_ms,
                    "error_id": error_id,
                    "error_type": type(e).__name__,
                },
                exc_info=True,
            )
            # Return sanitized error message - don't expose internal details
            raise HTTPException(
                status_code=500,
                detail=f"Processing failed. Please try again. (Error ID: {error_id})"
            )

    def _add_input_file(self, task_id: str, file_info, order: int) -> None:
        """Add input file record to database."""
        input_file = InputFile(
            id=FileHandler.generate_file_id(),
            task_id=task_id,
            original_name=file_info.original_name,
            stored_name=file_info.stored_name,
            file_path=str(file_info.file_path),
            file_size=file_info.file_size,
            mime_type=file_info.mime_type,
            upload_order=order,
        )
        self.db.add(input_file)


async def handle_task(
    db: AsyncSession,
    service: BaseService,
    tool_type: str,
    process_func: Callable[..., Awaitable[ProcessedResult]],
    files: Optional[List[UploadFile]] = None,
    file: Optional[UploadFile] = None,
    metadata: Optional[dict] = None,
    alt_service: Optional[BaseService] = None,
) -> APIResponse[TaskResponse]:
    """
    Functional helper for handling tasks.

    Example:
        return await handle_task(
            db, service, "pdf_merge",
            process_func=lambda paths: service.merge(paths),
            files=files,
        )
    """
    handler = TaskHandler(db, service, tool_type)
    return await handler.execute(
        process_func=process_func,
        files=files,
        file=file,
        metadata=metadata,
        alt_service=alt_service,
    )
