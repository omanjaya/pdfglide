"""Task-related schemas."""

from datetime import datetime
from typing import Optional, Any
from enum import Enum

from pydantic import BaseModel


class TaskStatusEnum(str, Enum):
    """Task status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskCreate(BaseModel):
    """Schema for creating a task."""

    tool_type: str
    metadata: Optional[dict[str, Any]] = None


class TaskStatus(BaseModel):
    """Schema for task status response."""

    task_id: str
    status: TaskStatusEnum
    progress: int = 0
    message: Optional[str] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None


class TaskResponse(BaseModel):
    """Schema for task response."""

    task_id: str
    status: TaskStatusEnum
    tool_type: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    download_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    metadata: Optional[dict[str, Any]] = None  # Additional task data (e.g., compression stats)

    class Config:
        from_attributes = True
