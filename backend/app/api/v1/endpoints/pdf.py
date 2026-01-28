"""
PDF processing endpoints - Clean version.

This module uses TaskHandler to eliminate boilerplate code.
Each endpoint is now ~15-20 lines instead of ~100 lines.
"""

from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.api.deps import DbSession, PDFServiceDep
from app.schemas.response import APIResponse
from app.schemas.task import TaskResponse
from app.schemas.file import PDFCompressOptions
from app.core.task_handler import handle_task
from app.config import settings

router = APIRouter()


# ============== MERGE & SPLIT ==============


@router.post("/merge", response_model=APIResponse[TaskResponse])
async def merge_pdfs(
    db: DbSession,
    service: PDFServiceDep,
    files: list[UploadFile] = File(..., description="PDF files to merge (2-20)"),
):
    """Merge multiple PDF files into one."""
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 files required")
    if len(files) > settings.MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_FILES_PER_REQUEST} files allowed")

    return await handle_task(
        db, service, "pdf_merge",
        process_func=lambda paths: service.merge(paths),
        files=files,
        metadata={"file_count": len(files)},
    )


@router.post("/split", response_model=APIResponse[TaskResponse])
async def split_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    pages: str = Form(..., description="Page ranges: '1-3,5,7-10'"),
):
    """Split PDF into multiple files."""
    return await handle_task(
        db, service, "pdf_split",
        process_func=lambda paths: service.split(paths[0], pages),
        file=file,
        metadata={"pages": pages},
    )


# ============== COMPRESS & ROTATE ==============


@router.post("/compress", response_model=APIResponse[TaskResponse])
async def compress_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    quality: str = Form(default="medium", description="Quality: extreme, low, medium, high"),
    compress_images: bool = Form(default=True, description="Compress embedded images"),
    image_dpi: Optional[int] = Form(default=None, ge=72, le=600, description="Target DPI"),
    remove_metadata: bool = Form(default=False, description="Remove document metadata"),
    grayscale: bool = Form(default=False, description="Convert to grayscale"),
    target_size_kb: Optional[int] = Form(default=None, ge=10, le=102400, description="Target size in KB"),
    preserve_quality: bool = Form(default=True, description="Prioritize image quality"),
):
    """Compress PDF to reduce file size with advanced optimization."""
    from app.core.file_handler import FileHandler
    from app.models.task import Task, InputFile, OutputFile
    from app.schemas.task import TaskStatusEnum
    from datetime import datetime, timedelta

    try:
        # Create task
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_compress",
            status="processing",
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

        # Save file (validation happens automatically in save_input_file)
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

        # Compress with advanced options
        options = PDFCompressOptions(
            quality=quality,
            compress_images=compress_images,
            image_dpi=image_dpi,
            remove_metadata=remove_metadata,
            grayscale=grayscale,
            target_size_kb=target_size_kb,
            preserve_quality=preserve_quality,
        )
        result, stats = await service.compress(file_info.file_path, options)

        # Save output
        expires_at = datetime.utcnow() + timedelta(minutes=settings.FILE_EXPIRY_MINUTES)
        db.add(OutputFile(
            id=result.id,
            task_id=task_id,
            file_name=result.file_name,
            file_path=str(result.file_path),
            file_size=result.file_size,
            mime_type=result.mime_type,
            expires_at=expires_at,
        ))

        # Update task with stats
        task.status = "completed"
        task.completed_at = datetime.utcnow()
        task.task_metadata = {
            **task.task_metadata,
            "compression_stats": stats,
        }
        await db.commit()

        return APIResponse(
            success=True,
            data=TaskResponse(
                task_id=task_id,
                status=TaskStatusEnum.COMPLETED,
                tool_type="pdf_compress",
                created_at=task.created_at,
                completed_at=task.completed_at,
                file_name=result.file_name,
                file_size=result.file_size,
                download_url=f"/api/v1/download/{result.id}",
                expires_at=expires_at,
                metadata=stats,
            ),
        )

    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"PDF operation failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed. Please try again. (Error ID: {error_id})"
        )


@router.post("/rotate", response_model=APIResponse[TaskResponse])
async def rotate_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    rotation: int = Form(default=90, description="Angle: 90, 180, 270"),
    pages: str = Form(default="all"),
):
    """Rotate PDF pages."""
    if rotation not in [90, 180, 270]:
        raise HTTPException(status_code=400, detail="Rotation must be 90, 180, or 270")

    return await handle_task(
        db, service, "pdf_rotate",
        process_func=lambda paths: service.rotate(paths[0], rotation, pages),
        file=file,
        metadata={"rotation": rotation, "pages": pages},
    )


# ============== WATERMARK & PAGE NUMBERS ==============


@router.post("/watermark", response_model=APIResponse[TaskResponse])
async def add_watermark(
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
    """Add text watermark to PDF."""
    return await handle_task(
        db, service, "pdf_watermark",
        process_func=lambda paths: service.add_watermark(
            paths[0], text, position, opacity, rotation, font_size, color, pages
        ),
        file=file,
        metadata={"text": text, "position": position},
    )


@router.post("/page-numbers", response_model=APIResponse[TaskResponse])
async def add_page_numbers(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    position: str = Form(default="bottom-center"),
    start_number: int = Form(default=1),
    format_template: str = Form(default="{n}"),
    font_size: int = Form(default=12),
    margin: int = Form(default=30),
):
    """Add page numbers to PDF."""
    return await handle_task(
        db, service, "pdf_page_numbers",
        process_func=lambda paths: service.add_page_numbers(
            paths[0], position, start_number, format_template, font_size, margin
        ),
        file=file,
        metadata={"position": position, "start_number": start_number},
    )


# ============== PROTECT & UNLOCK ==============


@router.post("/protect", response_model=APIResponse[TaskResponse])
async def protect_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    user_password: Optional[str] = Form(default=None),
    owner_password: Optional[str] = Form(default=None),
    allow_printing: bool = Form(default=True),
    allow_copying: bool = Form(default=False),
    allow_modifying: bool = Form(default=False),
):
    """Protect PDF with password."""
    if not user_password and not owner_password:
        raise HTTPException(status_code=400, detail="At least one password required")

    return await handle_task(
        db, service, "pdf_protect",
        process_func=lambda paths: service.protect(
            paths[0], user_password, owner_password,
            allow_printing, allow_copying, allow_modifying
        ),
        file=file,
        metadata={"allow_printing": allow_printing},
    )


@router.post("/unlock", response_model=APIResponse[TaskResponse])
async def unlock_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    password: str = Form(default=""),
):
    """Remove password from PDF."""
    return await handle_task(
        db, service, "pdf_unlock",
        process_func=lambda paths: service.unlock(paths[0], password),
        file=file,
    )


# ============== ORGANIZE ==============


@router.post("/organize", response_model=APIResponse[TaskResponse])
async def organize_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    page_order: str = Form(..., description="New order: '3,1,2,4'"),
):
    """Reorganize PDF pages."""
    try:
        order_list = [int(p.strip()) for p in page_order.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page order format")

    return await handle_task(
        db, service, "pdf_organize",
        process_func=lambda paths: service.organize(paths[0], order_list),
        file=file,
        metadata={"page_order": order_list},
    )


@router.post("/delete-pages", response_model=APIResponse[TaskResponse])
async def delete_pages(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    pages: str = Form(..., description="Pages to delete: '2,4,6'"),
):
    """Delete specific pages from PDF."""
    try:
        pages_list = [int(p.strip()) for p in pages.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page numbers")

    return await handle_task(
        db, service, "pdf_delete_pages",
        process_func=lambda paths: service.delete_pages(paths[0], pages_list),
        file=file,
        metadata={"pages_to_delete": pages_list},
    )


@router.post("/extract-pages", response_model=APIResponse[TaskResponse])
async def extract_pages(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    pages: str = Form(..., description="Pages to extract: '1,3,5'"),
):
    """Extract specific pages from PDF."""
    try:
        pages_list = [int(p.strip()) for p in pages.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid page numbers")

    return await handle_task(
        db, service, "pdf_extract_pages",
        process_func=lambda paths: service.extract_pages(paths[0], pages_list),
        file=file,
        metadata={"pages_to_extract": pages_list},
    )


# ============== CONVERT ==============


@router.post("/to-image", response_model=APIResponse[TaskResponse])
async def pdf_to_image(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    format: str = Form(default="jpg", description="Output: jpg, png"),
):
    """Convert PDF to images."""
    return await handle_task(
        db, service, "pdf_to_image",
        process_func=lambda paths: service.to_images(paths[0], format),
        file=file,
        metadata={"format": format},
    )


@router.post("/from-image", response_model=APIResponse[TaskResponse])
async def image_to_pdf(
    db: DbSession,
    service: PDFServiceDep,
    files: list[UploadFile] = File(..., description="Image files"),
):
    """Convert images to PDF."""
    if len(files) > settings.MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.MAX_FILES_PER_REQUEST} files")

    from app.services.image_service import ImageService
    img_service = ImageService(settings.STORAGE_PATH)

    return await handle_task(
        db, service, "image_to_pdf",
        process_func=lambda paths: service.from_images(paths),
        files=files,
        metadata={"file_count": len(files)},
        alt_service=img_service,
    )


# ============== NEW FEATURES ==============


@router.post("/repair", response_model=APIResponse[TaskResponse])
async def repair_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="Corrupted PDF"),
):
    """Repair corrupted PDF file."""
    return await handle_task(
        db, service, "pdf_repair",
        process_func=lambda paths: service.repair(paths[0]),
        file=file,
    )


@router.post("/crop", response_model=APIResponse[TaskResponse])
async def crop_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    left: float = Form(default=0),
    top: float = Form(default=0),
    right: float = Form(default=0),
    bottom: float = Form(default=0),
    pages: str = Form(default="all"),
):
    """Crop PDF margins."""
    return await handle_task(
        db, service, "pdf_crop",
        process_func=lambda paths: service.crop(paths[0], left, top, right, bottom, pages),
        file=file,
        metadata={"left": left, "top": top, "right": right, "bottom": bottom},
    )


@router.post("/sign", response_model=APIResponse[TaskResponse])
async def sign_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    signature_image: Optional[UploadFile] = File(default=None),
    signature_text: Optional[str] = Form(default=None),
    position: str = Form(default="bottom-right"),
    page: int = Form(default=-1),
    width: int = Form(default=150),
    height: int = Form(default=50),
):
    """Add signature to PDF."""
    if not signature_image and not signature_text:
        raise HTTPException(status_code=400, detail="Provide signature_image or signature_text")

    # Handle signature image
    sig_path = None
    if signature_image:
        from app.services.image_service import ImageService
        img_service = ImageService(settings.STORAGE_PATH)
        sig_info = await img_service.save_input_file(signature_image, "sig", 0)
        sig_path = sig_info.file_path

    return await handle_task(
        db, service, "pdf_sign",
        process_func=lambda paths: service.sign(
            paths[0], sig_path, signature_text, position, page, width, height
        ),
        file=file,
        metadata={"position": position, "page": page},
    )


@router.post("/metadata", response_model=APIResponse[TaskResponse])
async def edit_metadata(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(...),
    title: Optional[str] = Form(default=None),
    author: Optional[str] = Form(default=None),
    subject: Optional[str] = Form(default=None),
    keywords: Optional[str] = Form(default=None),
    creator: Optional[str] = Form(default=None),
):
    """Edit PDF metadata."""
    return await handle_task(
        db, service, "pdf_metadata",
        process_func=lambda paths: service.edit_metadata(
            paths[0], title, author, subject, keywords, creator
        ),
        file=file,
        metadata={"title": title, "author": author},
    )


@router.post("/to-excel", response_model=APIResponse[TaskResponse])
async def pdf_to_excel(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF with tables"),
    pages: str = Form(default="all"),
):
    """Extract tables from PDF to Excel."""
    return await handle_task(
        db, service, "pdf_to_excel",
        process_func=lambda paths: service.to_excel(paths[0], pages),
        file=file,
        metadata={"pages": pages},
    )


# ============== NEW FEATURES - PHASE 2 ==============


@router.post("/to-powerpoint", response_model=APIResponse[TaskResponse])
async def pdf_to_powerpoint(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to convert"),
    dpi: int = Form(default=150, ge=72, le=300, description="Resolution (72-300)"),
):
    """Convert PDF to PowerPoint presentation."""
    return await handle_task(
        db, service, "pdf_to_powerpoint",
        process_func=lambda paths: service.to_powerpoint(paths[0], dpi),
        file=file,
        metadata={"dpi": dpi},
    )


@router.post("/redact", response_model=APIResponse[TaskResponse])
async def redact_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to redact"),
    search_terms: Optional[str] = Form(default=None, description="Comma-separated terms to redact"),
):
    """Redact sensitive content from PDF by searching text."""
    terms_list = None
    if search_terms:
        terms_list = [t.strip() for t in search_terms.split(",") if t.strip()]

    if not terms_list:
        raise HTTPException(status_code=400, detail="Provide search_terms to redact")

    return await handle_task(
        db, service, "pdf_redact",
        process_func=lambda paths: service.redact(paths[0], search_terms=terms_list),
        file=file,
        metadata={"terms_count": len(terms_list)},
    )


@router.post("/redact-patterns", response_model=APIResponse[TaskResponse])
async def redact_pdf_patterns(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to redact"),
    pattern_type: str = Form(
        ...,
        description="Pattern type: email, phone, ssn, credit_card, or custom regex"
    ),
    custom_pattern: Optional[str] = Form(default=None, description="Custom regex if pattern_type=custom"),
):
    """Redact sensitive content from PDF using predefined patterns."""
    # Predefined patterns
    pattern_map = {
        "email": r"[\w.-]+@[\w.-]+\.\w+",
        "phone": r"\d{3}[-.\s]?\d{3}[-.\s]?\d{4}",
        "ssn": r"\d{3}-\d{2}-\d{4}",
        "credit_card": r"\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}",
    }

    if pattern_type == "custom":
        if not custom_pattern:
            raise HTTPException(status_code=400, detail="Provide custom_pattern for custom type")
        patterns = [custom_pattern]
    elif pattern_type in pattern_map:
        patterns = [pattern_map[pattern_type]]
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid pattern_type. Use: {', '.join(pattern_map.keys())}, or custom"
        )

    return await handle_task(
        db, service, "pdf_redact_patterns",
        process_func=lambda paths: service.redact_patterns(paths[0], patterns),
        file=file,
        metadata={"pattern_type": pattern_type},
    )


@router.post("/compare")
async def compare_pdfs(
    db: DbSession,
    service: PDFServiceDep,
    file1: UploadFile = File(..., description="Original PDF"),
    file2: UploadFile = File(..., description="Modified PDF"),
    output_mode: str = Form(default="visual", description="Output: visual or text"),
):
    """Compare two PDFs and highlight differences."""
    if output_mode not in ["visual", "text"]:
        raise HTTPException(status_code=400, detail="output_mode must be 'visual' or 'text'")

    from app.core.file_handler import FileHandler
    from app.models.task import Task, InputFile, OutputFile
    from app.schemas.task import TaskStatusEnum
    from datetime import datetime, timedelta

    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_compare",
            status="processing",
            metadata={"output_mode": output_mode},
        )
        db.add(task)

        # Save both files
        file1_info = await service.save_input_file(file1, task_id, 0)
        file2_info = await service.save_input_file(file2, task_id, 1)

        db.add(InputFile(
            id=FileHandler.generate_file_id(),
            task_id=task_id,
            original_name=file1_info.original_name,
            stored_name=file1_info.stored_name,
            file_path=str(file1_info.file_path),
            file_size=file1_info.file_size,
            mime_type=file1_info.mime_type,
            upload_order=0,
        ))
        db.add(InputFile(
            id=FileHandler.generate_file_id(),
            task_id=task_id,
            original_name=file2_info.original_name,
            stored_name=file2_info.stored_name,
            file_path=str(file2_info.file_path),
            file_size=file2_info.file_size,
            mime_type=file2_info.mime_type,
            upload_order=1,
        ))

        # Compare
        result = await service.compare(file1_info.file_path, file2_info.file_path, output_mode)

        # Save output
        expires_at = datetime.utcnow() + timedelta(minutes=settings.FILE_EXPIRY_MINUTES)
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
                tool_type="pdf_compare",
                created_at=task.created_at,
                completed_at=task.completed_at,
                file_name=result.file_name,
                file_size=result.file_size,
                download_url=f"/api/v1/download/{result.id}",
                expires_at=expires_at,
            ),
        )

    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"PDF operation failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed. Please try again. (Error ID: {error_id})"
        )


@router.post("/to-pdfa", response_model=APIResponse[TaskResponse])
async def pdf_to_pdfa(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to convert"),
    level: str = Form(default="2b", description="PDF/A level: 1b, 2b, or 3b"),
):
    """Convert PDF to PDF/A archival format."""
    if level not in ["1b", "2b", "3b"]:
        raise HTTPException(status_code=400, detail="level must be 1b, 2b, or 3b")

    return await handle_task(
        db, service, "pdf_to_pdfa",
        process_func=lambda paths: service.to_pdfa(paths[0], level),
        file=file,
        metadata={"pdfa_level": level},
    )


@router.post("/add-text", response_model=APIResponse[TaskResponse])
async def add_text_to_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to edit"),
    text: str = Form(..., description="Text to add"),
    page: int = Form(..., ge=1, description="Page number (1-based)"),
    x: float = Form(..., description="X position in points"),
    y: float = Form(..., description="Y position in points"),
    font_size: int = Form(default=12, ge=6, le=72, description="Font size"),
):
    """Add text to PDF at specified position."""
    return await handle_task(
        db, service, "pdf_add_text",
        process_func=lambda paths: service.add_text_to_pdf(
            paths[0], text, page, x, y, font_size
        ),
        file=file,
        metadata={"text": text[:50], "page": page},
    )


@router.post("/add-image-overlay", response_model=APIResponse[TaskResponse])
async def add_image_to_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to edit"),
    image: UploadFile = File(..., description="Image to add"),
    page: int = Form(..., ge=1, description="Page number (1-based)"),
    x: float = Form(..., description="X position in points"),
    y: float = Form(..., description="Y position in points"),
    width: Optional[float] = Form(default=None, description="Image width in points"),
    height: Optional[float] = Form(default=None, description="Image height in points"),
):
    """Add image overlay to PDF at specified position."""
    from app.services.image_service import ImageService

    img_service = ImageService(settings.STORAGE_PATH)

    # Save image first
    img_info = await img_service.save_input_file(image, "img_overlay", 0)

    return await handle_task(
        db, service, "pdf_add_image",
        process_func=lambda paths: service.add_image_to_pdf(
            paths[0], img_info.file_path, page, x, y, width, height
        ),
        file=file,
        metadata={"page": page, "x": x, "y": y},
    )


@router.post("/add-comment", response_model=APIResponse[TaskResponse])
async def add_comment_to_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to comment"),
    page: int = Form(..., ge=1, description="Page number (1-based)"),
    x: float = Form(..., description="X position"),
    y: float = Form(..., description="Y position"),
    comment: str = Form(..., description="Comment text"),
    author: str = Form(default="User", description="Comment author"),
):
    """Add sticky note comment to PDF."""
    return await handle_task(
        db, service, "pdf_add_comment",
        process_func=lambda paths: service.add_comment_to_pdf(
            paths[0], page, x, y, comment, author
        ),
        file=file,
        metadata={"page": page, "author": author},
    )


# ============== ADVANCED EDIT FEATURES ==============


@router.post("/find-text")
async def find_text_in_pdf(
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to search"),
    search_text: str = Form(..., min_length=1, description="Text to search for"),
    match_case: bool = Form(default=False, description="Case-sensitive search"),
    page: Optional[int] = Form(default=None, ge=1, description="Specific page (1-based)"),
):
    """Find text occurrences in PDF."""
    from app.core.file_handler import FileHandler
    import tempfile
    from pathlib import Path

    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        # Find text
        results = service.find_text(tmp_path, search_text, match_case, page)

        # Cleanup
        tmp_path.unlink(missing_ok=True)

        return APIResponse(
            success=True,
            data={
                "search_text": search_text,
                "match_case": match_case,
                "total_matches": len(results),
                "matches": [r.model_dump() for r in results],
            }
        )

    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"Find text failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Search failed. Please try again. (Error ID: {error_id})"
        )


@router.post("/replace-text", response_model=APIResponse[TaskResponse])
async def replace_text_in_pdf(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to edit"),
    replacements: str = Form(..., description="JSON array of replacements: [{search_text, replace_text, match_case?, page?}]"),
):
    """Find and replace text in PDF."""
    import json
    from app.schemas.pdf_edit import TextReplacement

    try:
        replacement_list = json.loads(replacements)
        parsed_replacements = [TextReplacement(**r) for r in replacement_list]
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid replacements format: {str(e)}")

    if not parsed_replacements:
        raise HTTPException(status_code=400, detail="At least one replacement required")

    from app.core.file_handler import FileHandler
    from app.models.task import Task, InputFile, OutputFile
    from app.schemas.task import TaskStatusEnum
    from datetime import datetime, timedelta

    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_replace_text",
            status="processing",
            task_metadata={"replacement_count": len(parsed_replacements)},
        )
        db.add(task)

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

        result, replaced_count = await service.replace_text(file_info.file_path, parsed_replacements)

        expires_at = datetime.utcnow() + timedelta(minutes=settings.FILE_EXPIRY_MINUTES)
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
        task.task_metadata["replaced_count"] = replaced_count
        await db.commit()

        return APIResponse(
            success=True,
            data=TaskResponse(
                task_id=task_id,
                status=TaskStatusEnum.COMPLETED,
                tool_type="pdf_replace_text",
                created_at=task.created_at,
                completed_at=task.completed_at,
                file_name=result.file_name,
                file_size=result.file_size,
                download_url=f"/api/v1/download/{result.id}",
                expires_at=expires_at,
                metadata={"replaced_count": replaced_count},
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"Replace text failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Replace failed. Please try again. (Error ID: {error_id})"
        )


@router.post("/form-fields")
async def get_form_fields(
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF with form fields"),
):
    """Get all form fields from PDF."""
    import tempfile
    from pathlib import Path

    try:
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)

        # Get form fields
        result = service.get_form_fields(tmp_path)

        # Cleanup
        tmp_path.unlink(missing_ok=True)

        return APIResponse(
            success=True,
            data=result.model_dump(),
        )

    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"Get form fields failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to read form fields. (Error ID: {error_id})"
        )


@router.post("/fill-form", response_model=APIResponse[TaskResponse])
async def fill_form(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF form to fill"),
    field_values: str = Form(..., description="JSON object of field name to value"),
    flatten: bool = Form(default=False, description="Flatten form after filling"),
):
    """Fill form fields in PDF."""
    import json

    try:
        values = json.loads(field_values)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid field_values JSON: {str(e)}")

    if not values:
        raise HTTPException(status_code=400, detail="At least one field value required")

    from app.core.file_handler import FileHandler
    from app.models.task import Task, InputFile, OutputFile
    from app.schemas.task import TaskStatusEnum
    from datetime import datetime, timedelta

    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_fill_form",
            status="processing",
            task_metadata={"field_count": len(values), "flatten": flatten},
        )
        db.add(task)

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

        result, filled_count = await service.fill_form(file_info.file_path, values, flatten)

        expires_at = datetime.utcnow() + timedelta(minutes=settings.FILE_EXPIRY_MINUTES)
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
        task.task_metadata["filled_count"] = filled_count
        await db.commit()

        return APIResponse(
            success=True,
            data=TaskResponse(
                task_id=task_id,
                status=TaskStatusEnum.COMPLETED,
                tool_type="pdf_fill_form",
                created_at=task.created_at,
                completed_at=task.completed_at,
                file_name=result.file_name,
                file_size=result.file_size,
                download_url=f"/api/v1/download/{result.id}",
                expires_at=expires_at,
                metadata={"filled_count": filled_count},
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"Fill form failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fill form. (Error ID: {error_id})"
        )


@router.post("/edit", response_model=APIResponse[TaskResponse])
async def edit_pdf_combined(
    db: DbSession,
    service: PDFServiceDep,
    file: UploadFile = File(..., description="PDF to edit"),
    operations: str = Form(..., description="JSON array of edit operations"),
    images: list[UploadFile] = File(default=[], description="Images for image operations"),
):
    """Apply multiple edit operations to PDF in a single pass."""
    import json
    from app.schemas.pdf_edit import (
        TextOperation, ImageOperation, RectangleOperation,
        LineOperation, HighlightOperation, CommentOperation, RedactOperation
    )

    try:
        ops_data = json.loads(operations)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid operations JSON: {str(e)}")

    if not ops_data:
        raise HTTPException(status_code=400, detail="At least one operation required")

    # Parse operations
    parsed_ops = []
    type_map = {
        "text": TextOperation,
        "image": ImageOperation,
        "rectangle": RectangleOperation,
        "line": LineOperation,
        "highlight": HighlightOperation,
        "comment": CommentOperation,
        "redact": RedactOperation,
    }

    for op in ops_data:
        op_type = op.get("type")
        if op_type not in type_map:
            raise HTTPException(status_code=400, detail=f"Unknown operation type: {op_type}")
        try:
            parsed_ops.append(type_map[op_type](**op))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid operation: {str(e)}")

    from app.core.file_handler import FileHandler
    from app.models.task import Task, InputFile, OutputFile
    from app.schemas.task import TaskStatusEnum
    from datetime import datetime, timedelta
    from app.services.image_service import ImageService

    try:
        task_id = FileHandler.generate_file_id()
        task = Task(
            id=task_id,
            tool_type="pdf_edit",
            status="processing",
            task_metadata={"operation_count": len(parsed_ops)},
        )
        db.add(task)

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

        # Save images if provided
        image_paths = []
        if images:
            img_service = ImageService(settings.STORAGE_PATH)
            for i, img in enumerate(images):
                img_info = await img_service.save_input_file(img, task_id, i + 1)
                image_paths.append(img_info.file_path)

        result = await service.edit_combined(file_info.file_path, parsed_ops, image_paths or None)

        expires_at = datetime.utcnow() + timedelta(minutes=settings.FILE_EXPIRY_MINUTES)
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
                tool_type="pdf_edit",
                created_at=task.created_at,
                completed_at=task.completed_at,
                file_name=result.file_name,
                file_size=result.file_size,
                download_url=f"/api/v1/download/{result.id}",
                expires_at=expires_at,
                metadata={"operation_count": len(parsed_ops)},
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        import uuid as uuid_mod
        error_id = str(uuid_mod.uuid4())[:8]
        import logging
        logging.getLogger(__name__).error(
            f"PDF edit failed [error_id={error_id}]: {type(e).__name__}: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Edit failed. Please try again. (Error ID: {error_id})"
        )
