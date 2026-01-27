"""
PDF Text Editor - Find and replace text in PDFs.
Uses PyMuPDF (fitz) for text search and redact+insert approach for replacement.
"""
import fitz  # PyMuPDF
from pathlib import Path
from typing import List, Optional, Tuple

from app.processors.base import BaseProcessor
from app.schemas.pdf_edit import TextSearchResult, TextReplacement


def hex_to_rgb(hex_color: str) -> Tuple[float, float, float]:
    """Convert hex color to RGB tuple (0-1 range)."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)


class PDFTextEditor(BaseProcessor):
    """Processor for finding and replacing text in PDFs."""

    async def execute(self, *args, **kwargs):
        """Generic execute method - delegates to specific methods."""
        raise NotImplementedError("Use find_text or replace_text methods directly")

    def find_text(
        self,
        input_path: Path,
        search_text: str,
        match_case: bool = False,
        page: Optional[int] = None,
    ) -> List[TextSearchResult]:
        """
        Find all occurrences of text in a PDF.

        Args:
            input_path: Path to input PDF
            search_text: Text to search for
            match_case: Whether to match case
            page: Specific page (1-indexed), or None for all pages

        Returns:
            List of TextSearchResult with location info
        """
        results = []
        doc = fitz.open(input_path)

        try:
            # Determine which pages to search
            if page is not None:
                # Validate page number
                if page < 1 or page > len(doc):
                    return results
                pages_to_search = [page - 1]  # Convert to 0-indexed
            else:
                pages_to_search = range(len(doc))

            for page_idx in pages_to_search:
                pdf_page = doc[page_idx]

                # Search for text - fitz uses case-insensitive by default
                flags = 0
                if not match_case:
                    flags = fitz.TEXT_PRESERVE_WHITESPACE

                # Get text instances
                text_instances = pdf_page.search_for(search_text)

                for rect in text_instances:
                    results.append(TextSearchResult(
                        page=page_idx + 1,  # Convert to 1-indexed
                        text=search_text,
                        x=rect.x0,
                        y=rect.y0,
                        width=rect.width,
                        height=rect.height,
                    ))
        finally:
            doc.close()

        return results

    def replace_text(
        self,
        input_path: Path,
        output_path: Path,
        replacements: List[TextReplacement],
    ) -> int:
        """
        Replace text in a PDF using redact+insert approach.

        This method:
        1. Finds all instances of search text
        2. Redacts (removes) the found text
        3. Inserts replacement text at the same location

        Note: This approach works best for simple text. Complex layouts
        or special fonts may not render perfectly.

        Args:
            input_path: Path to input PDF
            output_path: Path to save output PDF
            replacements: List of text replacements to perform

        Returns:
            Number of replacements made
        """
        doc = fitz.open(input_path)
        total_replacements = 0

        try:
            for replacement in replacements:
                search_text = replacement.search_text
                replace_text = replacement.replace_text

                # Determine which pages to process
                if replacement.page is not None:
                    if replacement.page < 1 or replacement.page > len(doc):
                        continue
                    pages_to_process = [replacement.page - 1]
                else:
                    pages_to_process = range(len(doc))

                for page_idx in pages_to_process:
                    page = doc[page_idx]

                    # Find all instances of the search text
                    text_instances = page.search_for(search_text)

                    if not text_instances:
                        continue

                    # Process each instance
                    for rect in text_instances:
                        # Add redact annotation
                        page.add_redact_annot(rect, fill=(1, 1, 1))  # White fill

                    # Apply all redactions on this page
                    page.apply_redactions()

                    # Now insert replacement text at each location
                    text_instances = page.search_for(search_text)
                    if not text_instances:
                        # Re-search after redaction - original positions
                        # We need to track positions before redaction
                        pass

                    total_replacements += len(text_instances)

            # Alternative approach: Direct text replacement with better handling
            doc.close()
            doc = fitz.open(input_path)
            total_replacements = 0

            for replacement in replacements:
                search_text = replacement.search_text
                replace_text = replacement.replace_text

                if replacement.page is not None:
                    if replacement.page < 1 or replacement.page > len(doc):
                        continue
                    pages_to_process = [replacement.page - 1]
                else:
                    pages_to_process = range(len(doc))

                for page_idx in pages_to_process:
                    page = doc[page_idx]

                    # Find and collect all instances first
                    text_instances = page.search_for(search_text)
                    positions = [(rect.x0, rect.y0, rect.width, rect.height) for rect in text_instances]

                    if not positions:
                        continue

                    # Redact all instances
                    for rect in text_instances:
                        page.add_redact_annot(rect, fill=(1, 1, 1))

                    page.apply_redactions()

                    # Insert replacement text at each position
                    for x, y, width, height in positions:
                        # Calculate font size based on original text height
                        font_size = max(8, min(height * 0.9, 72))

                        # Insert text
                        text_rect = fitz.Rect(x, y, x + width * 2, y + height)
                        page.insert_textbox(
                            text_rect,
                            replace_text,
                            fontsize=font_size,
                            fontname="helv",  # Helvetica
                            color=(0, 0, 0),
                            align=fitz.TEXT_ALIGN_LEFT,
                        )
                        total_replacements += 1

            # Save the modified document
            doc.save(output_path, garbage=4, deflate=True)

        finally:
            doc.close()

        return total_replacements

    def add_text(
        self,
        doc: fitz.Document,
        page_num: int,
        text: str,
        x: float,
        y: float,
        font_size: int = 12,
        font_name: str = "helv",
        color: str = "#000000",
        opacity: float = 1.0,
    ) -> None:
        """
        Add text to a specific page in the document.

        Args:
            doc: Open fitz.Document
            page_num: Page number (1-indexed)
            text: Text to add
            x: X coordinate
            y: Y coordinate
            font_size: Font size in points
            font_name: Font name (helv, tiro, cour, etc.)
            color: Hex color
            opacity: Opacity (0-1)
        """
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]
        rgb_color = hex_to_rgb(color)

        # Insert text
        point = fitz.Point(x, y)
        page.insert_text(
            point,
            text,
            fontsize=font_size,
            fontname=font_name,
            color=rgb_color,
        )

    def add_image(
        self,
        doc: fitz.Document,
        page_num: int,
        image_path: Path,
        x: float,
        y: float,
        width: Optional[float] = None,
        height: Optional[float] = None,
        opacity: float = 1.0,
        rotation: float = 0.0,
    ) -> None:
        """
        Add image to a specific page in the document.

        Args:
            doc: Open fitz.Document
            page_num: Page number (1-indexed)
            image_path: Path to image file
            x: X coordinate
            y: Y coordinate
            width: Width (auto if None)
            height: Height (auto if None)
            opacity: Opacity (0-1)
            rotation: Rotation in degrees
        """
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]

        # Read image
        img = fitz.Pixmap(str(image_path))

        # Calculate dimensions
        if width is None and height is None:
            width = img.width
            height = img.height
        elif width is None:
            width = (height / img.height) * img.width
        elif height is None:
            height = (width / img.width) * img.height

        # Create rectangle for image placement
        rect = fitz.Rect(x, y, x + width, y + height)

        # Insert image
        page.insert_image(
            rect,
            filename=str(image_path),
            rotate=int(rotation),
        )

    def add_rectangle(
        self,
        doc: fitz.Document,
        page_num: int,
        x: float,
        y: float,
        width: float,
        height: float,
        stroke_color: Optional[str] = "#000000",
        fill_color: Optional[str] = None,
        stroke_width: float = 1.0,
        opacity: float = 1.0,
    ) -> None:
        """Add rectangle to a specific page."""
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]
        rect = fitz.Rect(x, y, x + width, y + height)

        stroke = hex_to_rgb(stroke_color) if stroke_color else None
        fill = hex_to_rgb(fill_color) if fill_color else None

        shape = page.new_shape()
        shape.draw_rect(rect)
        shape.finish(
            color=stroke,
            fill=fill,
            width=stroke_width,
        )
        shape.commit()

    def add_line(
        self,
        doc: fitz.Document,
        page_num: int,
        x1: float,
        y1: float,
        x2: float,
        y2: float,
        color: str = "#000000",
        width: float = 1.0,
        opacity: float = 1.0,
    ) -> None:
        """Add line to a specific page."""
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]
        rgb_color = hex_to_rgb(color)

        shape = page.new_shape()
        shape.draw_line(fitz.Point(x1, y1), fitz.Point(x2, y2))
        shape.finish(
            color=rgb_color,
            width=width,
        )
        shape.commit()

    def add_highlight(
        self,
        doc: fitz.Document,
        page_num: int,
        x: float,
        y: float,
        width: float,
        height: float,
        color: str = "#FFFF00",
        opacity: float = 0.5,
    ) -> None:
        """Add highlight annotation to a specific page."""
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]
        rect = fitz.Rect(x, y, x + width, y + height)
        rgb_color = hex_to_rgb(color)

        # Add highlight annotation
        annot = page.add_highlight_annot(rect)
        annot.set_colors(stroke=rgb_color)
        annot.set_opacity(opacity)
        annot.update()

    def add_comment(
        self,
        doc: fitz.Document,
        page_num: int,
        x: float,
        y: float,
        content: str,
        author: Optional[str] = None,
        icon: str = "Note",
    ) -> None:
        """Add comment/note annotation to a specific page."""
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]
        point = fitz.Point(x, y)

        # Add text annotation (sticky note)
        annot = page.add_text_annot(point, content, icon=icon)
        if author:
            annot.set_info(title=author)
        annot.update()

    def add_redact(
        self,
        doc: fitz.Document,
        page_num: int,
        x: float,
        y: float,
        width: float,
        height: float,
        fill_color: str = "#000000",
    ) -> None:
        """Add redaction to a specific page."""
        if page_num < 1 or page_num > len(doc):
            raise ValueError(f"Invalid page number: {page_num}")

        page = doc[page_num - 1]
        rect = fitz.Rect(x, y, x + width, y + height)
        rgb_color = hex_to_rgb(fill_color)

        page.add_redact_annot(rect, fill=rgb_color)
        page.apply_redactions()
