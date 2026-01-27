"""PDF Metadata processor."""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.processors.base import BaseProcessor


class PDFMetadataEditor(BaseProcessor):
    """Edit PDF metadata (title, author, subject, keywords)."""

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        title: Optional[str] = None,
        author: Optional[str] = None,
        subject: Optional[str] = None,
        keywords: Optional[str] = None,
        creator: Optional[str] = None,
    ) -> Path:
        """
        Edit PDF metadata.

        Args:
            input_path: Path to the input PDF
            output_path: Path for the output PDF
            title: Document title
            author: Document author
            subject: Document subject
            keywords: Document keywords (comma-separated)
            creator: Creator application name

        Returns:
            Path to the PDF with updated metadata
        """

        def _edit_metadata():
            import pikepdf

            with pikepdf.open(input_path, allow_overwriting_input=False) as pdf:
                with pdf.open_metadata() as meta:
                    # Update only provided fields
                    if title is not None:
                        meta["dc:title"] = title

                    if author is not None:
                        meta["dc:creator"] = [author]

                    if subject is not None:
                        meta["dc:description"] = subject

                    if keywords is not None:
                        meta["pdf:Keywords"] = keywords

                    if creator is not None:
                        meta["xmp:CreatorTool"] = creator

                    # Update modification date
                    meta["xmp:ModifyDate"] = datetime.utcnow().isoformat()

                pdf.save(output_path)

            return output_path

        return await asyncio.to_thread(_edit_metadata)

    async def read_metadata(self, input_path: Path) -> dict:
        """
        Read PDF metadata.

        Args:
            input_path: Path to the PDF

        Returns:
            Dictionary with metadata fields
        """

        def _read():
            import pikepdf

            with pikepdf.open(input_path) as pdf:
                with pdf.open_metadata() as meta:
                    return {
                        "title": meta.get("dc:title", ""),
                        "author": meta.get("dc:creator", [""]),
                        "subject": meta.get("dc:description", ""),
                        "keywords": meta.get("pdf:Keywords", ""),
                        "creator": meta.get("xmp:CreatorTool", ""),
                        "created": meta.get("xmp:CreateDate", ""),
                        "modified": meta.get("xmp:ModifyDate", ""),
                    }

        return await asyncio.to_thread(_read)
