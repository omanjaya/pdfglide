"""PDF converter processor."""

import asyncio
import io
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
            import fitz  # PyMuPDF

            fmt = output_format.lower().lstrip(".")
            is_jpeg = fmt in ("jpg", "jpeg")
            ext = fmt if is_jpeg else "png"
            render_dpi = max(36, min(int(dpi), 600))

            output_files = []
            doc = fitz.open(str(file))
            try:
                # One page at a time: memory stays flat for long documents, and the
                # page is encoded exactly once (no render->JPEG->decode->JPEG loop).
                for i, page in enumerate(doc):
                    # alpha=False flattens transparency onto white; RGB output
                    # (never CMYK/RGBA); page /Rotate is applied by PyMuPDF.
                    pix = page.get_pixmap(
                        dpi=render_dpi, colorspace=fitz.csRGB, alpha=False
                    )
                    output_path = output_dir / f"{base_name}_page_{i + 1}.{ext}"
                    if is_jpeg:
                        data = pix.tobytes("jpeg", jpg_quality=92)
                    else:
                        data = pix.tobytes("png")
                    output_path.write_bytes(data)
                    output_files.append(output_path)
            finally:
                doc.close()

            if not output_files:
                raise ProcessingError("No pages found in PDF")
            return output_files

        try:
            return await asyncio.to_thread(_convert)
        except ProcessingError:
            raise
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

        def _prepare(file_path: Path) -> tuple[bytes, float, float]:
            """Return (image bytes for embedding, width_pt, height_pt).

            JPEG/PNG files that need no correction are embedded byte-for-byte
            (no resampling, no re-compression). Everything else is normalised
            to 8-bit RGB/gray first.
            """
            from PIL import Image, ImageOps

            raw = file_path.read_bytes()
            with Image.open(io.BytesIO(raw)) as img:
                fmt = img.format
                orientation = img.getexif().get(274, 1)
                dpi_x = None
                try:
                    dpi_x = float(img.info.get("dpi", (None,))[0])
                except (TypeError, ValueError, IndexError):
                    pass
                mode = img.mode
                passthrough = (
                    orientation in (None, 0, 1)
                    and not getattr(img, "is_animated", False)
                    and (
                        (fmt == "JPEG" and mode in ("RGB", "L"))
                        or (fmt == "PNG" and mode in ("RGB", "RGBA", "L", "LA"))
                    )
                )
                if passthrough:
                    w_px, h_px = img.size
                    data = raw
                else:
                    img.load()
                    img = ImageOps.exif_transpose(img)  # apply EXIF rotation/mirror
                    if img.mode in ("I;16", "I;16L", "I;16B", "I"):
                        # 16-bit -> 8-bit by scaling (plain convert() clips to white)
                        img = img.point(lambda v: v / 256.0, "L")
                    elif img.mode == "F":
                        img = img.convert("L")
                    has_alpha = img.mode in ("RGBA", "LA") or (
                        img.mode == "P" and "transparency" in img.info
                    ) or (img.mode == "PA")
                    if img.mode == "CMYK":
                        img = img.convert("RGB")
                    elif has_alpha:
                        img = img.convert("RGBA")
                    elif img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")
                    buf = io.BytesIO()
                    if fmt == "JPEG" and not has_alpha:
                        img.save(buf, "JPEG", quality=95, subsampling=0)
                    else:
                        img.save(buf, "PNG")
                    data = buf.getvalue()
                    w_px, h_px = img.size

            # Page size: honour the image's DPI when it is sensible, else assume
            # 150 dpi; cap at A3 so huge photos do not give 30-inch pages.
            res = dpi_x if dpi_x and 72 <= dpi_x <= 1200 else 150.0
            w_pt, h_pt = w_px * 72.0 / res, h_px * 72.0 / res
            limit = 1191.0
            if max(w_pt, h_pt) > limit:
                k = limit / max(w_pt, h_pt)
                w_pt, h_pt = w_pt * k, h_pt * k
            return data, max(w_pt, 1.0), max(h_pt, 1.0)

        def _convert():
            import fitz  # PyMuPDF

            if not files:
                raise ProcessingError("No valid images provided")

            doc = fitz.open()
            try:
                for file_path in files:
                    data, w_pt, h_pt = _prepare(Path(file_path))
                    page = doc.new_page(width=w_pt, height=h_pt)
                    page.insert_image(page.rect, stream=data, keep_proportion=True)
                doc.save(str(output_path), garbage=3, deflate=True)
            finally:
                doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_convert)
        except Exception as e:
            raise ProcessingError(f"Failed to convert images to PDF: {str(e)}")
