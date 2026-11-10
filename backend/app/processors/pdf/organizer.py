"""PDF organizer processor."""

import asyncio
from pathlib import Path
from typing import List

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError
from app.processors.pdf import page_assembly as pa


class PDFOrganizer(BaseProcessor):
    """Organize PDF pages (reorder, delete, duplicate)."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        page_order: List[int],
    ) -> Path:
        """
        Reorganize PDF pages.

        Args:
            file: Input PDF file path
            output_path: Output file path
            page_order: New page order (1-based indices, can repeat or skip)

        Returns:
            Path to reorganized PDF
        """

        def _organize():
            import pikepdf

            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)

                # Validate page numbers
                for page_num in page_order:
                    if page_num < 1 or page_num > total_pages:
                        raise ProcessingError(
                            f"Invalid page number: {page_num}. PDF has {total_pages} pages."
                        )

                # Create new PDF with reordered pages
                new_pdf = pikepdf.Pdf.new()

                mapping = {}
                for page_num in page_order:
                    src_page = pdf.pages[page_num - 1]
                    # Bookmarks point at the first copy of a repeated page
                    mapping.setdefault(src_page.objgen, len(new_pdf.pages))
                    new_pdf.pages.append(src_page)

                pa.drop_dangling_links(new_pdf)
                pa.copy_metadata(pdf, new_pdf)
                pa.copy_acroform(pdf, new_pdf)
                pa.copy_outlines([(pdf, mapping)], new_pdf)
                pa.save_lean(new_pdf, output_path)

            return output_path

        try:
            return await asyncio.to_thread(_organize)
        except ProcessingError:
            raise
        except Exception as e:
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to organize PDF: {str(e)}")
            raise ProcessingError(f"Unexpected error: {str(e)}")

    async def delete_pages(
        self,
        file: Path,
        output_path: Path,
        pages_to_delete: List[int],
    ) -> Path:
        """
        Delete pages from PDF.

        Args:
            file: Input PDF file path
            output_path: Output file path
            pages_to_delete: Page numbers to delete (1-based)

        Returns:
            Path to PDF with pages deleted
        """
        try:
            import pikepdf

            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)

                # Get pages to keep
                pages_to_keep = [
                    i for i in range(1, total_pages + 1)
                    if i not in pages_to_delete
                ]

                if not pages_to_keep:
                    raise ProcessingError("Cannot delete all pages")

                return await self.execute(file, output_path, pages_to_keep)

        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(f"Failed to delete pages: {str(e)}")

    async def extract_pages(
        self,
        file: Path,
        output_path: Path,
        pages_to_extract: List[int],
    ) -> Path:
        """
        Extract specific pages from PDF.

        Args:
            file: Input PDF file path
            output_path: Output file path
            pages_to_extract: Page numbers to extract (1-based)

        Returns:
            Path to PDF with extracted pages
        """
        return await self.execute(file, output_path, pages_to_extract)
