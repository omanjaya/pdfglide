"""PowerPoint to PDF converter."""

import asyncio
import subprocess
import shutil
from pathlib import Path

from app.processors.base import BaseProcessor


class PowerPointToPDFConverter(BaseProcessor):
    """Convert PowerPoint presentations to PDF using LibreOffice."""

    async def execute(self, input_path: Path, output_path: Path) -> Path:
        """
        Convert PowerPoint to PDF.

        Uses LibreOffice in headless mode for conversion.

        Args:
            input_path: Path to the PowerPoint file (.pptx, .ppt, .odp)
            output_path: Path for the output PDF

        Returns:
            Path to the generated PDF
        """
        # Find LibreOffice executable
        libreoffice_paths = [
            "/usr/bin/libreoffice",
            "/usr/bin/soffice",
            "/Applications/LibreOffice.app/Contents/MacOS/soffice",
            "libreoffice",
            "soffice",
        ]

        libreoffice = None
        for path in libreoffice_paths:
            if shutil.which(path):
                libreoffice = path
                break

        if not libreoffice:
            raise RuntimeError(
                "LibreOffice not found. Please install LibreOffice for PPTX conversion."
            )

        # Create temp output directory
        temp_dir = output_path.parent / "temp_pptx"
        temp_dir.mkdir(exist_ok=True)

        try:
            # Run LibreOffice conversion
            cmd = [
                libreoffice,
                "--headless",
                "--convert-to", "pdf",
                "--outdir", str(temp_dir),
                str(input_path),
            ]

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise RuntimeError(f"LibreOffice conversion failed: {error_msg}")

            # Find the generated PDF
            pdf_name = input_path.stem + ".pdf"
            temp_pdf = temp_dir / pdf_name

            if not temp_pdf.exists():
                raise RuntimeError("PDF was not generated")

            # Move to final location
            shutil.move(str(temp_pdf), str(output_path))

            return output_path

        finally:
            # Cleanup temp directory
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
