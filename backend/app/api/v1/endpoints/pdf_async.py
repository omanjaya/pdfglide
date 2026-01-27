"""
Async PDF processing endpoints.

These endpoints use the background queue system for processing.
Files are uploaded, a task is created, and processing happens asynchronously.
Clients poll for status or use WebSocket for real-time updates.
"""

from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query

from app.api.deps import DbSession, PDFServiceDep
from app.schemas.response import APIResponse
from app.schemas.task import TaskStatusEnum
from app.core.file_handler import FileHandler
from app.models.task import Task, InputFile
from app.config import settings

router = APIRouter()


class TaskCreatedResponse:
    """Response when an async task is created."""
    
    def __init__(
        self,
        task_id: str,
        status: str,
        message: str,
        status_url: str,
        poll_url: str,
    ):
        self.task_id = task_id
        self.status = status
        self.message = message
        self.status_url = status_url
        self.poll_url = poll_url


async def _save_input_files(
    db: DbSession,
    service,
    task_id: str,
    files: Optional[List[UploadFile]] = None,
    file: Optional[UploadFile] = None,
) -> List[str]:
    """Save uploaded files and return their paths."""
    file_paths = []
    
    if files:
        for idx, f in enumerate(files):
            file_info = await service.save_input_file(f, task_id, idx)
            
            db.add(InputFile(
                id=FileHandler.generate_file_id(),
                task_id=task_id,
                original_name=file_info.original_name,
                stored_name=file_info.stored_name,
                file_path=str(file_info.file_path),
                file_size=file_info.file_size,
                mime_type=file_info.mime_type,
                upload_order=idx,
            ))
            file_paths.append(str(file_info.file_path))
    
    elif file:
        file_info = await service.save_input_file(file, task_id, 0)
        
        db.add(InputFile(
            id=FileHandler.generate_file_id(),
            task_id=task_id,
            original_name=file_info.original_name,
            stored_name=file_info.stored_name,
            file_path=str(file_info.file_path),
            file_size=file_info.file_size,
            mime_type=file_info.mime_type,
            upload_order=0,
        ))
        file_paths.append(str(file_info.file_path))
    
    return file_paths


def _should_use_async(file_paths: List[str], force_async: bool = False) -> bool:
    """Determine if async processing should be used based on file sizes."""
    if not settings.ENABLE_ASYNC_PROCESSING:
        return False
    
    if force_async:
        return True
    
    # Check total file size
    import os
    total_size = sum(os.path.getsize(p) for p in file_paths)
    
    return total_size > settings.ASYNC_THRESHOLD_SIZE


# =============================================================================
# ASYNC PDF ENDPOINTS
# =============================================================================


@router.post("/merge/async")
async def merge_pdfs_async(
    db: DbSession,
    service: PDFServiceDep,
    files: list[UploadFile] = File(..., description="PDF files to merge (2-20)"),
    force_async: bool = Query(False, description="Force async processing regardless of file size"),
):
    """
    Merge multiple PDF files asynchronously.
    
    Returns immediately with a task ID. Poll /api/v1/tasks/{task_id}/status for results.
    """
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required")
    if len(files) > settings.MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_FILES_PER_REQUEST} files allowed")
    
    try:
        # Create task
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_merge",
            status="pending",
            task_metadata={"file_count": len(files)},
        )
        db.add(task)
        
        # Save input files
        file_paths = await _save_input_files(db, service, task_id, files=files)
        
        await db.commit()
        
        # Queue the task
        from app.workers.pdf_tasks import process_pdf_merge
        process_pdf_merge.delay(task_id, file_paths)
        
        # Update status to queued
        task.status = "queued"
        await db.commit()
        
        return APIResponse(
            success=True,
            data={
                "task_id": task_id,
                "status": "queued",
                "message": "Task queued for processing",
                "status_url": f"/api/v1/tasks/{task_id}/status",
                "poll_url": f"/api/v1/tasks/{task_id}/poll",
            }
        )
        
    except Exception as e:
        import uuid as uuid_mod
        import logging
        error_id = str(uuid_mod.uuid4())[:8]
        logging.getLogger(__name__).error(
            f"Failed to queue task [error_id={error_id}]: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create task. (Error ID: {error_id})"
        )


@router.post("/compress/async")
async def compress_pdf_async(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    quality: str = Form(default="medium", description="Quality: extreme, low, medium, high"),
    compress_images: bool = Form(default=True),
    image_dpi: Optional[int] = Form(default=None, ge=72, le=600),
    remove_metadata: bool = Form(default=False),
    grayscale: bool = Form(default=False),
    target_size_kb: Optional[int] = Form(default=None, ge=10, le=102400),
    preserve_quality: bool = Form(default=True),
):
    """
    Compress PDF asynchronously.
    
    Returns immediately with a task ID. Poll /api/v1/tasks/{task_id}/status for results.
    """
    try:
        # Create task
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_compress",
            status="pending",
            task_metadata={
                "quality": quality,
                "compress_images": compress_images,
                "image_dpi": image_dpi,
                "remove_metadata": remove_metadata,
                "grayscale": grayscale,
                "target_size_kb": target_size_kb,
                "preserve_quality": preserve_quality,
            },
        )
        db.add(task)
        
        # Save input file
        file_paths = await _save_input_files(db, service, task_id, file=file)
        
        await db.commit()
        
        # Queue the task
        from app.workers.pdf_tasks import process_pdf_compress
        process_pdf_compress.delay(
            task_id,
            file_paths[0],
            quality=quality,
            compress_images=compress_images,
            image_dpi=image_dpi,
            remove_metadata=remove_metadata,
            grayscale=grayscale,
            target_size_kb=target_size_kb,
            preserve_quality=preserve_quality,
        )
        
        # Update status to queued
        task.status = "queued"
        await db.commit()
        
        return APIResponse(
            success=True,
            data={
                "task_id": task_id,
                "status": "queued",
                "message": "Task queued for processing",
                "status_url": f"/api/v1/tasks/{task_id}/status",
                "poll_url": f"/api/v1/tasks/{task_id}/poll",
            }
        )
        
    except Exception as e:
        import uuid as uuid_mod
        import logging
        error_id = str(uuid_mod.uuid4())[:8]
        logging.getLogger(__name__).error(
            f"Failed to queue task [error_id={error_id}]: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create task. (Error ID: {error_id})"
        )


@router.post("/split/async")
async def split_pdf_async(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    pages: str = Form(..., description="Page ranges: '1-3,5,7-10'"),
):
    """
    Split PDF asynchronously.
    
    Returns immediately with a task ID. Poll /api/v1/tasks/{task_id}/status for results.
    """
    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_split",
            status="pending",
            task_metadata={"pages": pages},
        )
        db.add(task)
        
        file_paths = await _save_input_files(db, service, task_id, file=file)
        await db.commit()
        
        from app.workers.pdf_tasks import process_pdf_split
        process_pdf_split.delay(task_id, file_paths[0], pages)
        
        task.status = "queued"
        await db.commit()
        
        return APIResponse(
            success=True,
            data={
                "task_id": task_id,
                "status": "queued",
                "message": "Task queued for processing",
                "status_url": f"/api/v1/tasks/{task_id}/status",
            }
        )
        
    except Exception as e:
        import uuid as uuid_mod
        import logging
        error_id = str(uuid_mod.uuid4())[:8]
        logging.getLogger(__name__).error(f"Failed to queue task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create task. (Error ID: {error_id})")


@router.post("/rotate/async")
async def rotate_pdf_async(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    rotation: int = Form(default=90, description="Angle: 90, 180, 270"),
    pages: str = Form(default="all"),
):
    """
    Rotate PDF pages asynchronously.
    """
    if rotation not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="Rotation must be 90, 180, or 270")
    
    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_rotate",
            status="pending",
            task_metadata={"rotation": rotation, "pages": pages},
        )
        db.add(task)
        
        file_paths = await _save_input_files(db, service, task_id, file=file)
        await db.commit()
        
        from app.workers.pdf_tasks import process_pdf_rotate
        process_pdf_rotate.delay(task_id, file_paths[0], rotation, pages)
        
        task.status = "queued"
        await db.commit()
        
        return APIResponse(
            success=True,
            data={
                "task_id": task_id,
                "status": "queued",
                "message": "Task queued for processing",
                "status_url": f"/api/v1/tasks/{task_id}/status",
            }
        )
        
    except Exception as e:
        import uuid as uuid_mod
        import logging
        error_id = str(uuid_mod.uuid4())[:8]
        logging.getLogger(__name__).error(f"Failed to queue task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create task. (Error ID: {error_id})")


@router.post("/watermark/async")
async def add_watermark_async(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    text: str = Form(..., description="Watermark text"),
    position: str = Form(default="center"),
    opacity: float = Form(default=0.3),
    rotation: int = Form(default=45),
    font_size: int = Form(default=60),
    color: str = Form(default="gray"),
    pages: str = Form(default="all"),
):
    """
    Add watermark to PDF asynchronously.
    """
    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_watermark",
            status="pending",
            task_metadata={"text": text, "position": position},
        )
        db.add(task)
        
        file_paths = await _save_input_files(db, service, task_id, file=file)
        await db.commit()
        
        from app.workers.pdf_tasks import process_pdf_watermark
        process_pdf_watermark.delay(
            task_id, file_paths[0], text, position,
            opacity, rotation, font_size, color, pages
        )
        
        task.status = "queued"
        await db.commit()
        
        return APIResponse(
            success=True,
            data={
                "task_id": task_id,
                "status": "queued",
                "message": "Task queued for processing",
                "status_url": f"/api/v1/tasks/{task_id}/status",
            }
        )
        
    except Exception as e:
        import uuid as uuid_mod
        import logging
        error_id = str(uuid_mod.uuid4())[:8]
        logging.getLogger(__name__).error(f"Failed to queue task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create task. (Error ID: {error_id})")
