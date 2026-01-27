"""Office document converter processor."""

import asyncio
import subprocess
import shutil
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class OfficeConverter(BaseProcessor):
    """Convert office documents using LibreOffice."""

    async def execute(self, file: Path, output_path: Path, conversion_type: str = "to_pdf") -> Path:
        """
        Execute document conversion.

        Args:
            file: Input file path
            output_path: Output file path
            conversion_type: Type of conversion ('to_pdf' or 'pdf_to_docx')

        Returns:
            Path to converted file
        """
        if conversion_type == "pdf_to_docx":
            return await self.pdf_to_docx(file, output_path)
        return await self.to_pdf(file, output_path)

    async def to_pdf(self, file: Path, output_path: Path) -> Path:
        """
        Convert document to PDF using LibreOffice.

        Args:
            file: Input document file path
            output_path: Output PDF file path

        Returns:
            Path to converted PDF
        """
        # Check if LibreOffice is available
        soffice_path = self._find_libreoffice()
        if not soffice_path:
            raise ProcessingError(
                "LibreOffice not found. Please install LibreOffice."
            )

        try:
            # Run LibreOffice in headless mode
            process = await asyncio.create_subprocess_exec(
                soffice_path,
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(self.output_dir),
                str(file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                raise ProcessingError(
                    f"LibreOffice conversion failed: {stderr.decode()}"
                )

            # LibreOffice outputs with same name but .pdf extension
            temp_output = self.output_dir / f"{file.stem}.pdf"

            if not temp_output.exists():
                raise ProcessingError("Conversion completed but output file not found")

            # Move to desired output path
            shutil.move(str(temp_output), str(output_path))

            return output_path

        except ProcessingError:
            raise
        except Exception as e:
            raise ProcessingError(f"Failed to convert document: {str(e)}")

    async def pdf_to_docx(self, file: Path, output_path: Path) -> Path:
        """
        Convert PDF to Word document.

        Args:
            file: Input PDF file path
            output_path: Output DOCX file path

        Returns:
            Path to converted DOCX
        """
        try:
            from pdf2docx import Converter

            # Run blocking conversion in thread pool
            def _convert():
                cv = Converter(str(file))
                cv.convert(str(output_path))
                cv.close()

            await asyncio.to_thread(_convert)

            return output_path

        except ImportError:
            raise ProcessingError("pdf2docx package not installed")
        except Exception as e:
            raise ProcessingError(f"Failed to convert PDF to Word: {str(e)}")

    def _find_libreoffice(self) -> str | None:
        """Find LibreOffice executable."""
        # Common paths for different OS
        possible_paths = [
            "soffice",  # Linux (in PATH)
            "/usr/bin/soffice",  # Linux
            "/usr/bin/libreoffice",  # Linux alternative
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",  # macOS
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe",  # Windows
            "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",  # Windows 32-bit
        ]

        for path in possible_paths:
            if shutil.which(path):
                return path

            # Check if path exists directly
            if Path(path).exists():
                return path

        return None
