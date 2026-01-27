"""
Image processing background tasks.

This module contains Celery tasks for image operations.
"""

import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

from app.core.celery_app import celery_app
from app.config import settings
from app.workers.pdf_tasks import (
    update_task_status,
    save_output_file,
    publish_progress,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=300,
    time_limit=360,
)
def process_image_compress(
    self,
    task_id: str,
    file_path: str,
    quality: int = 85,
    max_width: Optional[int] = None,
    max_height: Optional[int] = None,
):
    """
    Background task for compressing images.
    
    Args:
        task_id: The task ID in database
        file_path: Input image file path
        quality: JPEG quality (1-100)
        max_width: Maximum width for resize
        max_height: Maximum height for resize
    """
    logger.info(f"Starting image compress task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        publish_progress(task_id, 10)
        
        from app.services.image_service import ImageService
        import asyncio
        
        service = ImageService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.compress(
                    Path(file_path),
                    quality=quality,
                    max_width=max_width,
                    max_height=max_height,
                )
            )
        finally:
            loop.close()
        
        update_task_status(task_id, "processing", progress=80)
        publish_progress(task_id, 80)
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        
        update_task_status(task_id, "completed", progress=100)
        publish_progress(task_id, 100, "completed")
        
        logger.info(f"Image compress task {task_id} completed successfully")
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"Image compress task {task_id} timed out")
        update_task_status(task_id, "failed", "Task timed out")
        publish_progress(task_id, 0, "failed")
        raise
        
    except Exception as e:
        logger.error(f"Image compress task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        publish_progress(task_id, 0, "failed")
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=300,
    time_limit=360,
)
def process_image_resize(
    self,
    task_id: str,
    file_path: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    maintain_aspect: bool = True,
):
    """Background task for resizing images."""
    logger.info(f"Starting image resize task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.image_service import ImageService
        import asyncio
        
        service = ImageService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.resize(
                    Path(file_path),
                    width=width,
                    height=height,
                    maintain_aspect=maintain_aspect,
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
        logger.error(f"Image resize task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
    soft_time_limit=600,
    time_limit=660,
)
def process_image_remove_background(self, task_id: str, file_path: str):
    """
    Background task for removing image background using AI.
    
    This is a heavy operation that uses rembg with U2-Net model.
    """
    logger.info(f"Starting image background removal task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        publish_progress(task_id, 10)
        
        from app.services.image_service import ImageService
        import asyncio
        
        service = ImageService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.remove_background(Path(file_path))
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_hours=settings.FILE_EXPIRY_HOURS)
        
        update_task_status(task_id, "completed", progress=100)
        publish_progress(task_id, 100, "completed")
        
        logger.info(f"Image background removal task {task_id} completed")
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"Image background removal task {task_id} timed out")
        update_task_status(task_id, "failed", "Task timed out")
        publish_progress(task_id, 0, "failed")
        raise
        
    except Exception as e:
        logger.error(f"Image background removal task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        publish_progress(task_id, 0, "failed")
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=120,
    time_limit=180,
)
def process_image_convert(
    self,
    task_id: str,
    file_path: str,
    output_format: str,
):
    """Background task for converting image formats."""
    logger.info(f"Starting image convert task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.image_service import ImageService
        import asyncio
        
        service = ImageService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.convert(Path(file_path), output_format)
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
        logger.error(f"Image convert task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise
