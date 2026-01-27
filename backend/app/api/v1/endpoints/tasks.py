"""
Task status and management endpoints.

These endpoints allow clients to:
- Check the status of async tasks
- Get task progress updates
- Cancel pending tasks
"""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import DbSession
from app.models.task import Task, OutputFile
from app.schemas.response import APIResponse

router = APIRouter()


class TaskStatusResponse:
    """Response model for task status."""
    
    def __init__(
        self,
        task_id: str,
        status: str,
        tool_type: str,
        created_at: datetime,
        updated_at: datetime,
        completed_at: Optional[datetime] = None,
        progress: Optional[int] = None,
        download_url: Optional[str] = None,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None,
        expires_at: Optional[datetime] = None,
        error: Optional[str] = None,
    ):
        self.task_id = task_id
        self.status = status
        self.tool_type = tool_type
        self.created_at = created_at
        self.updated_at = updated_at
        self.completed_at = completed_at
        self.progress = progress
        self.download_url = download_url
        self.file_name = file_name
        self.file_size = file_size
        self.expires_at = expires_at
        self.error = error


@router.get("/tasks/{task_id}/status")
async def get_task_status(
    task_id: str,
    db: DbSession,
):
    """
    Get the status of an async processing task.
    
    Returns:
        Task status including progress, download URL (if completed), or error message (if failed)
    
    Status values:
        - pending: Task created but not yet started
        - queued: Task added to processing queue
        - processing: Task is being processed
        - completed: Task finished successfully
        - failed: Task failed with error
    """
    # Get task from database
    task = await db.get(Task, task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Build response
    response = {
        "task_id": task_id,
        "status": task.status,
        "tool_type": task.tool_type,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }
    
    # Add progress if available
    if task.task_metadata and "progress" in task.task_metadata:
        response["progress"] = task.task_metadata["progress"]
    
    # Add completion details if completed
    if task.status == "completed":
        response["completed_at"] = task.completed_at.isoformat() if task.completed_at else None
        
        # Get output file
        result = await db.execute(
            select(OutputFile).where(OutputFile.task_id == task_id)
        )
        output_file = result.scalar_one_or_none()
        
        if output_file:
            response["download_url"] = f"/api/v1/download/{output_file.id}"
            response["file_name"] = output_file.file_name
            response["file_size"] = output_file.file_size
            response["expires_at"] = output_file.expires_at.isoformat()
    
    # Add error if failed
    elif task.status == "failed":
        response["error"] = task.error_message or "Unknown error"
    
    # Add metadata stats if available
    if task.task_metadata:
        if "compression_stats" in task.task_metadata:
            response["metadata"] = {"compression_stats": task.task_metadata["compression_stats"]}
    
    return APIResponse(success=True, data=response)


@router.get("/tasks/{task_id}/poll")
async def poll_task_status(
    task_id: str,
    db: DbSession,
    last_status: Optional[str] = Query(None, description="Only return if status changed from this"),
):
    """
    Long-poll for task status updates.
    
    If last_status is provided, only returns when status changes.
    Useful for efficient polling without WebSocket.
    """
    import asyncio
    
    task = await db.get(Task, task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # If no last_status or status has changed, return immediately
    if not last_status or task.status != last_status:
        return await get_task_status(task_id, db)
    
    # Wait for status change (max 30 seconds)
    max_wait = 30
    poll_interval = 1
    waited = 0
    
    while waited < max_wait:
        await asyncio.sleep(poll_interval)
        waited += poll_interval
        
        # Refresh task from DB
        await db.refresh(task)
        
        if task.status != last_status:
            break
    
    return await get_task_status(task_id, db)


@router.delete("/tasks/{task_id}")
async def cancel_task(
    task_id: str,
    db: DbSession,
):
    """
    Cancel a pending or queued task.
    
    Only tasks in 'pending' or 'queued' status can be cancelled.
    Tasks already processing cannot be cancelled.
    """
    task = await db.get(Task, task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status not in ["pending", "queued"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task in '{task.status}' status. Only pending/queued tasks can be cancelled."
        )
    
    # Try to revoke from Celery queue
    try:
        from app.core.celery_app import celery_app
        celery_app.control.revoke(task_id, terminate=False)
    except Exception:
        pass  # Best effort
    
    # Update task status
    task.status = "cancelled"
    task.error_message = "Task cancelled by user"
    await db.commit()
    
    return APIResponse(
        success=True,
        data={"message": "Task cancelled", "task_id": task_id}
    )


@router.get("/tasks")
async def list_tasks(
    db: DbSession,
    status: Optional[str] = Query(None, description="Filter by status"),
    tool_type: Optional[str] = Query(None, description="Filter by tool type"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List recent tasks.
    
    Useful for admin/dashboard views.
    """
    from sqlalchemy import desc
    
    query = select(Task)
    
    if status:
        query = query.where(Task.status == status)
    if tool_type:
        query = query.where(Task.tool_type == tool_type)
    
    query = query.order_by(desc(Task.created_at)).offset(offset).limit(limit)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return APIResponse(
        success=True,
        data={
            "tasks": [
                {
                    "task_id": t.id,
                    "status": t.status,
                    "tool_type": t.tool_type,
                    "created_at": t.created_at.isoformat(),
                    "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                }
                for t in tasks
            ],
            "limit": limit,
            "offset": offset,
        }
    )
