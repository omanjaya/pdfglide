"""PDF Redactor processor."""

import asyncio
from pathlib import Path
from typing import List, Optional

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFRedactor(BaseProcessor):
    """Permanently remove sensitive content from PDF."""

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        search_terms: Optional[List[str]] = None,
        redact_areas: Optional[List[dict]] = None,
        redact_color: tuple = (0, 0, 0),
    ) -> Path:
        """
        Redact content from PDF.

        Supports two modes:
        1. Search and redact: Find text and redact all occurrences
        2. Area redact: Redact specific rectangular areas on pages

        Args:
            input_path: Path to the input PDF
            output_path: Path for the redacted PDF
            search_terms: List of text strings to find and redact
            redact_areas: List of dicts with {page, x0, y0, x1, y1} coordinates
            redact_color: RGB tuple for redaction color (default black)

        Returns:
            Path to the redacted PDF
        """
        if not search_terms and not redact_areas:
            raise ProcessingError(
                "Provide either search_terms or redact_areas for redaction"
            )

        def _redact():
            import fitz  # PyMuPDF

            doc = fitz.open(str(input_path))

            # Search and redact text
            if search_terms:
                for page in doc:
                    for term in search_terms:
                        # Find all instances of the term
                        text_instances = page.search_for(term)

                        for inst in text_instances:
                            # Add redaction annotation
                            page.add_redact_annot(inst, fill=redact_color)

                    # Apply redactions
                    page.apply_redactions()

            # Redact specific areas
            if redact_areas:
                for area in redact_areas:
                    page_num = area.get("page", 1) - 1  # Convert to 0-based
                    if page_num < 0 or page_num >= len(doc):
                        continue

                    page = doc[page_num]

                    # Create rectangle
                    rect = fitz.Rect(
                        area.get("x0", 0),
                        area.get("y0", 0),
                        area.get("x1", 100),
                        area.get("y1", 100),
                    )

                    # Add and apply redaction
                    page.add_redact_annot(rect, fill=redact_color)
                    page.apply_redactions()

            # Save redacted document
            doc.save(str(output_path), garbage=4, deflate=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_redact)
        except Exception as e:
            raise ProcessingError(f"Failed to redact PDF: {str(e)}")

    async def redact_by_pattern(
        self,
        input_path: Path,
        output_path: Path,
        patterns: List[str],
        redact_color: tuple = (0, 0, 0),
    ) -> Path:
        """
        Redact content matching regex patterns.

        Useful for redacting:
        - Email addresses: r'[\\w.-]+@[\\w.-]+\\.\\w+'
        - Phone numbers: r'\\d{3}[-.]?\\d{3}[-.]?\\d{4}'
        - SSN: r'\\d{3}-\\d{2}-\\d{4}'
        - Credit cards: r'\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}'

        Args:
            input_path: Path to the input PDF
            output_path: Path for the redacted PDF
            patterns: List of regex patterns to match and redact
            redact_color: RGB tuple for redaction color

        Returns:
            Path to the redacted PDF
        """
        import re

        def _redact_patterns():
            import fitz

            doc = fitz.open(str(input_path))

            for page in doc:
                # Get all text with position info
                text_dict = page.get_text("dict")

                for block in text_dict.get("blocks", []):
                    if block.get("type") != 0:  # Text block
                        continue

                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "")
                            bbox = span.get("bbox")

                            if not bbox:
                                continue

                            # Check each pattern
                            for pattern in patterns:
                                if re.search(pattern, text, re.IGNORECASE):
                                    rect = fitz.Rect(bbox)
                                    page.add_redact_annot(rect, fill=redact_color)

                # Apply all redactions for this page
                page.apply_redactions()

            doc.save(str(output_path), garbage=4, deflate=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_redact_patterns)
        except Exception as e:
            raise ProcessingError(f"Failed to redact by pattern: {str(e)}")
