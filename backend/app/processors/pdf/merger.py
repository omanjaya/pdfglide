"""PDF merger processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.pdf import page_assembly as pa


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

            first_src = None
            for file_path in files:
                # Open each PDF and append all pages
                with pikepdf.open(file_path) as pdf:
                    offset = len(output_pdf.pages)
                    mapping = {
                        p.objgen: offset + i for i, p in enumerate(pdf.pages)
                    }
                    output_pdf.pages.extend(pdf.pages)
                    pa.copy_acroform(pdf, output_pdf)
                    pa.copy_outlines([(pdf, mapping)], output_pdf)
                    if first_src is None:
                        # Document info/XMP of the first file describes the result
                        pa.copy_metadata(pdf, output_pdf)
                        first_src = True

            pa.drop_dangling_links(output_pdf)
            # Save merged PDF
            pa.save_lean(output_pdf, output_path)

            return output_path

        try:
            return await asyncio.to_thread(_merge)
        except Exception as e:
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to merge PDFs: {str(e)}")
            raise ProcessingError(f"Unexpected error during merge: {str(e)}")
