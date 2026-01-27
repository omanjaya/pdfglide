"""Security utilities and authentication."""

import secrets
import hashlib
from typing import Optional
from fastapi import HTTPException, Security, Request
from fastapi.security import APIKeyHeader, APIKeyQuery
from starlette.status import HTTP_401_UNAUTHORIZED, HTTP_403_FORBIDDEN

from app.config import settings


# API Key header and query parameter
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
api_key_query = APIKeyQuery(name="api_key", auto_error=False)


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure comparison."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def verify_api_key(api_key: str) -> bool:
    """Verify an API key against the configured key."""
    if not settings.API_KEY:
        # If no API key is configured, allow access (development mode)
        return True

    # Use constant-time comparison to prevent timing attacks
    return secrets.compare_digest(api_key, settings.API_KEY)


async def get_api_key(
    request: Request,
    api_key_header_value: Optional[str] = Security(api_key_header),
    api_key_query_value: Optional[str] = Security(api_key_query),
) -> Optional[str]:
    """
    Extract and validate API key from header or query parameter.

    Returns the API key if valid, raises HTTPException if invalid.
    """
    # Skip authentication for certain paths
    skip_paths = ["/", "/health", "/docs", "/openapi.json", "/redoc"]
    if request.url.path in skip_paths:
        return None

    # If no API key is configured, allow access (development mode)
    if not settings.API_KEY:
        return None

    # Try header first, then query parameter
    api_key = api_key_header_value or api_key_query_value

    if not api_key:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="API key required. Provide via X-API-Key header or api_key query parameter.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if not verify_api_key(api_key):
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )

    return api_key


def generate_api_key(length: int = 32) -> str:
    """Generate a secure random API key."""
    return secrets.token_urlsafe(length)


# For rate limiting per API key
def get_client_identifier(request: Request, api_key: Optional[str] = None) -> str:
    """
    Get a unique identifier for the client.

    Uses API key if available, otherwise falls back to IP address.
    """
    if api_key:
        # Hash the API key to avoid storing it directly
        return f"key:{hash_api_key(api_key)[:16]}"

    # Fallback to IP address
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Only trust X-Forwarded-For if we're behind a known proxy
        # For now, use the first IP in the chain
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    return f"ip:{client_ip}"
