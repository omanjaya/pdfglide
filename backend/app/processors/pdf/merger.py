"""PDF merger processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFMerger(BaseProcessor):
    """Merge multiple PDF files into one."""

    async def execute(self, files: list[Path], output_path: Path) -> Path:
        """
        Merge PDF files.

        Args:
            files: List of PDF file paths to merge
            output_path: Output file path

        Returns:
            Path to merged PDF
        """
        if len(files) < 2:
            raise ProcessingError("At least 2 PDF files are required for merging")

        def _merge():
            import pikepdf

            # Create output PDF
            output_pdf = pikepdf.Pdf.new()

            for file_path in files:
                # Open each PDF and append all pages
                with pikepdf.open(file_path) as pdf:
                    output_pdf.pages.extend(pdf.pages)

            # Save merged PDF
            output_pdf.save(output_path)

            return output_path

        try:
            return await asyncio.to_thread(_merge)
        except Exception as e:
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to merge PDFs: {str(e)}")
            raise ProcessingError(f"Unexpected error during merge: {str(e)}")
