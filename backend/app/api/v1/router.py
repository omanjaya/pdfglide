"""API v1 router."""

from fastapi import APIRouter, Depends

from app.api.v1.endpoints import pdf, document, image, other, download, admin, tasks, pdf_async, auth, stripe
from app.core.security import get_api_key

# Main API router with API key authentication dependency
api_router = APIRouter(dependencies=[Depends(get_api_key)])

# Auth endpoints (no API key required - handled separately)
auth_router = APIRouter()
auth_router.include_router(auth.router, tags=["Authentication"])

# Sync endpoints (for small files / backward compatibility)
api_router.include_router(pdf.router, prefix="/pdf", tags=["PDF"])
api_router.include_router(image.router, prefix="/image", tags=["Image"])
api_router.include_router(document.router, prefix="/document", tags=["Document"])
api_router.include_router(other.router, tags=["Other"])
api_router.include_router(download.router, tags=["Download"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])

# Task management endpoints
api_router.include_router(tasks.router, tags=["Tasks"])

# Async endpoints (for large files / heavy operations)
api_router.include_router(pdf_async.router, prefix="/pdf", tags=["PDF Async"])

