"""PDF processing service."""

import fitz  # PyMuPDF
from pathlib import Path
from typing import Optional, List, Dict, Any

from app.services.base import BaseService, ProcessedResult
from app.schemas.file import PDFCompressOptions
from app.schemas.pdf_edit import (
    TextSearchResult,
    TextReplacement,
    FormFieldsResponse,
    EditOperation,
    TextOperation,
    ImageOperation,
    RectangleOperation,
    LineOperation,
    HighlightOperation,
    CommentOperation,
    RedactOperation,
)
from app.processors.pdf.merger import PDFMerger
from app.processors.pdf.splitter import PDFSplitter
from app.processors.pdf.compressor import PDFCompressor
from app.processors.pdf.converter import PDFToImageConverter, ImageToPDFConverter
from app.processors.pdf.rotator import PDFRotator
from app.processors.pdf.watermark import PDFWatermark
from app.processors.pdf.page_numbers import PDFPageNumbers
from app.processors.pdf.protector import PDFProtector, PDFUnlocker
from app.processors.pdf.organizer import PDFOrganizer
from app.processors.pdf.repairer import PDFRepairer
from app.processors.pdf.cropper import PDFCropper
from app.processors.pdf.signer import PDFSigner
from app.processors.pdf.metadata import PDFMetadataEditor
from app.processors.pdf.table_extractor import PDFTableExtractor
from app.processors.pdf.pptx_converter import PDFToPowerPointConverter
from app.processors.pdf.redactor import PDFRedactor
from app.processors.pdf.comparator import PDFComparator
from app.processors.pdf.pdfa_converter import PDFToPDFAConverter
from app.processors.pdf.editor import PDFEditor
from app.processors.pdf.text_editor import PDFTextEditor
from app.processors.pdf.form_filler import PDFFormFiller


class PDFService(BaseService):
    """Service for PDF operations."""

    ALLOWED_TYPES = ["application/pdf"]

    def __init__(self, storage_path: Path):
        super().__init__(storage_path)
        self.merger = PDFMerger(self.processed_dir)
        self.splitter = PDFSplitter(self.processed_dir)
        self.compressor = PDFCompressor(self.processed_dir)
        self.pdf_to_image = PDFToImageConverter(self.processed_dir)
        self.image_to_pdf = ImageToPDFConverter(self.processed_dir)
        self.rotator = PDFRotator(self.processed_dir)
        self.watermark = PDFWatermark(self.processed_dir)
        self.page_numbers = PDFPageNumbers(self.processed_dir)
        self.protector = PDFProtector(self.processed_dir)
        self.unlocker = PDFUnlocker(self.processed_dir)
        self.organizer = PDFOrganizer(self.processed_dir)
        self.repairer = PDFRepairer(self.processed_dir)
        self.cropper = PDFCropper(self.processed_dir)
        self.signer = PDFSigner(self.processed_dir)
        self.metadata_editor = PDFMetadataEditor(self.processed_dir)
        self.table_extractor = PDFTableExtractor(self.processed_dir)
        # New processors
        self.pptx_converter = PDFToPowerPointConverter(self.processed_dir)
        self.redactor = PDFRedactor(self.processed_dir)
        self.comparator = PDFComparator(self.processed_dir)
        self.pdfa_converter = PDFToPDFAConverter(self.processed_dir)
        self.editor = PDFEditor(self.processed_dir)
        # Advanced edit processors
        self.text_editor = PDFTextEditor(self.processed_dir)
        self.form_filler = PDFFormFiller(self.processed_dir)

    async def merge(self, files: list[Path]) -> ProcessedResult:
        """Merge multiple PDFs into one."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.merger.execute(files, output_path)

        return ProcessedResult(
            id=output_id,
            file_name="merged.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def split(self, file: Path, pages: str) -> ProcessedResult:
        """Split PDF into multiple files."""
        output_id = self.generate_output_id()

        result_files = await self.splitter.execute(file, pages, output_id)

        # If multiple files, create a zip
        if len(result_files) > 1:
            from app.core.file_handler import FileHandler

            zip_path = self.get_output_path(output_id, ".zip")
            await FileHandler.create_zip(result_files, zip_path)

            return ProcessedResult(
                id=output_id,
                file_name="split_pages.zip",
                file_path=zip_path,
                file_size=zip_path.stat().st_size,
                mime_type="application/zip",
            )
        else:
            return ProcessedResult(
                id=output_id,
                file_name=result_files[0].name,
                file_path=result_files[0],
                file_size=result_files[0].stat().st_size,
                mime_type="application/pdf",
            )

    async def compress(
        self,
        file: Path,
        options: PDFCompressOptions,
    ) -> tuple[ProcessedResult, dict]:
        """Compress PDF to reduce file size with advanced optimization."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        # Execute compression with new options and get stats
        result_path, stats = await self.compressor.execute(
            file,
            output_path,
            quality=options.quality,
            compress_images=options.compress_images,
            image_dpi=options.image_dpi,
            remove_metadata=options.remove_metadata,
            grayscale=options.grayscale,
            target_size_kb=options.target_size_kb,
            preserve_quality=options.preserve_quality,
        )

        return ProcessedResult(
            id=output_id,
            file_name="compressed.pdf",
            file_path=result_path,
            file_size=result_path.stat().st_size,
            mime_type="application/pdf",
        ), stats

    async def to_images(
        self,
        file: Path,
        output_format: str = "jpg",
    ) -> ProcessedResult:
        """Convert PDF to images."""
        output_id = self.generate_output_id()

        result_files = await self.pdf_to_image.execute(file, output_format)

        # Create a zip if multiple pages
        if len(result_files) > 1:
            from app.core.file_handler import FileHandler

            zip_path = self.get_output_path(output_id, ".zip")
            await FileHandler.create_zip(result_files, zip_path)

            return ProcessedResult(
                id=output_id,
                file_name="pdf_images.zip",
                file_path=zip_path,
                file_size=zip_path.stat().st_size,
                mime_type="application/zip",
            )
        else:
            return ProcessedResult(
                id=output_id,
                file_name=result_files[0].name,
                file_path=result_files[0],
                file_size=result_files[0].stat().st_size,
                mime_type=f"image/{output_format}",
            )

    async def from_images(self, files: list[Path]) -> ProcessedResult:
        """Convert images to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.image_to_pdf.execute(files, output_path)

        return ProcessedResult(
            id=output_id,
            file_name="images.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def rotate(
        self,
        file: Path,
        rotation: int = 90,
        pages: str = "all",
    ) -> ProcessedResult:
        """Rotate PDF pages."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.rotator.execute(file, output_path, rotation, pages)

        return ProcessedResult(
            id=output_id,
            file_name="rotated.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def add_watermark(
        self,
        file: Path,
        text: str,
        position: str = "center",
        opacity: float = 0.3,
        rotation: int = 45,
        font_size: int = 60,
        color: str = "gray",
        pages: str = "all",
    ) -> ProcessedResult:
        """Add watermark to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.watermark.execute(
            file, output_path, text, position, opacity, rotation, font_size, color, pages
        )

        return ProcessedResult(
            id=output_id,
            file_name="watermarked.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def add_page_numbers(
        self,
        file: Path,
        position: str = "bottom-center",
        start_number: int = 1,
        format_template: str = "{n}",
        font_size: int = 12,
        margin: int = 30,
    ) -> ProcessedResult:
        """Add page numbers to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.page_numbers.execute(
            file, output_path, position, start_number, format_template, font_size, margin
        )

        return ProcessedResult(
            id=output_id,
            file_name="numbered.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def protect(
        self,
        file: Path,
        user_password: Optional[str] = None,
        owner_password: Optional[str] = None,
        allow_printing: bool = True,
        allow_copying: bool = False,
        allow_modifying: bool = False,
    ) -> ProcessedResult:
        """Protect PDF with password."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.protector.execute(
            file, output_path, user_password, owner_password,
            allow_printing, allow_copying, allow_modifying
        )

        return ProcessedResult(
            id=output_id,
            file_name="protected.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def unlock(
        self,
        file: Path,
        password: str = "",
    ) -> ProcessedResult:
        """Remove password from PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.unlocker.execute(file, output_path, password)

        return ProcessedResult(
            id=output_id,
            file_name="unlocked.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def organize(
        self,
        file: Path,
        page_order: List[int],
    ) -> ProcessedResult:
        """Reorganize PDF pages."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.organizer.execute(file, output_path, page_order)

        return ProcessedResult(
            id=output_id,
            file_name="organized.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def delete_pages(
        self,
        file: Path,
        pages_to_delete: List[int],
    ) -> ProcessedResult:
        """Delete pages from PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.organizer.delete_pages(file, output_path, pages_to_delete)

        return ProcessedResult(
            id=output_id,
            file_name="pages_deleted.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def extract_pages(
        self,
        file: Path,
        pages_to_extract: List[int],
    ) -> ProcessedResult:
        """Extract specific pages from PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.organizer.extract_pages(file, output_path, pages_to_extract)

        return ProcessedResult(
            id=output_id,
            file_name="extracted.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    # ============== NEW FEATURES ==============

    async def repair(self, file: Path) -> ProcessedResult:
        """Repair corrupted PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.repairer.execute(file, output_path)

        return ProcessedResult(
            id=output_id,
            file_name="repaired.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def crop(
        self,
        file: Path,
        left: float = 0,
        top: float = 0,
        right: float = 0,
        bottom: float = 0,
        pages: str = "all",
    ) -> ProcessedResult:
        """Crop PDF margins."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.cropper.execute(file, output_path, left, top, right, bottom, pages)

        return ProcessedResult(
            id=output_id,
            file_name="cropped.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def sign(
        self,
        file: Path,
        signature_image: Optional[Path] = None,
        signature_text: Optional[str] = None,
        position: str = "bottom-right",
        page: int = -1,
        width: int = 150,
        height: int = 50,
    ) -> ProcessedResult:
        """Add signature to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.signer.execute(
            file, output_path, signature_image, signature_text,
            position, page, width, height
        )

        return ProcessedResult(
            id=output_id,
            file_name="signed.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def edit_metadata(
        self,
        file: Path,
        title: Optional[str] = None,
        author: Optional[str] = None,
        subject: Optional[str] = None,
        keywords: Optional[str] = None,
        creator: Optional[str] = None,
    ) -> ProcessedResult:
        """Edit PDF metadata."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.metadata_editor.execute(
            file, output_path, title, author, subject, keywords, creator
        )

        return ProcessedResult(
            id=output_id,
            file_name="metadata_updated.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def to_excel(
        self,
        file: Path,
        pages: str = "all",
    ) -> ProcessedResult:
        """Extract tables from PDF to Excel."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".xlsx")

        result_path = await self.table_extractor.execute(file, output_path, pages)

        return ProcessedResult(
            id=output_id,
            file_name="extracted_tables.xlsx",
            file_path=result_path,
            file_size=result_path.stat().st_size,
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    # ============== NEW FEATURES - PHASE 2 ==============

    async def to_powerpoint(
        self,
        file: Path,
        dpi: int = 150,
    ) -> ProcessedResult:
        """Convert PDF to PowerPoint."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pptx")

        result_path = await self.pptx_converter.execute(file, output_path, dpi)

        return ProcessedResult(
            id=output_id,
            file_name="presentation.pptx",
            file_path=result_path,
            file_size=result_path.stat().st_size,
            mime_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )

    async def redact(
        self,
        file: Path,
        search_terms: Optional[List[str]] = None,
        redact_areas: Optional[List[dict]] = None,
    ) -> ProcessedResult:
        """Redact sensitive content from PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.redactor.execute(
            file, output_path, search_terms, redact_areas
        )

        return ProcessedResult(
            id=output_id,
            file_name="redacted.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def redact_patterns(
        self,
        file: Path,
        patterns: List[str],
    ) -> ProcessedResult:
        """Redact content matching regex patterns."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.redactor.redact_by_pattern(file, output_path, patterns)

        return ProcessedResult(
            id=output_id,
            file_name="redacted.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def compare(
        self,
        file1: Path,
        file2: Path,
        output_mode: str = "visual",
    ) -> ProcessedResult:
        """Compare two PDFs."""
        output_id = self.generate_output_id()

        if output_mode == "visual":
            output_path = self.get_output_path(output_id, ".pdf")
            mime_type = "application/pdf"
            file_name = "comparison.pdf"
        else:
            output_path = self.get_output_path(output_id, ".txt")
            mime_type = "text/plain"
            file_name = "comparison.txt"

        result_path = await self.comparator.execute(
            file1, file2, output_path, output_mode=output_mode
        )

        return ProcessedResult(
            id=output_id,
            file_name=file_name,
            file_path=result_path,
            file_size=result_path.stat().st_size,
            mime_type=mime_type,
        )

    async def to_pdfa(
        self,
        file: Path,
        pdfa_level: str = "2b",
    ) -> ProcessedResult:
        """Convert PDF to PDF/A archival format."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.pdfa_converter.execute(file, output_path, pdfa_level)

        return ProcessedResult(
            id=output_id,
            file_name=f"archive_pdfa-{pdfa_level}.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def add_text_to_pdf(
        self,
        file: Path,
        text: str,
        page: int,
        x: float,
        y: float,
        font_size: int = 12,
        color: tuple = (0, 0, 0),
    ) -> ProcessedResult:
        """Add text to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.editor.add_text(
            file, output_path, text, page, x, y, font_size, color=color
        )

        return ProcessedResult(
            id=output_id,
            file_name="edited.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def add_image_to_pdf(
        self,
        file: Path,
        image_path: Path,
        page: int,
        x: float,
        y: float,
        width: Optional[float] = None,
        height: Optional[float] = None,
    ) -> ProcessedResult:
        """Add image to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.editor.add_image(
            file, output_path, image_path, page, x, y, width, height
        )

        return ProcessedResult(
            id=output_id,
            file_name="edited.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    async def add_comment_to_pdf(
        self,
        file: Path,
        page: int,
        x: float,
        y: float,
        content: str,
        author: str = "PDFGlide",
    ) -> ProcessedResult:
        """Add comment/sticky note to PDF."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        await self.editor.add_comment(
            file, output_path, page, x, y, content, author
        )

        return ProcessedResult(
            id=output_id,
            file_name="commented.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )

    # ============== ADVANCED EDIT FEATURES ==============

    def find_text(
        self,
        file: Path,
        search_text: str,
        match_case: bool = False,
        page: Optional[int] = None,
    ) -> List[TextSearchResult]:
        """
        Find text occurrences in PDF.

        Args:
            file: Path to PDF file
            search_text: Text to search for
            match_case: Case-sensitive search
            page: Specific page (1-indexed), or all pages if None

        Returns:
            List of TextSearchResult with location info
        """
        return self.text_editor.find_text(file, search_text, match_case, page)

    async def replace_text(
        self,
        file: Path,
        replacements: List[TextReplacement],
    ) -> tuple[ProcessedResult, int]:
        """
        Replace text in PDF.

        Args:
            file: Path to PDF file
            replacements: List of text replacements

        Returns:
            Tuple of (ProcessedResult, replacement_count)
        """
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        count = self.text_editor.replace_text(file, output_path, replacements)

        return ProcessedResult(
            id=output_id,
            file_name="text_replaced.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        ), count

    def get_form_fields(self, file: Path) -> FormFieldsResponse:
        """
        Get all form fields from PDF.

        Args:
            file: Path to PDF file

        Returns:
            FormFieldsResponse with all form fields
        """
        return self.form_filler.get_form_fields(file)

    async def fill_form(
        self,
        file: Path,
        field_values: Dict[str, Any],
        flatten: bool = False,
    ) -> tuple[ProcessedResult, int]:
        """
        Fill form fields in PDF.

        Args:
            file: Path to PDF file
            field_values: Dictionary of field name to value
            flatten: Whether to flatten form after filling

        Returns:
            Tuple of (ProcessedResult, filled_count)
        """
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        filled_count = self.form_filler.fill_form(file, output_path, field_values, flatten)

        return ProcessedResult(
            id=output_id,
            file_name="form_filled.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        ), filled_count

    async def edit_combined(
        self,
        file: Path,
        operations: List[EditOperation],
        image_paths: Optional[List[Path]] = None,
    ) -> ProcessedResult:
        """
        Apply multiple edit operations to PDF in a single pass.

        Args:
            file: Path to PDF file
            operations: List of edit operations
            image_paths: List of image paths for image operations

        Returns:
            ProcessedResult with edited PDF
        """
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".pdf")

        # Open document once for all operations
        doc = fitz.open(file)

        try:
            for op in operations:
                if isinstance(op, TextOperation):
                    self.text_editor.add_text(
                        doc,
                        op.page,
                        op.text,
                        op.x,
                        op.y,
                        op.font_size,
                        op.font_name,
                        op.color,
                        op.opacity,
                    )

                elif isinstance(op, ImageOperation):
                    if image_paths and 0 <= op.image_index < len(image_paths):
                        self.text_editor.add_image(
                            doc,
                            op.page,
                            image_paths[op.image_index],
                            op.x,
                            op.y,
                            op.width,
                            op.height,
                            op.opacity,
                            op.rotation,
                        )

                elif isinstance(op, RectangleOperation):
                    self.text_editor.add_rectangle(
                        doc,
                        op.page,
                        op.x,
                        op.y,
                        op.width,
                        op.height,
                        op.stroke_color,
                        op.fill_color,
                        op.stroke_width,
                        op.opacity,
                    )

                elif isinstance(op, LineOperation):
                    self.text_editor.add_line(
                        doc,
                        op.page,
                        op.x1,
                        op.y1,
                        op.x2,
                        op.y2,
                        op.color,
                        op.width,
                        op.opacity,
                    )

                elif isinstance(op, HighlightOperation):
                    self.text_editor.add_highlight(
                        doc,
                        op.page,
                        op.x,
                        op.y,
                        op.width,
                        op.height,
                        op.color,
                        op.opacity,
                    )

                elif isinstance(op, CommentOperation):
                    self.text_editor.add_comment(
                        doc,
                        op.page,
                        op.x,
                        op.y,
                        op.content,
                        op.author,
                        op.icon,
                    )

                elif isinstance(op, RedactOperation):
                    self.text_editor.add_redact(
                        doc,
                        op.page,
                        op.x,
                        op.y,
                        op.width,
                        op.height,
                        op.fill_color,
                    )

            # Save the modified document
            doc.save(output_path, garbage=4, deflate=True)

        finally:
            doc.close()

        return ProcessedResult(
            id=output_id,
            file_name="edited.pdf",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="application/pdf",
        )
