"""
Storage backend abstraction for local and S3/MinIO storage.

This module provides a unified interface for file storage, supporting:
- Local filesystem storage (for development)
- S3/MinIO object storage (for production)
"""

import os
import logging
import aiofiles
from pathlib import Path
from typing import Optional, BinaryIO
from abc import ABC, abstractmethod

from app.config import settings

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    """Abstract base class for storage backends."""
    
    @abstractmethod
    async def upload_file(self, local_path: Path, key: str) -> str:
        """
        Upload a file to storage.
        
        Args:
            local_path: Path to the local file
            key: Storage key/path for the file
            
        Returns:
            Storage URI or path
        """
        pass
    
    @abstractmethod
    async def download_file(self, key: str, local_path: Path) -> Path:
        """
        Download a file from storage.
        
        Args:
            key: Storage key/path of the file
            local_path: Local path to save the file
            
        Returns:
            Path to the downloaded file
        """
        pass
    
    @abstractmethod
    async def delete_file(self, key: str) -> bool:
        """
        Delete a file from storage.
        
        Args:
            key: Storage key/path of the file
            
        Returns:
            True if deleted successfully
        """
        pass
    
    @abstractmethod
    async def get_presigned_url(self, key: str, expires: int = 3600) -> Optional[str]:
        """
        Get a presigned URL for direct file access.
        
        Args:
            key: Storage key/path of the file
            expires: URL expiration time in seconds
            
        Returns:
            Presigned URL or None if not supported
        """
        pass
    
    @abstractmethod
    async def file_exists(self, key: str) -> bool:
        """Check if a file exists in storage."""
        pass


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend."""
    
    def __init__(self, base_path: Path):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _get_full_path(self, key: str) -> Path:
        """Get full filesystem path for a key."""
        return self.base_path / key
    
    async def upload_file(self, local_path: Path, key: str) -> str:
        """Copy file to storage location."""
        dest_path = self._get_full_path(key)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        
        # If source and destination are different, copy
        if local_path != dest_path:
            async with aiofiles.open(local_path, 'rb') as src:
                async with aiofiles.open(dest_path, 'wb') as dst:
                    while chunk := await src.read(8192):
                        await dst.write(chunk)
        
        return str(dest_path)
    
    async def download_file(self, key: str, local_path: Path) -> Path:
        """Copy file from storage to local path."""
        src_path = self._get_full_path(key)
        
        if src_path == local_path:
            return local_path
        
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        async with aiofiles.open(src_path, 'rb') as src:
            async with aiofiles.open(local_path, 'wb') as dst:
                while chunk := await src.read(8192):
                    await dst.write(chunk)
        
        return local_path
    
    async def delete_file(self, key: str) -> bool:
        """Delete file from local storage."""
        file_path = self._get_full_path(key)
        try:
            if file_path.exists():
                file_path.unlink()
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete file {key}: {e}")
            return False
    
    async def get_presigned_url(self, key: str, expires: int = 3600) -> Optional[str]:
        """Local storage doesn't support presigned URLs."""
        return None
    
    async def file_exists(self, key: str) -> bool:
        """Check if file exists locally."""
        return self._get_full_path(key).exists()


class S3StorageBackend(StorageBackend):
    """S3/MinIO object storage backend."""
    
    def __init__(
        self,
        bucket: str,
        endpoint_url: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: str = "us-east-1",
        use_ssl: bool = True,
    ):
        self.bucket = bucket
        self.endpoint_url = endpoint_url
        self.region = region
        self._client = None
        
        # Store credentials
        self._access_key = access_key
        self._secret_key = secret_key
        self._use_ssl = use_ssl
        
        # Local cache path for downloads
        self._cache_path = Path(settings.STORAGE_PATH) / ".s3_cache"
        self._cache_path.mkdir(parents=True, exist_ok=True)
    
    def _get_client(self):
        """Lazy-load S3 client."""
        if self._client is None:
            import boto3
            from botocore.config import Config
            
            config = Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'},
            )
            
            self._client = boto3.client(
                's3',
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self._access_key,
                aws_secret_access_key=self._secret_key,
                region_name=self.region,
                use_ssl=self._use_ssl,
                config=config,
            )
            
            # Ensure bucket exists
            try:
                self._client.head_bucket(Bucket=self.bucket)
            except Exception:
                try:
                    self._client.create_bucket(Bucket=self.bucket)
                    logger.info(f"Created S3 bucket: {self.bucket}")
                except Exception as e:
                    logger.error(f"Failed to create bucket {self.bucket}: {e}")
        
        return self._client
    
    async def upload_file(self, local_path: Path, key: str) -> str:
        """Upload file to S3."""
        import asyncio
        
        def _upload():
            client = self._get_client()
            client.upload_file(str(local_path), self.bucket, key)
            return f"s3://{self.bucket}/{key}"
        
        return await asyncio.get_event_loop().run_in_executor(None, _upload)
    
    async def download_file(self, key: str, local_path: Path) -> Path:
        """Download file from S3."""
        import asyncio
        
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        def _download():
            client = self._get_client()
            client.download_file(self.bucket, key, str(local_path))
            return local_path
        
        return await asyncio.get_event_loop().run_in_executor(None, _download)
    
    async def delete_file(self, key: str) -> bool:
        """Delete file from S3."""
        import asyncio
        
        def _delete():
            try:
                client = self._get_client()
                client.delete_object(Bucket=self.bucket, Key=key)
                return True
            except Exception as e:
                logger.error(f"Failed to delete S3 file {key}: {e}")
                return False
        
        return await asyncio.get_event_loop().run_in_executor(None, _delete)
    
    async def get_presigned_url(self, key: str, expires: int = 3600) -> Optional[str]:
        """Generate presigned URL for direct download."""
        import asyncio
        
        def _presign():
            try:
                client = self._get_client()
                url = client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': key},
                    ExpiresIn=expires,
                )
                return url
            except Exception as e:
                logger.error(f"Failed to generate presigned URL for {key}: {e}")
                return None
        
        return await asyncio.get_event_loop().run_in_executor(None, _presign)
    
    async def file_exists(self, key: str) -> bool:
        """Check if file exists in S3."""
        import asyncio
        
        def _exists():
            try:
                client = self._get_client()
                client.head_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:
                return False
        
        return await asyncio.get_event_loop().run_in_executor(None, _exists)


def get_storage_backend() -> StorageBackend:
    """
    Factory function to get the configured storage backend.
    
    Returns:
        StorageBackend instance based on settings.STORAGE_TYPE
    """
    if settings.STORAGE_TYPE == "s3":
        return S3StorageBackend(
            bucket=settings.S3_BUCKET,
            endpoint_url=settings.S3_ENDPOINT,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            region=settings.S3_REGION,
            use_ssl=settings.S3_USE_SSL,
        )
    else:
        return LocalStorageBackend(settings.STORAGE_PATH)


# Global storage backend instance
_storage_backend: Optional[StorageBackend] = None


def get_storage() -> StorageBackend:
    """Get the global storage backend instance."""
    global _storage_backend
    if _storage_backend is None:
        _storage_backend = get_storage_backend()
    return _storage_backend
