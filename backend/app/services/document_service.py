"""Document processing service."""

from pathlib import Path
from typing import Optional

from app.services.base import BaseService, ProcessedResult
from app.processors.document.office_converter import OfficeConverter
from app.processors.document.html_converter import HTMLToPDFConverter
from app.processors.document.pptx_converter import PowerPointToPDFConverter
from app.processors.document.ai_pdf_converter import AIPDFConverter
from app.config import settings


class DocumentService(BaseService):
    """Service for document operations."""

    ALLOWED_TYPES = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
    ]

    def __init__(self, storage_path: Path):
        super().__init__(storage_path)
        self.converter = OfficeConverter(self.processed_dir)
        self.html_converter = HTMLToPDFConverter(self.processed_dir)
        self.pptx_converter = PowerPointToPDFConverter(self.processed_dir)
        self.ai_converter = AIPDFConverter(self.processed_dir, api_key=settings.ZAI_API_KEY)

    async def word_to_pdf(self, file: Path) -> ProcessedResult:
        """Convert Word document to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.converter.to_pdf(file, output_path)

        original_name = file.stem
        return ProcessedResult(
            id=output_id,
            file_name=f"{original_name}.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def excel_to_pdf(self, file: Path) -> ProcessedResult:
        """Convert Excel document to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.converter.to_pdf(file, output_path)

        original_name = file.stem
        return ProcessedResult(
            id=output_id,
            file_name=f"{original_name}.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def pdf_to_word(
        self,
        file: Path,
        use_ai: bool = True,
        quality: str = "standard",
        model: Optional[str] = None,
    ) -> ProcessedResult:
        """
        Convert PDF to Word document.

        Args:
            file: Input PDF file
            use_ai: Use AI-powered conversion (recommended, much better quality)
            quality: Conversion quality - draft, standard, high
            model: AI model to use (default from settings)

        Returns:
            ProcessedResult with converted DOCX file
        """
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".docx")

        # Use AI conversion if enabled and API key is configured
        if use_ai and settings.ZAI_API_KEY:
            ai_model = model or settings.ZAI_MODEL
            await self.ai_converter.execute(
                file, output_path, model=ai_model, quality=quality
            )
        else:
            # Fallback to rule-based conversion
            await self.converter.pdf_to_docx(file, output_path)

        original_name = file.stem
        return ProcessedResult(
            id=output_id,
            file_name=f"{original_name}.docx",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    async def powerpoint_to_pdf(self, file: Path) -> ProcessedResult:
        """Convert PowerPoint to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.pptx_converter.execute(file, output_path)

        original_name = file.stem
        return ProcessedResult(
            id=output_id,
            file_name=f"{original_name}.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def html_to_pdf(
        self,
        url: Optional[str] = None,
        html_content: Optional[str] = None,
        page_size: str = "A4",
        margin: int = 20,
    ) -> ProcessedResult:
        """Convert HTML or URL to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.html_converter.execute(
            output_path, url=url, html_content=html_content,
            page_size=page_size, margin=margin
        )

        # Generate filename based on input
        if url:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            file_name = f"{parsed.netloc.replace('.', '_')}.pdf"
        else:
            file_name = "converted.pdf"

        return ProcessedResult(
            id=output_id,
            file_name=file_name,
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )
