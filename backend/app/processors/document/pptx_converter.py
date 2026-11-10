"""PowerPoint to PDF converter."""

from pathlib import Path

from app.processors.base import BaseProcessor
from app.processors.document.office_converter import libreoffice_to_pdf


class PowerPointToPDFConverter(BaseProcessor):
    """Convert PowerPoint presentations to PDF using LibreOffice."""

    async def execute(self, input_path: Path, output_path: Path) -> Path:
        """
        Convert PowerPoint to PDF.

        Uses LibreOffice in headless mode (private profile per call, timeout,
        slide-friendly export options; see ``libreoffice_to_pdf``).

        Args:
            input_path: Path to the PowerPoint file (.pptx, .ppt, .odp)
            output_path: Path for the output PDF

        Returns:
            Path to the generated PDF

        Raises:
            ProcessingError: if the conversion fails or times out.
        """
        return await libreoffice_to_pdf(input_path, output_path)
