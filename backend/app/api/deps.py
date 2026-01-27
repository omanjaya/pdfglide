"""API dependencies."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import get_db
from app.services.pdf_service import PDFService
from app.services.image_service import ImageService
from app.services.document_service import DocumentService
from app.config import settings


# Database session dependency
DbSession = Annotated[AsyncSession, Depends(get_db)]


# Service dependencies
def get_pdf_service() -> PDFService:
    """Get PDF service instance."""
    return PDFService(settings.STORAGE_PATH)


def get_image_service() -> ImageService:
    """Get Image service instance."""
    return ImageService(settings.STORAGE_PATH)


def get_document_service() -> DocumentService:
    """Get Document service instance."""
    return DocumentService(settings.STORAGE_PATH)


PDFServiceDep = Annotated[PDFService, Depends(get_pdf_service)]
ImageServiceDep = Annotated[ImageService, Depends(get_image_service)]
DocumentServiceDep = Annotated[DocumentService, Depends(get_document_service)]
