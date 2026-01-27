"""
PDF processing background tasks.

This module contains Celery tasks for CPU-intensive PDF operations
that should be processed in the background.
"""

import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from app.core.celery_app import celery_app
from app.config import settings

logger = logging.getLogger(__name__)


def get_sync_session():
    """Get synchronous database session for worker tasks."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    
    engine = create_engine(settings.DATABASE_URL_SYNC)
    Session = sessionmaker(bind=engine)
    return Session()


def update_task_status(
    task_id: str,
    status: str,
    error_message: Optional[str] = None,
    progress: Optional[int] = None,
    metadata: Optional[dict] = None,
):
    """Update task status in database."""
    from app.models.task import Task
    
    session = get_sync_session()
    try:
        task = session.query(Task).filter(Task.id == task_id).first()
        if task:
            task.status = status
            task.updated_at = datetime.utcnow()
            
            if status == "completed":
                task.completed_at = datetime.utcnow()
            
            if error_message:
                task.error_message = error_message
            
            if progress is not None or metadata:
                current_metadata = task.task_metadata or {}
                if progress is not None:
                    current_metadata["progress"] = progress
                if metadata:
                    current_metadata.update(metadata)
                task.task_metadata = current_metadata
            
            session.commit()
            logger.info(f"Task {task_id} status updated to {status}")
    except Exception as e:
        logger.error(f"Failed to update task {task_id}: {e}")
        session.rollback()
    finally:
        session.close()


def save_output_file(task_id: str, result, expires_hours: int = 1):
    """Save output file record to database."""
    from app.models.task import OutputFile
    
    session = get_sync_session()
    try:
        expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
        
        output_file = OutputFile(
            id=result.id,
            task_id=task_id,
            file_name=result.file_name,
            file_path=str(result.file_path),
            file_size=result.file_size,
            mime_type=result.mime_type,
            expires_at=expires_at,
        )
        session.add(output_file)
        session.commit()
        
        logger.info(f"Output file saved for task {task_id}: {result.file_name}")
        return output_file.id
    except Exception as e:
        logger.error(f"Failed to save output for task {task_id}: {e}")
        session.rollback()
        raise
    finally:
        session.close()


def publish_progress(task_id: str, progress: int, status: str = "processing"):
    """Publish progress update to Redis for real-time WebSocket updates."""
    try:
        import redis
        import json
        
        r = redis.from_url(settings.REDIS_URL)
        r.publish(
            f"task:{task_id}",
            json.dumps({
                "task_id": task_id,
                "progress": progress,
                "status": status,
                "timestamp": datetime.utcnow().isoformat(),
            })
        )
    except Exception as e:
        logger.warning(f"Failed to publish progress for task {task_id}: {e}")


# =============================================================================
# PDF HEAVY TASKS
# =============================================================================


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=540,
    time_limit=600,
)
def process_pdf_merge(self, task_id: str, file_paths: list[str]):
    """
    Background task for merging multiple PDF files.
    
    Args:
        task_id: The task ID in database
        file_paths: List of input PDF file paths
    """
    logger.info(f"Starting PDF merge task {task_id} with {len(file_paths)} files")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        publish_progress(task_id, 10)
        
        from app.services.pdf_service import PDFService
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        paths = [Path(p) for p in file_paths]
        
        # Run async merge in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(service.merge(paths))
        finally:
            loop.close()
        
        update_task_status(task_id, "processing", progress=80)
        publish_progress(task_id, 80)
        
        # Save output
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        
        update_task_status(task_id, "completed", progress=100)
        publish_progress(task_id, 100, "completed")
        
        logger.info(f"PDF merge task {task_id} completed successfully")
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"PDF merge task {task_id} timed out")
        update_task_status(task_id, "failed", "Task timed out after 9 minutes")
        publish_progress(task_id, 0, "failed")
        raise
        
    except Exception as e:
        logger.error(f"PDF merge task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        publish_progress(task_id, 0, "failed")
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=540,
    time_limit=600,
)
def process_pdf_compress(
    self,
    task_id: str,
    file_path: str,
    quality: str = "medium",
    compress_images: bool = True,
    image_dpi: Optional[int] = None,
    remove_metadata: bool = False,
    grayscale: bool = False,
    target_size_kb: Optional[int] = None,
    preserve_quality: bool = True,
):
    """
    Background task for compressing PDF files.
    
    Args:
        task_id: The task ID in database
        file_path: Input PDF file path
        quality: Compression quality level
        compress_images: Whether to compress embedded images
        image_dpi: Target DPI for images
        remove_metadata: Whether to remove document metadata
        grayscale: Convert to grayscale
        target_size_kb: Target file size in KB
        preserve_quality: Prioritize quality over compression ratio
    """
    logger.info(f"Starting PDF compress task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        publish_progress(task_id, 10)
        
        from app.services.pdf_service import PDFService
        from app.schemas.file import PDFCompressOptions
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        
        options = PDFCompressOptions(
            quality=quality,
            compress_images=compress_images,
            image_dpi=image_dpi,
            remove_metadata=remove_metadata,
            grayscale=grayscale,
            target_size_kb=target_size_kb,
            preserve_quality=preserve_quality,
        )
        
        # Run async compress in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result, stats = loop.run_until_complete(
                service.compress(Path(file_path), options)
            )
        finally:
            loop.close()
        
        update_task_status(task_id, "processing", progress=80)
        publish_progress(task_id, 80)
        
        # Save output
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        
        update_task_status(
            task_id, "completed", progress=100,
            metadata={"compression_stats": stats}
        )
        publish_progress(task_id, 100, "completed")
        
        logger.info(f"PDF compress task {task_id} completed successfully")
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
            "stats": stats,
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"PDF compress task {task_id} timed out")
        update_task_status(task_id, "failed", "Task timed out after 9 minutes")
        publish_progress(task_id, 0, "failed")
        raise
        
    except Exception as e:
        logger.error(f"PDF compress task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        publish_progress(task_id, 0, "failed")
        raise


# =============================================================================
# PDF LIGHT TASKS
# =============================================================================


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=120,
    time_limit=180,
)
def process_pdf_split(self, task_id: str, file_path: str, pages: str):
    """
    Background task for splitting PDF files.
    
    Args:
        task_id: The task ID in database
        file_path: Input PDF file path
        pages: Page ranges to split (e.g., "1-3,5,7-10")
    """
    logger.info(f"Starting PDF split task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.pdf_service import PDFService
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.split(Path(file_path), pages)
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"PDF split task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=120,
    time_limit=180,
)
def process_pdf_rotate(
    self,
    task_id: str,
    file_path: str,
    rotation: int = 90,
    pages: str = "all",
):
    """
    Background task for rotating PDF pages.
    
    Args:
        task_id: The task ID in database
        file_path: Input PDF file path
        rotation: Rotation angle (90, 180, 270)
        pages: Pages to rotate
    """
    logger.info(f"Starting PDF rotate task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.pdf_service import PDFService
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.rotate(Path(file_path), rotation, pages)
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"PDF rotate task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=120,
    time_limit=180,
)
def process_pdf_watermark(
    self,
    task_id: str,
    file_path: str,
    text: str,
    position: str = "center",
    opacity: float = 0.3,
    rotation: int = 45,
    font_size: int = 60,
    color: str = "gray",
    pages: str = "all",
):
    """Background task for adding watermark to PDF."""
    logger.info(f"Starting PDF watermark task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.pdf_service import PDFService
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.add_watermark(
                    Path(file_path), text, position, opacity,
                    rotation, font_size, color, pages
                )
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"PDF watermark task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=60,
    time_limit=120,
)
def process_pdf_protect(
    self,
    task_id: str,
    file_path: str,
    user_password: Optional[str] = None,
    owner_password: Optional[str] = None,
    allow_printing: bool = True,
    allow_copying: bool = False,
    allow_modifying: bool = False,
):
    """Background task for protecting PDF with password."""
    logger.info(f"Starting PDF protect task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.pdf_service import PDFService
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.protect(
                    Path(file_path), user_password, owner_password,
                    allow_printing, allow_copying, allow_modifying
                )
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"PDF protect task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=60,
    time_limit=120,
)
def process_pdf_unlock(self, task_id: str, file_path: str, password: str = ""):
    """Background task for removing password from PDF."""
    logger.info(f"Starting PDF unlock task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.pdf_service import PDFService
        import asyncio
        
        service = PDFService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.unlock(Path(file_path), password)
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"PDF unlock task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise
