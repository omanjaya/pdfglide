"""Task repository for database operations."""

from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, InputFile, OutputFile
from app.core.file_handler import FileHandler, FileInfo
from app.config import settings


class TaskRepository:
    """Repository for task-related database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_task(
        self,
        tool_type: str,
        metadata: Optional[dict] = None,
    ) -> Task:
        """Create a new task."""
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type=tool_type,
            status="processing",
            metadata=metadata or {},
        )
        self.db.add(task)
        return task

    async def save_input_file(
        self,
        task_id: str,
        file_info: FileInfo,
        order: int = 0,
    ) -> InputFile:
        """Save input file record."""
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
        return input_file

    async def save_output_file(
        self,
        task_id: str,
        result_id: str,
        file_name: str,
        file_path: Path,
        file_size: int,
        mime_type: str,
    ) -> OutputFile:
        """Save output file record."""
        expires_at = datetime.utcnow() + timedelta(minutes=settings.FILE_EXPIRY_MINUTES)
        output_file = OutputFile(
            id=result_id,
            task_id=task_id,
            file_name=file_name,
            file_path=str(file_path),
            file_size=file_size,
            mime_type=mime_type,
            expires_at=expires_at,
        )
        self.db.add(output_file)
        return output_file

    async def complete_task(self, task: Task) -> None:
        """Mark task as completed."""
        task.status = "completed"
        task.completed_at = datetime.utcnow()

    async def fail_task(self, task: Task, error: str) -> None:
        """Mark task as failed."""
        task.status = "failed"
        task.task_metadata = {**(task.task_metadata or {}), "error": error}
        task.completed_at = datetime.utcnow()

    async def commit(self) -> None:
        """Commit database transaction."""
        await self.db.commit()
