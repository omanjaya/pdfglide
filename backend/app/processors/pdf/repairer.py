"""PDF Repair processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor


class PDFRepairer(BaseProcessor):
    """Repair corrupted or damaged PDFs."""

    async def execute(self, input_path: Path, output_path: Path) -> Path:
        """
        Repair a PDF file.

        Uses pikepdf's built-in repair capabilities to fix common PDF issues:
        - Broken cross-reference tables
        - Missing object references
        - Corrupted streams
        - Invalid syntax

        Args:
            input_path: Path to the input PDF
            output_path: Path for the repaired PDF

        Returns:
            Path to the repaired PDF
        """

        def _repair():
            import pikepdf

            # pikepdf automatically attempts to repair PDFs when opening
            with pikepdf.open(
                input_path,
                allow_overwriting_input=False,
            ) as pdf:
                # Save with linearization for better web viewing
                pdf.save(
                    output_path,
                    linearize=True,
                    normalize_content=True,
                    fix_metadata_version=True,
                )

            return output_path

        return await asyncio.to_thread(_repair)
