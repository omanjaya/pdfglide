"""
Document processing endpoints - Clean version.

Uses TaskHandler to eliminate boilerplate.
"""

from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.api.deps import DbSession, DocumentServiceDep
from app.schemas.response import APIResponse
from app.schemas.task import TaskResponse
from app.core.task_handler import TaskHandler
from app.core.file_handler import FileHandler
from app.models.task import Task, OutputFile
from app.core.exceptions import PDFGlideException
from app.config import settings
from datetime import datetime, timedelta

router = APIRouter()


@router.post("/word-to-pdf", response_model=APIResponse[TaskResponse])
async def word_to_pdf(
    db: DbSession,
    service: DocumentServiceDep,
    file: UploadFile = File(..., description="Word document (.docx)"),
):
    """Convert Word document to PDF."""
    handler = TaskHandler(db, service, "word_to_pdf")
    return await handler.execute(
        process_func=lambda paths: service.word_to_pdf(paths[0]),
        file=file,
    )


@router.post("/excel-to-pdf", response_model=APIResponse[TaskResponse])
async def excel_to_pdf(
    db: DbSession,
    service: DocumentServiceDep,
    file: UploadFile = File(..., description="Excel document (.xlsx)"),
):
    """Convert Excel document to PDF."""
    handler = TaskHandler(db, service, "excel_to_pdf")
    return await handler.execute(
        process_func=lambda paths: service.excel_to_pdf(paths[0]),
        file=file,
    )


@router.post("/pdf-to-word", response_model=APIResponse[TaskResponse])
async def pdf_to_word(
    db: DbSession,
    service: DocumentServiceDep,
    file: UploadFile = File(..., description="PDF document"),
    use_ai: bool = Form(default=True, description="Use AI-powered conversion (recommended)"),
    quality: str = Form(default="standard", description="Conversion quality: draft, standard, high"),
):
    """
    Convert PDF to Word document.

    - **use_ai**: Enable AI-powered conversion for much better results (default: true)
    - **quality**: Conversion quality level
      - draft: Faster, lower accuracy
      - standard: Balanced (recommended)
      - high: Best accuracy, slower
    """
    handler = TaskHandler(db, service, "pdf_to_word")
    return await handler.execute(
        process_func=lambda paths: service.pdf_to_word(
            paths[0], use_ai=use_ai, quality=quality
        ),
        file=file,
    )


@router.post("/pptx-to-pdf", response_model=APIResponse[TaskResponse])
async def powerpoint_to_pdf(
    db: DbSession,
    service: DocumentServiceDep,
    file: UploadFile = File(..., description="PowerPoint (.pptx)"),
):
    """Convert PowerPoint to PDF."""
    handler = TaskHandler(db, service, "pptx_to_pdf")
    return await handler.execute(
        process_func=lambda paths: service.powerpoint_to_pdf(paths[0]),
        file=file,
    )


@router.post("/html-to-pdf", response_model=APIResponse[TaskResponse])
async def html_to_pdf(
    db: DbSession,
    service: DocumentServiceDep,
    url: Optional[str] = Form(default=None, description="URL to convert"),
    html_content: Optional[str] = Form(default=None, description="HTML content"),
    page_size: str = Form(default="A4"),
    margin: int = Form(default=20),
):
    """Convert HTML or URL to PDF.

    Provide either `url` or `html_content`.
    """
    if not url and not html_content:
        raise HTTPException(status_code=400, detail="Provide url or html_content")

    try:
        # Create task manually since no file upload
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="html_to_pdf",
            status="processing",
            metadata={"url": url, "page_size": page_size},
        )
        db.add(task)

        # Process
        result = await service.html_to_pdf(
            url=url,
            html_content=html_content,
            page_size=page_size,
            margin=margin,
        )

        # Save output
        from app.schemas.task import TaskStatusEnum
        expires_at = datetime.utcnow() + timedelta(hours=settings.FILE_EXPIRY_HOURS)
        output_file = OutputFile(
            id=result.id,
            task_id=task_id,
            file_name=result.file_name,
            file_path=str(result.file_path),
            file_size=result.file_size,
            mime_type="application/pdf",
            expires_at=expires_at,
        )
        db.add(output_file)

        task.status = "completed"
        task.completed_at = datetime.utcnow()
        await db.commit()

        return APIResponse(
            success=True,
            data=TaskResponse(
                task_id=task_id,
                status=TaskStatusEnum.COMPLETED,
                tool_type="html_to_pdf",
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
            f"Document conversion failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Document conversion failed. Please try again. (Error ID: {error_id})"
        )
