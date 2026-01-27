"""OCR processing service."""

from pathlib import Path

from app.services.base import BaseService, ProcessedResult
from app.processors.ocr.text_extractor import TextExtractor


class OCRService(BaseService):
    """Service for OCR operations."""

    ALLOWED_TYPES = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
    ]

    def __init__(self, storage_path: Path):
        super().__init__(storage_path)
        self.text_extractor = TextExtractor(self.processed_dir)

    async def extract_text(
        self,
        file: Path,
        language: str = "eng",
    ) -> str:
        """Extract text from image or PDF using OCR."""
        return await self.text_extractor.execute(file, language)
