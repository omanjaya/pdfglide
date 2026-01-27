"""FastAPI application entry point."""

import asyncio
import traceback
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.api.v1.router import api_router
from app.models.database import init_db
from app.core.logging import setup_logging, get_logger
from app.core.rate_limiter import RateLimitMiddleware, RateLimitConfig
from app.core.exceptions import ProcessingError

# Configure structured logging
setup_logging()
logger = get_logger(__name__)


# =============================================================================
# GLOBAL EXCEPTION HANDLERS
# =============================================================================
# These handlers sanitize error messages to prevent information disclosure.
# Internal details are logged but not exposed to clients.
# =============================================================================

def generate_error_id() -> str:
    """Generate a unique error ID for tracking."""
    return str(uuid.uuid4())[:8]


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handle unexpected exceptions.

    Security: Never expose internal error details to clients.
    Log the full error for debugging, return sanitized message to client.
    """
    error_id = generate_error_id()

    # Log full error details internally
    logger.error(
        f"Unhandled exception [error_id={error_id}]",
        extra={
            "error_id": error_id,
            "path": request.url.path,
            "method": request.method,
            "client_ip": request.client.host if request.client else "unknown",
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "traceback": traceback.format_exc(),
        },
        exc_info=True,
    )

    # Return sanitized error to client
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "An internal error occurred. Please try again later.",
            "error_id": error_id,  # Include ID so user can report it
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """
    Handle HTTP exceptions.

    Security: Only expose intentional error messages (from HTTPException.detail),
    but sanitize unexpected ones.
    """
    # Allow certain status codes to pass through with their messages
    safe_status_codes = {400, 401, 403, 404, 405, 409, 410, 422, 429}

    if exc.status_code in safe_status_codes:
        # These are intentional client errors, safe to expose
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": exc.detail,
            },
            headers=getattr(exc, "headers", None),
        )

    # For 5xx errors, sanitize the message
    error_id = generate_error_id()

    logger.error(
        f"HTTP exception [error_id={error_id}]",
        extra={
            "error_id": error_id,
            "status_code": exc.status_code,
            "path": request.url.path,
            "detail": exc.detail,
        },
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": "An error occurred while processing your request.",
            "error_id": error_id,
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Handle request validation errors.

    Security: Expose validation errors (they help users fix their requests)
    but sanitize the format to not reveal internal structure.
    """
    # Extract user-friendly error messages
    errors = []
    for error in exc.errors():
        # Get field location (e.g., "body -> email")
        loc = " -> ".join(str(x) for x in error.get("loc", []))
        msg = error.get("msg", "Invalid value")

        # Sanitize: don't include internal type information
        errors.append({
            "field": loc,
            "message": msg,
        })

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": "Validation error",
            "details": errors,
        },
    )


async def processing_error_handler(
    request: Request, exc: ProcessingError
) -> JSONResponse:
    """
    Handle file processing errors.

    Security: These are operational errors we control,
    so the messages are safe to expose.
    """
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": str(exc),
        },
    )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Only add HSTS in production
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Content Security Policy for API
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

        return response

# Background task reference
cleanup_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global cleanup_task

    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()

    # Start cleanup scheduler in background
    from app.utils.cleanup import run_cleanup_scheduler
    cleanup_task = asyncio.create_task(run_cleanup_scheduler(interval_minutes=30))
    logger.info("Cleanup scheduler started")

    yield

    # Shutdown
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
        logger.info("Cleanup scheduler stopped")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-format file processing API",
    lifespan=lifespan,
)

# Register exception handlers
app.add_exception_handler(Exception, generic_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ProcessingError, processing_error_handler)

# Security headers middleware (runs first)
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting middleware
# Use Redis-based rate limiter if Redis is available (for distributed deployments)
# Fall back to in-memory limiter for development
try:
    if settings.REDIS_URL and settings.APP_ENV == "production":
        from app.core.rate_limiter_redis import RedisRateLimitMiddleware, RedisRateLimitConfig
        app.add_middleware(
            RedisRateLimitMiddleware,
            redis_url=settings.REDIS_URL,
            config=RedisRateLimitConfig(
                requests_per_minute=60,
                requests_per_hour=1000,
                burst_limit=10,
            ),
            exclude_paths=["/", "/health", "/docs", "/openapi.json", "/redoc"],
        )
        logger.info("Using Redis-based rate limiter")
    else:
        raise ImportError("Use in-memory limiter")
except Exception:
    # Fallback to in-memory rate limiter
    app.add_middleware(
        RateLimitMiddleware,
        config=RateLimitConfig(
            requests_per_minute=60,
            requests_per_hour=1000,
            burst_limit=10,
        ),
        exclude_paths=["/", "/health", "/docs", "/openapi.json", "/redoc"],
    )
    logger.info("Using in-memory rate limiter")

# CORS middleware - restricted methods and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "Accept"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
    max_age=3600,
)

# Include API router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Include Auth router (separate, no API key required)
from app.api.v1.router import auth_router
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}
