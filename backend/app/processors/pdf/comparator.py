"""PDF Comparator processor."""

import asyncio
from pathlib import Path
from typing import List, Dict, Any

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFComparator(BaseProcessor):
    """Compare two PDFs and highlight differences."""

    async def execute(
        self,
        pdf1_path: Path,
        pdf2_path: Path,
        output_path: Path,
        highlight_color: tuple = (1, 0, 0),  # Red
        output_mode: str = "visual",  # "visual" or "text"
    ) -> Path:
        """
        Compare two PDFs and create a diff output.

        Args:
            pdf1_path: Path to the first (original) PDF
            pdf2_path: Path to the second (modified) PDF
            output_path: Path for the comparison output
            highlight_color: RGB tuple for highlighting differences (0-1 range)
            output_mode: "visual" creates highlighted PDF, "text" creates text report

        Returns:
            Path to the comparison result
        """
        if output_mode == "visual":
            return await self._visual_compare(
                pdf1_path, pdf2_path, output_path, highlight_color
            )
        else:
            return await self._text_compare(pdf1_path, pdf2_path, output_path)

    async def _visual_compare(
        self,
        pdf1_path: Path,
        pdf2_path: Path,
        output_path: Path,
        highlight_color: tuple,
    ) -> Path:
        """Create visual comparison with highlighted differences."""

        def _compare():
            import fitz
            from PIL import Image, ImageChops, ImageDraw
            import io

            doc1 = fitz.open(str(pdf1_path))
            doc2 = fitz.open(str(pdf2_path))

            # Create new PDF for output
            output_doc = fitz.open()

            # Compare page by page
            max_pages = max(len(doc1), len(doc2))

            for page_num in range(max_pages):
                # Render pages as images
                dpi = 150
                mat = fitz.Matrix(dpi / 72, dpi / 72)

                if page_num < len(doc1):
                    pix1 = doc1[page_num].get_pixmap(matrix=mat)
                    img1 = Image.frombytes("RGB", [pix1.width, pix1.height], pix1.samples)
                else:
                    # Page doesn't exist in doc1, create blank
                    if page_num < len(doc2):
                        pix2 = doc2[page_num].get_pixmap(matrix=mat)
                        img1 = Image.new("RGB", (pix2.width, pix2.height), "white")
                    else:
                        continue

                if page_num < len(doc2):
                    pix2 = doc2[page_num].get_pixmap(matrix=mat)
                    img2 = Image.frombytes("RGB", [pix2.width, pix2.height], pix2.samples)
                else:
                    # Page doesn't exist in doc2
                    img2 = Image.new("RGB", img1.size, "white")

                # Ensure same size
                if img1.size != img2.size:
                    # Resize to larger dimensions
                    max_width = max(img1.width, img2.width)
                    max_height = max(img1.height, img2.height)

                    new_img1 = Image.new("RGB", (max_width, max_height), "white")
                    new_img1.paste(img1, (0, 0))
                    img1 = new_img1

                    new_img2 = Image.new("RGB", (max_width, max_height), "white")
                    new_img2.paste(img2, (0, 0))
                    img2 = new_img2

                # Find differences
                diff = ImageChops.difference(img1, img2)

                # Create output image (side by side with diff)
                total_width = img1.width * 3 + 40  # 3 images + spacing
                max_height = img1.height

                comparison = Image.new("RGB", (total_width, max_height + 50), "white")

                # Add labels
                draw = ImageDraw.Draw(comparison)

                # Paste images
                comparison.paste(img1, (0, 50))
                comparison.paste(img2, (img1.width + 20, 50))

                # Create diff overlay (highlight differences in red)
                diff_highlighted = img2.copy()
                diff_gray = diff.convert("L")

                # Threshold to find significant differences
                threshold = 30
                for x in range(diff_gray.width):
                    for y in range(diff_gray.height):
                        if diff_gray.getpixel((x, y)) > threshold:
                            # Mark as different
                            r, g, b = diff_highlighted.getpixel((x, y))
                            # Blend with highlight color
                            new_r = int(r * 0.5 + highlight_color[0] * 255 * 0.5)
                            new_g = int(g * 0.5 + highlight_color[1] * 255 * 0.5)
                            new_b = int(b * 0.5 + highlight_color[2] * 255 * 0.5)
                            diff_highlighted.putpixel((x, y), (new_r, new_g, new_b))

                comparison.paste(diff_highlighted, (img1.width * 2 + 40, 50))

                # Add labels
                draw.text((img1.width // 2 - 40, 10), "Original", fill="black")
                draw.text((img1.width + 20 + img1.width // 2 - 40, 10), "Modified", fill="black")
                draw.text((img1.width * 2 + 40 + img1.width // 2 - 60, 10), "Differences", fill="black")

                # Convert comparison image to PDF page
                img_bytes = io.BytesIO()
                comparison.save(img_bytes, format="PNG")
                img_bytes.seek(0)

                # Add page to output
                img_rect = fitz.Rect(0, 0, comparison.width * 72 / dpi, comparison.height * 72 / dpi)
                page = output_doc.new_page(width=img_rect.width, height=img_rect.height)
                page.insert_image(img_rect, stream=img_bytes.getvalue())

            doc1.close()
            doc2.close()

            # Save output
            output_doc.save(str(output_path))
            output_doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_compare)
        except Exception as e:
            raise ProcessingError(f"Failed to compare PDFs: {str(e)}")

    async def _text_compare(
        self,
        pdf1_path: Path,
        pdf2_path: Path,
        output_path: Path,
    ) -> Path:
        """Create text-based comparison report."""

        def _compare():
            import fitz
            import difflib

            doc1 = fitz.open(str(pdf1_path))
            doc2 = fitz.open(str(pdf2_path))

            report_lines = [
                "PDF Comparison Report",
                "=" * 50,
                f"File 1: {pdf1_path.name}",
                f"File 2: {pdf2_path.name}",
                f"Pages in File 1: {len(doc1)}",
                f"Pages in File 2: {len(doc2)}",
                "=" * 50,
                "",
            ]

            max_pages = max(len(doc1), len(doc2))

            for page_num in range(max_pages):
                report_lines.append(f"\n--- Page {page_num + 1} ---\n")

                text1 = doc1[page_num].get_text() if page_num < len(doc1) else ""
                text2 = doc2[page_num].get_text() if page_num < len(doc2) else ""

                if text1 == text2:
                    report_lines.append("No text differences found.")
                else:
                    # Generate diff
                    diff = difflib.unified_diff(
                        text1.splitlines(keepends=True),
                        text2.splitlines(keepends=True),
                        fromfile="Original",
                        tofile="Modified",
                        lineterm="",
                    )
                    diff_text = "".join(diff)

                    if diff_text:
                        report_lines.append(diff_text)
                    else:
                        report_lines.append("Layout changes detected (no text diff).")

            doc1.close()
            doc2.close()

            # Save report
            report_path = output_path.with_suffix(".txt")
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("\n".join(report_lines))

            return report_path

        try:
            return await asyncio.to_thread(_compare)
        except Exception as e:
            raise ProcessingError(f"Failed to create comparison report: {str(e)}")

    async def get_diff_summary(
        self,
        pdf1_path: Path,
        pdf2_path: Path,
    ) -> Dict[str, Any]:
        """
        Get a summary of differences between two PDFs.

        Returns:
            Dictionary with difference summary
        """

        def _summarize():
            import fitz

            doc1 = fitz.open(str(pdf1_path))
            doc2 = fitz.open(str(pdf2_path))

            summary = {
                "pages_diff": len(doc2) - len(doc1),
                "pages_with_changes": [],
                "text_changes_count": 0,
                "identical": True,
            }

            max_pages = max(len(doc1), len(doc2))

            for page_num in range(max_pages):
                text1 = doc1[page_num].get_text() if page_num < len(doc1) else ""
                text2 = doc2[page_num].get_text() if page_num < len(doc2) else ""

                if text1 != text2:
                    summary["pages_with_changes"].append(page_num + 1)
                    summary["identical"] = False

                    # Count word-level changes
                    words1 = set(text1.split())
                    words2 = set(text2.split())
                    added = len(words2 - words1)
                    removed = len(words1 - words2)
                    summary["text_changes_count"] += added + removed

            doc1.close()
            doc2.close()

            return summary

        try:
            return await asyncio.to_thread(_summarize)
        except Exception as e:
            raise ProcessingError(f"Failed to summarize differences: {str(e)}")
