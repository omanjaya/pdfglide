"""
Document processing background tasks.

This module contains Celery tasks for document conversion operations.
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
    retry_kwargs={"max_retries": 2},
    soft_time_limit=540,
    time_limit=600,
)
def process_pdf_to_word(self, task_id: str, file_path: str):
    """
    Background task for converting PDF to Word document.
    
    Uses pdf2docx for conversion which can be CPU-intensive.
    """
    logger.info(f"Starting PDF to Word conversion task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        publish_progress(task_id, 10)
        
        from app.services.document_service import DocumentService
        import asyncio
        
        service = DocumentService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.pdf_to_word(Path(file_path))
            )
        finally:
            loop.close()
        
        update_task_status(task_id, "processing", progress=80)
        publish_progress(task_id, 80)
        
        save_output_file(task_id, result, expires_minutes=settings.FILE_EXPIRY_MINUTES)
        
        update_task_status(task_id, "completed", progress=100)
        publish_progress(task_id, 100, "completed")
        
        logger.info(f"PDF to Word task {task_id} completed successfully")
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"PDF to Word task {task_id} timed out")
        update_task_status(task_id, "failed", "Task timed out after 9 minutes")
        publish_progress(task_id, 0, "failed")
        raise
        
    except Exception as e:
        logger.error(f"PDF to Word task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        publish_progress(task_id, 0, "failed")
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
    soft_time_limit=540,
    time_limit=600,
)
def process_word_to_pdf(self, task_id: str, file_path: str):
    """
    Background task for converting Word document to PDF.
    
    Uses LibreOffice headless for conversion.
    """
    logger.info(f"Starting Word to PDF conversion task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        publish_progress(task_id, 10)
        
        from app.services.document_service import DocumentService
        import asyncio
        
        service = DocumentService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.word_to_pdf(Path(file_path))
            )
        finally:
            loop.close()
        
        update_task_status(task_id, "processing", progress=80)
        publish_progress(task_id, 80)
        
        save_output_file(task_id, result, expires_minutes=settings.FILE_EXPIRY_MINUTES)
        
        update_task_status(task_id, "completed", progress=100)
        publish_progress(task_id, 100, "completed")
        
        logger.info(f"Word to PDF task {task_id} completed successfully")
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except SoftTimeLimitExceeded:
        logger.error(f"Word to PDF task {task_id} timed out")
        update_task_status(task_id, "failed", "Task timed out after 9 minutes")
        publish_progress(task_id, 0, "failed")
        raise
        
    except Exception as e:
        logger.error(f"Word to PDF task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        publish_progress(task_id, 0, "failed")
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
    soft_time_limit=540,
    time_limit=600,
)
def process_excel_to_pdf(self, task_id: str, file_path: str):
    """Background task for converting Excel to PDF."""
    logger.info(f"Starting Excel to PDF conversion task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.document_service import DocumentService
        import asyncio
        
        service = DocumentService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.excel_to_pdf(Path(file_path))
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_minutes=settings.FILE_EXPIRY_MINUTES)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"Excel to PDF task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise


@celery_app.task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 2},
    soft_time_limit=540,
    time_limit=600,
)
def process_powerpoint_to_pdf(self, task_id: str, file_path: str):
    """Background task for converting PowerPoint to PDF."""
    logger.info(f"Starting PowerPoint to PDF conversion task {task_id}")
    
    try:
        update_task_status(task_id, "processing", progress=10)
        
        from app.services.document_service import DocumentService
        import asyncio
        
        service = DocumentService(settings.STORAGE_PATH)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                service.powerpoint_to_pdf(Path(file_path))
            )
        finally:
            loop.close()
        
        save_output_file(task_id, result, expires_minutes=settings.FILE_EXPIRY_MINUTES)
        update_task_status(task_id, "completed", progress=100)
        
        return {
            "status": "success",
            "file_id": result.id,
            "file_name": result.file_name,
            "file_size": result.file_size,
        }
        
    except Exception as e:
        logger.error(f"PowerPoint to PDF task {task_id} failed: {e}", exc_info=True)
        update_task_status(task_id, "failed", str(e))
        raise
