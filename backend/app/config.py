"""Application configuration."""

import os
from pathlib import Path
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings."""

    # Application
    APP_NAME: str = "PDFGlide"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True

    # API
    API_V1_PREFIX: str = "/api/v1"

    # Security - API Key (optional in development, required in production)
    API_KEY: Optional[str] = None

    # Database - NO DEFAULT CREDENTIALS (must be set via environment)
    DATABASE_URL: str = ""
    DATABASE_URL_SYNC: str = ""

    # Storage
    STORAGE_PATH: Path = Path("./storage")
    UPLOAD_DIR: str = "uploads"
    PROCESSED_DIR: str = "processed"

    # File limits
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    MAX_FILES_PER_REQUEST: int = 20
    FILE_EXPIRY_HOURS: int = 1

    # Data Retention (configurable for GDPR compliance)
    UPLOAD_RETENTION_HOURS: int = 2  # Delete input files after X hours
    ORPHAN_TASK_RETENTION_HOURS: int = 24  # Delete orphaned tasks after X hours
    USAGE_STATS_RETENTION_DAYS: int = 90  # Keep usage stats for X days
    AUDIT_LOG_RETENTION_DAYS: int = 365  # Keep audit logs for X days
    ENABLE_AUDIT_LOGGING: bool = True  # Enable/disable audit logging

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ==================== Queue System (Celery + Redis) ====================
    # Redis URL for Celery broker
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"
    
    # Redis URL for rate limiting and caching
    REDIS_URL: str = "redis://localhost:6379/2"
    
    # Enable async processing (queue mode)
    ENABLE_ASYNC_PROCESSING: bool = True
    
    # Async processing threshold - files larger than this (in bytes) use async mode
    ASYNC_THRESHOLD_SIZE: int = 5242880  # 5MB
    
    # ==================== Object Storage (S3/MinIO) ====================
    # Storage type: "local" or "s3"
    STORAGE_TYPE: str = "local"
    
    # S3/MinIO settings (only used when STORAGE_TYPE="s3")
    S3_ENDPOINT: Optional[str] = None  # e.g., "http://localhost:9000" for MinIO
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET: str = "pdfglide"
    S3_REGION: str = "us-east-1"
    S3_USE_SSL: bool = True

    # ==================== User Tier Limits ====================
    # Free tier limits
    FREE_DAILY_FILE_LIMIT: int = 5
    FREE_MAX_FILE_SIZE: int = 10485760  # 10MB
    FREE_QUEUE_PRIORITY: str = "normal"
    
    # Pro tier limits
    PRO_DAILY_FILE_LIMIT: int = -1  # -1 = unlimited
    PRO_MAX_FILE_SIZE: int = 104857600  # 100MB
    PRO_QUEUE_PRIORITY: str = "high"
    
    # Business tier limits
    BUSINESS_DAILY_FILE_LIMIT: int = -1  # unlimited
    BUSINESS_MAX_FILE_SIZE: int = 524288000  # 500MB
    BUSINESS_QUEUE_PRIORITY: str = "critical"
    
    # Anonymous (no account) limits
    ANONYMOUS_DAILY_FILE_LIMIT: int = 3
    ANONYMOUS_MAX_FILE_SIZE: int = 5242880  # 5MB

    # ==================== AI Services ====================
    # Z.ai API for AI-powered document conversion
    ZAI_API_KEY: Optional[str] = None
    ZAI_MODEL: str = "glm-4.6v-flash"  # Options: glm-4.6v-flash (free), glm-4.6v-flashx, glm-4.6v

    # OpenRouter API for vision models (Qwen-VL, etc.)
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "qwen/qwen2.5-vl-72b-instruct:free"  # Free tier model

    # ==================== JWT Authentication ====================
    JWT_SECRET_KEY: str = "change-this-in-production-to-a-random-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Validate DATABASE_URL is set and doesn't use default credentials."""
        if not v:
            # Check environment variable directly
            v = os.getenv("DATABASE_URL", "")

        if not v:
            raise ValueError(
                "DATABASE_URL must be set. "
                "Example: postgresql+asyncpg://user:password@localhost:5432/dbname"
            )

        # Block default/weak credentials in production
        if "postgres:postgres" in v and os.getenv("APP_ENV") == "production":
            raise ValueError(
                "Default credentials (postgres:postgres) are not allowed in production. "
                "Please set secure database credentials."
            )

        return v

    @field_validator("DATABASE_URL_SYNC", mode="before")
    @classmethod
    def validate_database_url_sync(cls, v: str) -> str:
        """Validate DATABASE_URL_SYNC is set."""
        if not v:
            v = os.getenv("DATABASE_URL_SYNC", "")

        if not v:
            raise ValueError(
                "DATABASE_URL_SYNC must be set. "
                "Example: postgresql://user:password@localhost:5432/dbname"
            )

        return v

    @field_validator("API_KEY", mode="before")
    @classmethod
    def validate_api_key(cls, v: Optional[str]) -> Optional[str]:
        """Warn if API_KEY is not set in production."""
        if not v:
            v = os.getenv("API_KEY")

        if not v and os.getenv("APP_ENV") == "production":
            import warnings
            warnings.warn(
                "API_KEY is not set. API will be accessible without authentication. "
                "Set API_KEY environment variable for production use.",
                UserWarning
            )

        return v

    @property
    def upload_path(self) -> Path:
        """Get upload directory path."""
        path = self.STORAGE_PATH / self.UPLOAD_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def processed_path(self) -> Path:
        """Get processed files directory path."""
        path = self.STORAGE_PATH / self.PROCESSED_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
