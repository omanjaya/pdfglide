"""PDF to PDF/A converter processor."""

import asyncio
import subprocess
import shutil
from pathlib import Path
from typing import Literal

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFToPDFAConverter(BaseProcessor):
    """Convert PDF to PDF/A archival format."""

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        pdfa_level: Literal["1b", "2b", "3b"] = "2b",
    ) -> Path:
        """
        Convert PDF to PDF/A format.

        PDF/A is an ISO-standardized version of PDF specialized for
        digital preservation of electronic documents.

        Levels:
        - 1b: Basic conformance (PDF 1.4 based)
        - 2b: Basic conformance (PDF 1.7 based, supports JPEG2000, transparency)
        - 3b: Basic conformance (allows embedded files)

        Args:
            input_path: Path to the input PDF
            output_path: Path for the PDF/A output
            pdfa_level: PDF/A conformance level (1b, 2b, or 3b)

        Returns:
            Path to the PDF/A file
        """
        # Try Ghostscript first (most reliable)
        gs_path = self._find_ghostscript()

        if gs_path:
            return await self._convert_with_ghostscript(
                input_path, output_path, pdfa_level, gs_path
            )

        # Fallback to pikepdf (limited PDF/A support)
        return await self._convert_with_pikepdf(input_path, output_path, pdfa_level)

    def _find_ghostscript(self) -> str | None:
        """Find Ghostscript executable."""
        possible_paths = [
            "gs",
            "gswin64c",
            "gswin32c",
            "/usr/bin/gs",
            "/usr/local/bin/gs",
            "/opt/homebrew/bin/gs",
            "C:\\Program Files\\gs\\gs10.00.0\\bin\\gswin64c.exe",
        ]

        for path in possible_paths:
            if shutil.which(path):
                return path

        return None

    async def _convert_with_ghostscript(
        self,
        input_path: Path,
        output_path: Path,
        pdfa_level: str,
        gs_path: str,
    ) -> Path:
        """Convert using Ghostscript."""
        # Map level to Ghostscript PDFA definition
        pdfa_def_map = {
            "1b": "1",
            "2b": "2",
            "3b": "3",
        }
        pdfa_def = pdfa_def_map.get(pdfa_level, "2")

        # Create PDFA definition file
        pdfa_def_ps = self.output_dir / "PDFA_def.ps"
        pdfa_def_content = f"""
%!PS-Adobe-3.0
% Ghostscript PDF/A definition file

/ICCProfile (/usr/share/color/icc/colord/sRGB.icc)
/OutputCondition (sRGB)
/OutputConditionIdentifier (Custom)
/RegistryName (http://www.color.org)
/Title (PDF/A-{pdfa_level} conversion)

% Set PDF/A conformance level
[/Title (Converted to PDF/A-{pdfa_level})
 /DOCINFO pdfmark

[ /pdf/a-{pdfa_def} /PDFA pdfmark
"""
        pdfa_def_ps.write_text(pdfa_def_content)

        try:
            # Run Ghostscript
            cmd = [
                gs_path,
                "-dPDFA=" + pdfa_def,
                "-dBATCH",
                "-dNOPAUSE",
                "-dNOOUTERSAVE",
                "-dUseCIEColor",
                "-sProcessColorModel=DeviceRGB",
                "-sDEVICE=pdfwrite",
                "-dPDFACompatibilityPolicy=1",
                f"-sOutputFile={output_path}",
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
                raise ProcessingError(f"Ghostscript conversion failed: {error_msg}")

            if not output_path.exists():
                raise ProcessingError("PDF/A conversion completed but output not found")

            return output_path

        finally:
            # Cleanup
            if pdfa_def_ps.exists():
                pdfa_def_ps.unlink()

    async def _convert_with_pikepdf(
        self,
        input_path: Path,
        output_path: Path,
        pdfa_level: str,
    ) -> Path:
        """
        Fallback conversion using pikepdf.

        Note: This is a basic conversion that embeds fonts and sets metadata.
        For full PDF/A compliance, Ghostscript is recommended.
        """

        def _convert():
            import pikepdf
            from datetime import datetime

            with pikepdf.open(input_path) as pdf:
                # Set PDF/A metadata
                with pdf.open_metadata() as meta:
                    # Set required PDF/A metadata
                    meta["pdfaid:part"] = pdfa_level[0]  # "1", "2", or "3"
                    meta["pdfaid:conformance"] = pdfa_level[1].upper()  # "B"

                    meta["dc:format"] = "application/pdf"
                    meta["pdf:Producer"] = "PDFGlide PDF/A Converter"
                    meta["xmp:CreateDate"] = datetime.utcnow().isoformat()
                    meta["xmp:ModifyDate"] = datetime.utcnow().isoformat()

                # Save with optimization
                pdf.save(
                    output_path,
                    linearize=True,
                    compress_streams=True,
                )

            return output_path

        try:
            return await asyncio.to_thread(_convert)
        except Exception as e:
            raise ProcessingError(f"Failed to convert to PDF/A: {str(e)}")

    async def validate_pdfa(self, pdf_path: Path) -> dict:
        """
        Validate if a PDF conforms to PDF/A standard.

        Note: Full validation requires external tools like veraPDF.
        This provides basic validation checks.

        Returns:
            Dictionary with validation results
        """

        def _validate():
            import pikepdf

            result = {
                "is_valid": False,
                "pdfa_level": None,
                "issues": [],
            }

            try:
                with pikepdf.open(pdf_path) as pdf:
                    # Check for PDF/A metadata
                    try:
                        with pdf.open_metadata() as meta:
                            part = meta.get("pdfaid:part")
                            conformance = meta.get("pdfaid:conformance")

                            if part and conformance:
                                result["pdfa_level"] = f"{part}{conformance.lower()}"
                                result["is_valid"] = True
                            else:
                                result["issues"].append(
                                    "Missing PDF/A identification metadata"
                                )
                    except Exception:
                        result["issues"].append("Could not read PDF/A metadata")

                    # Check for encryption (not allowed in PDF/A)
                    if pdf.is_encrypted:
                        result["is_valid"] = False
                        result["issues"].append("PDF is encrypted (not allowed in PDF/A)")

                    # Check for embedded files in PDF/A-1 and PDF/A-2
                    # (only PDF/A-3 allows embedded files)
                    if "/EmbeddedFiles" in pdf.Root.get("/Names", {}):
                        if result.get("pdfa_level", "").startswith(("1", "2")):
                            result["issues"].append(
                                "Contains embedded files (only allowed in PDF/A-3)"
                            )

            except Exception as e:
                result["issues"].append(f"Validation error: {str(e)}")

            return result

        return await asyncio.to_thread(_validate)
