"""PDF converter processor."""

import asyncio
from pathlib import Path

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFToImageConverter(BaseProcessor):
    """Convert PDF pages to images."""

    async def execute(
        self,
        file: Path,
        output_format: str = "jpg",
        dpi: int = 200,
    ) -> list[Path]:
        """
        Convert PDF to images.

        Args:
            file: Input PDF file path
            output_format: Output format (jpg, png)
            dpi: Resolution in dots per inch

        Returns:
            List of output image paths
        """
        output_dir = self.output_dir
        base_name = file.stem

        def _convert():
            from pdf2image import convert_from_path

            # Convert PDF to images
            images = convert_from_path(
                str(file),
                dpi=dpi,
                fmt=output_format,
            )

            output_files = []

            for i, image in enumerate(images):
                output_path = output_dir / f"{base_name}_page_{i + 1}.{output_format}"

                if output_format.lower() in ["jpg", "jpeg"]:
                    image.save(output_path, "JPEG", quality=90)
                else:
                    image.save(output_path, "PNG")

                output_files.append(output_path)

            return output_files

        try:
            return await asyncio.to_thread(_convert)
        except ImportError:
            raise ProcessingError("pdf2image package not installed")
        except Exception as e:
            raise ProcessingError(f"Failed to convert PDF to images: {str(e)}")


class ImageToPDFConverter(BaseProcessor):
    """Convert images to PDF."""

    async def execute(
        self,
        files: list[Path],
        output_path: Path,
    ) -> Path:
        """
        Convert images to PDF.

        Args:
            files: List of image file paths
            output_path: Output PDF file path

        Returns:
            Path to output PDF
        """

        def _convert():
            from PIL import Image

            # Get first image to determine page size
            images = []
            for file_path in files:
                img = Image.open(file_path)
                if img.mode == "RGBA":
                    # Convert RGBA to RGB
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")
                images.append(img)

            if not images:
                raise ProcessingError("No valid images provided")

            # Save as PDF
            images[0].save(
                output_path,
                "PDF",
                save_all=True,
                append_images=images[1:] if len(images) > 1 else [],
                resolution=100.0,
            )

            return output_path

        try:
            return await asyncio.to_thread(_convert)
        except Exception as e:
            raise ProcessingError(f"Failed to convert images to PDF: {str(e)}")
