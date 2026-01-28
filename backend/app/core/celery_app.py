"""
Celery application configuration for background task processing.

This module configures Celery with Redis as the broker and result backend.
Workers are separated by queue for different types of operations.
"""

import logging
from celery import Celery
from celery.signals import worker_ready
from kombu import Queue

from app.config import settings

logger = logging.getLogger(__name__)


def create_celery_app() -> Celery:
    """Create and configure Celery application."""
    
    celery_app = Celery(
        "pdfglide",
        broker=settings.CELERY_BROKER_URL,
        backend=settings.CELERY_RESULT_BACKEND,
        include=[
            "app.workers.pdf_tasks",
            "app.workers.image_tasks",
            "app.workers.document_tasks",
        ]
    )

    celery_app.conf.update(
        # Serialization
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        
        # Timezone
        timezone="UTC",
        enable_utc=True,
        
        # Task tracking
        task_track_started=True,
        result_extended=True,
        
        # Time limits (in seconds)
        task_time_limit=600,  # 10 minutes max
        task_soft_time_limit=540,  # 9 minutes soft limit
        
        # Worker settings
        worker_prefetch_multiplier=1,  # 1 task at a time per worker for CPU-intensive tasks
        worker_concurrency=2,  # Default concurrency per worker
        
        # Result expiration
        result_expires=3600,  # Results expire after 1 hour
        
        # Queue definitions
        task_queues=(
            Queue("default", routing_key="default"),
            Queue("pdf-heavy", routing_key="pdf.heavy"),
            Queue("pdf-light", routing_key="pdf.light"),
            Queue("image", routing_key="image"),
            Queue("document", routing_key="document"),
        ),
        
        # Default queue
        task_default_queue="default",
        
        # Task routing
        task_routes={
            # PDF Heavy operations (merge, compress, OCR)
            "app.workers.pdf_tasks.process_pdf_merge": {"queue": "pdf-heavy"},
            "app.workers.pdf_tasks.process_pdf_compress": {"queue": "pdf-heavy"},
            "app.workers.pdf_tasks.process_pdf_ocr": {"queue": "pdf-heavy"},
            "app.workers.pdf_tasks.process_pdf_to_word": {"queue": "pdf-heavy"},
            "app.workers.pdf_tasks.process_pdf_compare": {"queue": "pdf-heavy"},
            
            # PDF Light operations (split, rotate, etc.)
            "app.workers.pdf_tasks.process_pdf_split": {"queue": "pdf-light"},
            "app.workers.pdf_tasks.process_pdf_rotate": {"queue": "pdf-light"},
            "app.workers.pdf_tasks.process_pdf_watermark": {"queue": "pdf-light"},
            "app.workers.pdf_tasks.process_pdf_page_numbers": {"queue": "pdf-light"},
            "app.workers.pdf_tasks.process_pdf_protect": {"queue": "pdf-light"},
            "app.workers.pdf_tasks.process_pdf_unlock": {"queue": "pdf-light"},
            
            # Image operations
            "app.workers.image_tasks.*": {"queue": "image"},
            
            # Document operations
            "app.workers.document_tasks.*": {"queue": "document"},
        },
        
        # Retry policy
        task_acks_late=True,  # Acknowledge after task completes
        task_reject_on_worker_lost=True,  # Requeue if worker dies
    )

    return celery_app


# Create the Celery app instance
celery_app = create_celery_app()


@worker_ready.connect
def preload_models(sender, **kwargs):
    """Preload AI models when worker starts to avoid cold start delays."""
    import os

    # Check if PRELOAD_REMBG env var is set (set in docker-compose for image worker)
    should_preload = os.environ.get("PRELOAD_REMBG", "false").lower() == "true"

    if should_preload:
        try:
            logger.info("Preloading rembg model for image worker...")
            from app.processors.image.background_remover import get_rembg_session
            get_rembg_session()
            logger.info("rembg model preloaded successfully")
        except Exception as e:
            logger.warning(f"Failed to preload rembg model: {e}")


# Task priorities (higher = more important)
TASK_PRIORITIES = {
    # Light operations - fast
    "pdf_split": 8,
    "pdf_rotate": 8,
    "pdf_unlock": 8,
    "pdf_page_numbers": 7,
    "pdf_watermark": 7,
    "pdf_protect": 7,
    
    # Medium operations
    "pdf_merge": 5,
    "image_compress": 5,
    "image_resize": 5,
    
    # Heavy operations - slow
    "pdf_compress": 3,
    "pdf_to_word": 3,
    "pdf_to_excel": 3,
    
    # Very heavy operations
    "pdf_ocr": 1,
    "pdf_compare": 2,
    "document_convert": 2,
}


def get_task_priority(tool_type: str) -> int:
    """Get priority for a task type."""
    return TASK_PRIORITIES.get(tool_type, 5)
