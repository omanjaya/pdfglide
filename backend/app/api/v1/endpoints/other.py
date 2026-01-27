"""
Other utility endpoints - Clean version.

OCR and QR Code generation.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.api.deps import DbSession
from app.schemas.response import APIResponse
from app.schemas.task import TaskResponse, TaskStatusEnum
from app.models.task import Task, InputFile, OutputFile
from app.core.file_handler import FileHandler
from app.core.exceptions import PDFGlideException
from app.services.ocr_service import OCRService
from app.services.qr_service import QRService
from app.config import settings

router = APIRouter()


@router.post("/ocr/extract")
async def extract_text(
    db: DbSession,
    file: UploadFile = File(..., description="Image or PDF file"),
    language: str = Form(default="eng", description="OCR language: eng, ind, etc."),
):
    """Extract text from image or PDF using OCR."""
    try:
        service = OCRService(settings.STORAGE_PATH)
        task_id = FileHandler.generate_file_id()

        # Create task
        task = Task(
            id=task_id,
            tool_type="ocr_extract",
            status="processing",
            metadata={"language": language},
        )
        db.add(task)

        # Save input
        file_info = await service.save_input_file(file, task_id)
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

        # Process - returns text, not file
        extracted_text = await service.extract_text(file_info.file_path, language)

        task.status = "completed"
        task.completed_at = datetime.utcnow()
        await db.commit()

        return APIResponse(
            success=True,
            data={"task_id": task_id, "text": extracted_text, "language": language},
        )

    except PDFGlideException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        import uuid
        error_id = str(uuid.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"Operation failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Operation failed. Please try again. (Error ID: {error_id})"
        )


@router.post("/qr/generate", response_model=APIResponse[TaskResponse])
async def generate_qr_code(
    db: DbSession,
    content: str = Form(..., description="Content to encode"),
    size: int = Form(default=400, ge=100, le=2000, description="Size in pixels"),
):
    """Generate QR code from content."""
    try:
        service = QRService(settings.STORAGE_PATH)
        task_id = FileHandler.generate_file_id()

        # Create task
        task = Task(
            id=task_id,
            tool_type="qr_generate",
            status="processing",
            metadata={"content": content[:100], "size": size},
        )
        db.add(task)

        # Process - no input file, just generate
        result = await service.generate(content, size)

        # Save output
        expires_at = datetime.utcnow() + timedelta(hours=settings.FILE_EXPIRY_HOURS)
        db.add(OutputFile(
            id=result.id,
            task_id=task_id,
            file_name=result.file_name,
            file_path=str(result.file_path),
            file_size=result.file_size,
            mime_type=result.mime_type,
            expires_at=expires_at,
        ))

        task.status = "completed"
        task.completed_at = datetime.utcnow()
        await db.commit()

        return APIResponse(
            success=True,
            data=TaskResponse(
                task_id=task_id,
                status=TaskStatusEnum.COMPLETED,
                tool_type="qr_generate",
                created_at=task.created_at,
                completed_at=task.completed_at,
                file_name=result.file_name,
                file_size=result.file_size,
                download_url=f"/api/v1/download/{result.id}",
                expires_at=expires_at,
            ),
        )

    except PDFGlideException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        import uuid
        error_id = str(uuid.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"Operation failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Operation failed. Please try again. (Error ID: {error_id})"
        )
