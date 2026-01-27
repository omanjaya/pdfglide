"""Authentication and authorization utilities."""

from datetime import datetime, timedelta
from typing import Optional
import hashlib

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        return None


def hash_ip(ip_address: str) -> str:
    """Hash an IP address for privacy-preserving tracking."""
    return hashlib.sha256(ip_address.encode()).hexdigest()[:16]


def get_tier_limits(tier: str) -> dict:
    """Get the limits for a given tier."""
    tier = tier.lower()
    
    if tier == "business":
        return {
            "daily_file_limit": settings.BUSINESS_DAILY_FILE_LIMIT,
            "max_file_size": settings.BUSINESS_MAX_FILE_SIZE,
            "queue_priority": settings.BUSINESS_QUEUE_PRIORITY,
            "show_ads": False,
            "batch_processing": True,
            "api_access": True,
        }
    elif tier == "pro":
        return {
            "daily_file_limit": settings.PRO_DAILY_FILE_LIMIT,
            "max_file_size": settings.PRO_MAX_FILE_SIZE,
            "queue_priority": settings.PRO_QUEUE_PRIORITY,
            "show_ads": False,
            "batch_processing": True,
            "api_access": True,
        }
    elif tier == "free":
        return {
            "daily_file_limit": settings.FREE_DAILY_FILE_LIMIT,
            "max_file_size": settings.FREE_MAX_FILE_SIZE,
            "queue_priority": settings.FREE_QUEUE_PRIORITY,
            "show_ads": True,
            "batch_processing": False,
            "api_access": False,
        }
    else:
        # Anonymous user
        return {
            "daily_file_limit": settings.ANONYMOUS_DAILY_FILE_LIMIT,
            "max_file_size": settings.ANONYMOUS_MAX_FILE_SIZE,
            "queue_priority": "low",
            "show_ads": True,
            "batch_processing": False,
            "api_access": False,
        }
