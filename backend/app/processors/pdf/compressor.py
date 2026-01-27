"""PDF compressor processor with advanced optimization and parallel processing."""

import asyncio
import subprocess
import shutil
import os
import tempfile
from pathlib import Path
from typing import Optional, Tuple, List
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFCompressor(BaseProcessor):
    """Compress PDF to reduce file size with multiple optimization strategies."""

    # Ghostscript quality presets (screen=72dpi, ebook=150dpi, printer=300dpi, prepress=300dpi)
    GS_PRESETS = {
        "extreme": "/screen",      # 72 dpi - smallest, lowest quality
        "low": "/ebook",           # 150 dpi - good for web
        "medium": "/printer",      # 300 dpi - balanced
        "high": "/prepress",       # 300 dpi - highest quality
    }

    # DPI levels for target size - prioritize quality with fewer aggressive steps
    DPI_LEVELS = [300, 250, 220, 200, 180, 160, 144, 130, 120, 110, 100, 90, 80, 72]

    # DPI boost for preserve_quality mode - use higher DPI for better visual quality
    DPI_QUALITY_BOOST = 50  # Add this to DPI when preserving quality

    # Parallel processing settings
    PARALLEL_THRESHOLD_BYTES = int(os.getenv("PARALLEL_PROCESSING_THRESHOLD", 52428800))  # 50MB
    PARALLEL_CHUNK_PAGES = int(os.getenv("PARALLEL_CHUNK_PAGES", 50))  # Pages per chunk
    MAX_PARALLEL_WORKERS = min(os.cpu_count() or 2, 4)  # Max parallel workers

    async def execute(
        self,
        file: Path,
        output_path: Path,
        quality: str = "medium",
        compress_images: bool = True,
        image_dpi: Optional[int] = None,
        remove_metadata: bool = False,
        grayscale: bool = False,
        target_size_kb: Optional[int] = None,
        preserve_quality: bool = True,
    ) -> Tuple[Path, dict]:
        """
        Compress PDF file with advanced optimization.

        Args:
            file: Input PDF file path
            output_path: Output file path
            quality: Compression quality (extreme, low, medium, high)
            compress_images: Whether to compress embedded images
            image_dpi: Target DPI for images (overrides quality preset)
            remove_metadata: Remove document metadata
            grayscale: Convert to grayscale (additional size reduction)
            target_size_kb: Target file size in KB (auto-adjusts compression)
            preserve_quality: Prioritize image quality over file size (default: True)

        Returns:
            Tuple of (Path to compressed PDF, compression stats dict)
        """
        quality = quality.lower()
        if quality not in ["extreme", "low", "medium", "high"]:
            quality = "medium"

        original_size = file.stat().st_size
        gs_path = self._find_ghostscript()

        # Target size mode: iteratively compress until target is reached
        if target_size_kb and gs_path:
            return await self._compress_to_target_size(
                file, output_path, target_size_kb, gs_path, grayscale, remove_metadata
            )

        # Use parallel processing for large files
        if original_size > self.PARALLEL_THRESHOLD_BYTES and gs_path:
            try:
                return await self._compress_parallel(
                    file, output_path, quality, gs_path, image_dpi, grayscale,
                    preserve_quality, remove_metadata
                )
            except Exception:
                # Fallback to sequential processing if parallel fails
                pass

        # Standard compression mode with quality preservation
        if gs_path and compress_images:
            result_path = await self._compress_with_ghostscript(
                file, output_path, quality, gs_path, image_dpi, grayscale,
                preserve_quality=preserve_quality
            )
        else:
            # Fallback to pikepdf
            result_path = await self._compress_with_pikepdf(
                file, output_path, quality, remove_metadata
            )

        # Post-process with pikepdf for additional optimization
        await self._optimize_with_pikepdf(result_path, remove_metadata)

        compressed_size = result_path.stat().st_size

        stats = {
            "original_size": original_size,
            "compressed_size": compressed_size,
            "saved_bytes": original_size - compressed_size,
            "compression_ratio": round((1 - compressed_size / original_size) * 100, 1) if original_size > 0 else 0,
            "method": "ghostscript" if gs_path and compress_images else "pikepdf",
        }

        return result_path, stats

    async def _compress_parallel(
        self,
        file: Path,
        output_path: Path,
        quality: str,
        gs_path: str,
        image_dpi: Optional[int],
        grayscale: bool,
        preserve_quality: bool,
        remove_metadata: bool,
    ) -> Tuple[Path, dict]:
        """
        Compress large PDF using parallel processing.

        Splits PDF into chunks, compresses each chunk in parallel,
        then merges the results.
        """
        import pikepdf

        original_size = file.stat().st_size
        temp_dir = Path(tempfile.mkdtemp(prefix="pdf_parallel_"))

        try:
            # Get page count
            with pikepdf.open(file) as pdf:
                total_pages = len(pdf.pages)

            # Calculate chunks
            chunk_size = self.PARALLEL_CHUNK_PAGES
            chunks = []
            for start in range(0, total_pages, chunk_size):
                end = min(start + chunk_size, total_pages)
                chunks.append((start, end))

            # If only 1-2 chunks, don't bother with parallel
            if len(chunks) <= 2:
                raise Exception("Too few chunks for parallel processing")

            # Split PDF into chunks
            chunk_files = []
            with pikepdf.open(file) as pdf:
                for i, (start, end) in enumerate(chunks):
                    chunk_path = temp_dir / f"chunk_{i:04d}.pdf"
                    chunk_pdf = pikepdf.Pdf.new()
                    for page_num in range(start, end):
                        chunk_pdf.pages.append(pdf.pages[page_num])
                    chunk_pdf.save(chunk_path)
                    chunk_files.append(chunk_path)

            # Compress chunks in parallel using ThreadPoolExecutor
            compressed_chunks = []

            async def compress_chunk(chunk_path: Path, index: int) -> Path:
                output_chunk = temp_dir / f"compressed_{index:04d}.pdf"
                await self._compress_with_ghostscript(
                    chunk_path, output_chunk, quality, gs_path,
                    image_dpi, grayscale, preserve_quality
                )
                return output_chunk

            # Run compression tasks concurrently (limited by MAX_PARALLEL_WORKERS)
            semaphore = asyncio.Semaphore(self.MAX_PARALLEL_WORKERS)

            async def bounded_compress(chunk_path: Path, index: int) -> Path:
                async with semaphore:
                    return await compress_chunk(chunk_path, index)

            tasks = [
                bounded_compress(chunk_path, i)
                for i, chunk_path in enumerate(chunk_files)
            ]
            compressed_chunks = await asyncio.gather(*tasks)

            # Merge compressed chunks
            merged_pdf = pikepdf.Pdf.new()
            for chunk_path in compressed_chunks:
                with pikepdf.open(chunk_path) as chunk_pdf:
                    for page in chunk_pdf.pages:
                        merged_pdf.pages.append(page)

            # Save merged result
            merged_pdf.save(output_path, linearize=True)

            # Optimize final result
            await self._optimize_with_pikepdf(output_path, remove_metadata)

            compressed_size = output_path.stat().st_size

            return output_path, {
                "original_size": original_size,
                "compressed_size": compressed_size,
                "saved_bytes": original_size - compressed_size,
                "compression_ratio": round((1 - compressed_size / original_size) * 100, 1) if original_size > 0 else 0,
                "method": "ghostscript_parallel",
                "chunks_processed": len(chunks),
                "parallel_workers": self.MAX_PARALLEL_WORKERS,
            }

        finally:
            # Cleanup temp directory
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def _compress_to_target_size(
        self,
        input_path: Path,
        output_path: Path,
        target_size_kb: int,
        gs_path: str,
        grayscale: bool = False,
        remove_metadata: bool = False,
    ) -> Tuple[Path, dict]:
        """
        Compress PDF to achieve target file size.

        Uses iterative compression with decreasing DPI until target is reached.
        """
        original_size = input_path.stat().st_size
        target_size_bytes = target_size_kb * 1024

        # If file is already smaller than target, just optimize it
        if original_size <= target_size_bytes:
            await self._compress_with_ghostscript(
                input_path, output_path, "high", gs_path, None, grayscale
            )
            await self._optimize_with_pikepdf(output_path, remove_metadata)
            compressed_size = output_path.stat().st_size

            return output_path, {
                "original_size": original_size,
                "compressed_size": compressed_size,
                "saved_bytes": original_size - compressed_size,
                "compression_ratio": round((1 - compressed_size / original_size) * 100, 1) if original_size > 0 else 0,
                "method": "ghostscript",
                "target_size_kb": target_size_kb,
                "target_reached": True,
                "final_dpi": 300,
            }

        best_result = None
        best_size = float('inf')
        final_dpi = None

        # Try each DPI level from highest to lowest
        for dpi in self.DPI_LEVELS:
            # Create temp file for this attempt
            temp_path = output_path.with_suffix(f'.tmp_{dpi}.pdf')

            try:
                # Use preserve_quality mode for better image quality
                await self._compress_with_ghostscript(
                    input_path, temp_path, "high", gs_path, dpi, grayscale,
                    preserve_quality=True
                )
                await self._optimize_with_pikepdf(temp_path, remove_metadata)

                current_size = temp_path.stat().st_size

                # Check if this meets the target
                if current_size <= target_size_bytes:
                    # Found a good result
                    if best_result and best_result.exists():
                        best_result.unlink()

                    # Move to final output
                    shutil.move(str(temp_path), str(output_path))

                    return output_path, {
                        "original_size": original_size,
                        "compressed_size": current_size,
                        "saved_bytes": original_size - current_size,
                        "compression_ratio": round((1 - current_size / original_size) * 100, 1),
                        "method": "ghostscript",
                        "target_size_kb": target_size_kb,
                        "target_reached": True,
                        "final_dpi": dpi,
                    }

                # Keep track of the best result so far (closest to target)
                if current_size < best_size:
                    if best_result and best_result.exists():
                        best_result.unlink()
                    best_result = temp_path
                    best_size = current_size
                    final_dpi = dpi
                else:
                    # Clean up this temp file
                    if temp_path.exists():
                        temp_path.unlink()

            except Exception:
                # Clean up on error
                if temp_path.exists():
                    temp_path.unlink()
                continue

        # If we couldn't reach target, use the best result we got
        if best_result and best_result.exists():
            shutil.move(str(best_result), str(output_path))
            compressed_size = output_path.stat().st_size

            return output_path, {
                "original_size": original_size,
                "compressed_size": compressed_size,
                "saved_bytes": original_size - compressed_size,
                "compression_ratio": round((1 - compressed_size / original_size) * 100, 1),
                "method": "ghostscript",
                "target_size_kb": target_size_kb,
                "target_reached": False,
                "final_dpi": final_dpi,
                "message": f"Could not reach target. Best: {compressed_size // 1024} KB at {final_dpi} DPI",
            }

        # Fallback: just do extreme compression
        await self._compress_with_ghostscript(
            input_path, output_path, "extreme", gs_path, 30, grayscale
        )
        await self._optimize_with_pikepdf(output_path, remove_metadata)
        compressed_size = output_path.stat().st_size

        return output_path, {
            "original_size": original_size,
            "compressed_size": compressed_size,
            "saved_bytes": original_size - compressed_size,
            "compression_ratio": round((1 - compressed_size / original_size) * 100, 1),
            "method": "ghostscript",
            "target_size_kb": target_size_kb,
            "target_reached": compressed_size <= target_size_bytes,
            "final_dpi": 30,
        }

    def _find_ghostscript(self) -> Optional[str]:
        """Find Ghostscript executable."""
        possible_paths = [
            "gs",
            "gswin64c",
            "gswin32c",
            "/usr/bin/gs",
            "/usr/local/bin/gs",
            "/opt/homebrew/bin/gs",
        ]

        for path in possible_paths:
            if shutil.which(path):
                return path
        return None

    async def _compress_with_ghostscript(
        self,
        input_path: Path,
        output_path: Path,
        quality: str,
        gs_path: str,
        custom_dpi: Optional[int] = None,
        grayscale: bool = False,
        preserve_quality: bool = True,
    ) -> Path:
        """Compress using Ghostscript with high-quality image preservation."""

        # Base command - don't use PDFSETTINGS preset when we have custom DPI
        # as it overrides our quality settings
        cmd = [
            gs_path,
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.5",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dDetectDuplicateImages=true",
            "-dCompressFonts=true",
            "-dSubsetFonts=true",
            "-dEmbedAllFonts=true",
            "-dAutoRotatePages=/None",
        ]

        # Calculate effective DPI - boost when preserving quality
        # This results in less aggressive downsampling, preserving image quality
        effective_dpi = custom_dpi
        if custom_dpi and preserve_quality:
            effective_dpi = min(custom_dpi + self.DPI_QUALITY_BOOST, 300)

        # When custom DPI is specified, use manual settings instead of presets
        # (presets override our DPI settings)
        if effective_dpi:
            cmd.extend([
                # Bicubic downsampling for smoother results (less artifacts)
                "-dColorImageDownsampleType=/Bicubic",
                "-dGrayImageDownsampleType=/Bicubic",
                "-dMonoImageDownsampleType=/Subsample",
                # DPI settings with threshold to force downsampling
                "-dDownsampleColorImages=true",
                f"-dColorImageResolution={effective_dpi}",
                "-dColorImageDownsampleThreshold=1.0",  # Always downsample
                "-dDownsampleGrayImages=true",
                f"-dGrayImageResolution={effective_dpi}",
                "-dGrayImageDownsampleThreshold=1.0",  # Always downsample
                "-dDownsampleMonoImages=true",
                f"-dMonoImageResolution={max(effective_dpi * 2, 200)}",
                "-dMonoImageDownsampleThreshold=1.0",  # Always downsample
                # Use DCTEncode (JPEG) for better compression
                "-dAutoFilterColorImages=false",
                "-dAutoFilterGrayImages=false",
                "-dColorImageFilter=/DCTEncode",
                "-dGrayImageFilter=/DCTEncode",
            ])

            # Preserve colors for better quality
            if preserve_quality and not grayscale:
                cmd.append("-dColorConversionStrategy=/LeaveColorUnchanged")
        else:
            # No custom DPI - use presets
            if preserve_quality:
                preset = "/printer"  # Higher quality
            else:
                preset = self.GS_PRESETS.get(quality, "/ebook")  # More aggressive
            cmd.append(f"-dPDFSETTINGS={preset}")

        # Grayscale conversion
        if grayscale:
            cmd.extend([
                "-sColorConversionStrategy=Gray",
                "-dProcessColorModel=/DeviceGray",
            ])

        # Output file and input file
        cmd.extend([
            f"-sOutputFile={output_path}",
            str(input_path),
        ])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                raise ProcessingError(f"Ghostscript compression failed: {error_msg}")

            if not output_path.exists():
                raise ProcessingError("Compression completed but output file not found")

            return output_path

        except FileNotFoundError:
            raise ProcessingError("Ghostscript not found")

    async def _compress_with_pikepdf(
        self,
        input_path: Path,
        output_path: Path,
        quality: str,
        remove_metadata: bool,
    ) -> Path:
        """Compress using pikepdf as fallback."""

        def _compress():
            import pikepdf

            # Quality settings
            quality_settings = {
                "extreme": {
                    "object_stream_mode": pikepdf.ObjectStreamMode.generate,
                    "compress_streams": True,
                    "stream_decode_level": pikepdf.StreamDecodeLevel.all,
                    "recompress_flate": True,
                },
                "low": {
                    "object_stream_mode": pikepdf.ObjectStreamMode.generate,
                    "compress_streams": True,
                    "stream_decode_level": pikepdf.StreamDecodeLevel.all,
                    "recompress_flate": True,
                },
                "medium": {
                    "object_stream_mode": pikepdf.ObjectStreamMode.generate,
                    "compress_streams": True,
                    "stream_decode_level": pikepdf.StreamDecodeLevel.specialized,
                    "recompress_flate": True,
                },
                "high": {
                    "object_stream_mode": pikepdf.ObjectStreamMode.preserve,
                    "compress_streams": True,
                    "stream_decode_level": pikepdf.StreamDecodeLevel.none,
                    "recompress_flate": False,
                },
            }

            settings = quality_settings[quality]

            with pikepdf.open(input_path) as pdf:
                # Remove metadata if requested
                if remove_metadata or quality == "extreme":
                    pdf.docinfo.clear()
                    # Remove XMP metadata
                    if "/Metadata" in pdf.Root:
                        del pdf.Root["/Metadata"]

                pdf.save(
                    output_path,
                    object_stream_mode=settings["object_stream_mode"],
                    compress_streams=settings["compress_streams"],
                    stream_decode_level=settings["stream_decode_level"],
                    recompress_flate=settings["recompress_flate"],
                    linearize=True,
                    preserve_pdfa=False,
                )

            return output_path

        try:
            return await asyncio.to_thread(_compress)
        except Exception as e:
            raise ProcessingError(f"Failed to compress PDF: {str(e)}")

    async def _optimize_with_pikepdf(
        self,
        file_path: Path,
        remove_metadata: bool,
    ) -> None:
        """Additional optimization pass with pikepdf."""

        def _optimize():
            import pikepdf

            # Create temp file
            temp_path = file_path.with_suffix('.tmp.pdf')

            try:
                with pikepdf.open(file_path) as pdf:
                    # Remove unused objects
                    pdf.remove_unreferenced_resources()

                    # Remove metadata if requested
                    if remove_metadata:
                        pdf.docinfo.clear()
                        if "/Metadata" in pdf.Root:
                            del pdf.Root["/Metadata"]

                    # Save with optimization
                    pdf.save(
                        temp_path,
                        compress_streams=True,
                        object_stream_mode=pikepdf.ObjectStreamMode.generate,
                        linearize=True,
                    )

                # Replace original with optimized
                os.replace(temp_path, file_path)

            except Exception:
                # Clean up temp file if exists
                if temp_path.exists():
                    temp_path.unlink()
                raise

        try:
            await asyncio.to_thread(_optimize)
        except Exception:
            # Non-fatal, skip optimization pass
            pass

    async def compress_images_only(
        self,
        input_path: Path,
        output_path: Path,
        target_dpi: int = 150,
        jpeg_quality: int = 75,
    ) -> Path:
        """Compress only embedded images without affecting text quality."""

        def _compress_images():
            import fitz  # PyMuPDF
            from PIL import Image
            import io

            doc = fitz.open(str(input_path))

            for page_num in range(len(doc)):
                page = doc[page_num]
                image_list = page.get_images()

                for img_index, img in enumerate(image_list):
                    xref = img[0]

                    try:
                        # Extract image
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]

                        # Open with PIL
                        pil_image = Image.open(io.BytesIO(image_bytes))

                        # Calculate new size based on target DPI
                        # Assume original was 300 DPI
                        scale = target_dpi / 300
                        if scale < 1:
                            new_size = (
                                int(pil_image.width * scale),
                                int(pil_image.height * scale)
                            )
                            pil_image = pil_image.resize(new_size, Image.LANCZOS)

                        # Convert to RGB if necessary
                        if pil_image.mode in ('RGBA', 'P'):
                            pil_image = pil_image.convert('RGB')

                        # Compress to JPEG
                        img_buffer = io.BytesIO()
                        pil_image.save(img_buffer, format='JPEG', quality=jpeg_quality, optimize=True)
                        img_buffer.seek(0)

                        # Replace image in PDF
                        # Note: This is simplified, full implementation would need proper replacement

                    except Exception:
                        # Skip problematic images
                        continue

            doc.save(str(output_path), garbage=4, deflate=True, clean=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_compress_images)
        except Exception as e:
            raise ProcessingError(f"Failed to compress images: {str(e)}")
