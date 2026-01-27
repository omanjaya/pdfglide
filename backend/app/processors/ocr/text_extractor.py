"""OCR text extractor processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class TextExtractor(BaseProcessor):
    """Extract text from images and PDFs using OCR."""

    async def execute(
        self,
        file: Path,
        language: str = "eng",
    ) -> str:
        """
        Extract text from image or PDF.

        Args:
            file: Input file path (image or PDF)
            language: OCR language code (e.g., 'eng', 'ind', 'jpn')

        Returns:
            Extracted text
        """
        try:
            ext = file.suffix.lower()

            if ext == ".pdf":
                # Convert PDF to images first
                text = await self._extract_from_pdf(file, language)
            else:
                # Direct OCR on image
                text = await self._extract_from_image(file, language)

            return text.strip()

        except ImportError as e:
            raise ProcessingError(f"Required package not installed: {str(e)}")
        except Exception as e:
            raise ProcessingError(f"Failed to extract text: {str(e)}")

    async def _extract_from_image(self, file: Path, language: str) -> str:
        """Extract text from single image."""

        def _ocr():
            import pytesseract
            from PIL import Image

            image = Image.open(file)
            text = pytesseract.image_to_string(image, lang=language)
            return text

        # Run CPU-intensive OCR in thread pool
        return await asyncio.to_thread(_ocr)

    async def _extract_from_pdf(self, file: Path, language: str) -> str:
        """Extract text from PDF by converting to images first."""

        def _convert_and_ocr():
            import pytesseract
            from pdf2image import convert_from_path

            # Convert PDF to images
            images = convert_from_path(str(file), dpi=200)

            # Extract text from each page
            all_text = []
            for i, image in enumerate(images):
                page_text = pytesseract.image_to_string(image, lang=language)
                all_text.append(f"--- Page {i + 1} ---\n{page_text}")

            return "\n\n".join(all_text)

        # Run CPU-intensive conversion and OCR in thread pool
        return await asyncio.to_thread(_convert_and_ocr)
