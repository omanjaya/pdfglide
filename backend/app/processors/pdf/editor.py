"""PDF Editor processor."""

import asyncio
import io
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


@dataclass
class TextAnnotation:
    """Text to add to PDF."""
    text: str
    page: int  # 1-based
    x: float
    y: float
    font_size: int = 12
    font_name: str = "Helvetica"
    color: tuple = (0, 0, 0)  # RGB 0-1


@dataclass
class ImageAnnotation:
    """Image to add to PDF."""
    image_path: Path
    page: int  # 1-based
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None


@dataclass
class RectangleAnnotation:
    """Rectangle shape to add to PDF."""
    page: int  # 1-based
    x0: float
    y0: float
    x1: float
    y1: float
    fill_color: Optional[tuple] = None  # RGB 0-1
    stroke_color: tuple = (0, 0, 0)
    stroke_width: float = 1


@dataclass
class LineAnnotation:
    """Line to add to PDF."""
    page: int  # 1-based
    x0: float
    y0: float
    x1: float
    y1: float
    color: tuple = (0, 0, 0)
    width: float = 1


class PDFEditor(BaseProcessor):
    """Add text, images, and shapes to PDF."""

    async def execute(
        self,
        input_path: Path,
        output_path: Path,
        text_annotations: Optional[List[TextAnnotation]] = None,
        image_annotations: Optional[List[ImageAnnotation]] = None,
        rectangle_annotations: Optional[List[RectangleAnnotation]] = None,
        line_annotations: Optional[List[LineAnnotation]] = None,
    ) -> Path:
        """
        Edit PDF by adding annotations.

        Args:
            input_path: Path to the input PDF
            output_path: Path for the edited PDF
            text_annotations: List of text elements to add
            image_annotations: List of images to add
            rectangle_annotations: List of rectangles to add
            line_annotations: List of lines to add

        Returns:
            Path to the edited PDF
        """

        def _edit():
            import fitz

            doc = fitz.open(str(input_path))

            # Add text annotations
            if text_annotations:
                for ann in text_annotations:
                    if ann.page < 1 or ann.page > len(doc):
                        continue

                    page = doc[ann.page - 1]

                    # Create text insertion point
                    point = fitz.Point(ann.x, ann.y)

                    # Convert RGB (0-1) to fitz color
                    color = ann.color

                    # Insert text
                    page.insert_text(
                        point,
                        ann.text,
                        fontsize=ann.font_size,
                        fontname=ann.font_name,
                        color=color,
                    )

            # Add image annotations
            if image_annotations:
                for ann in image_annotations:
                    if ann.page < 1 or ann.page > len(doc):
                        continue

                    page = doc[ann.page - 1]

                    # Determine image rectangle
                    if ann.width and ann.height:
                        rect = fitz.Rect(
                            ann.x, ann.y,
                            ann.x + ann.width, ann.y + ann.height
                        )
                    else:
                        # Use original image size
                        rect = fitz.Rect(ann.x, ann.y, ann.x + 100, ann.y + 100)

                    # Insert image
                    page.insert_image(rect, filename=str(ann.image_path))

            # Add rectangle annotations
            if rectangle_annotations:
                for ann in rectangle_annotations:
                    if ann.page < 1 or ann.page > len(doc):
                        continue

                    page = doc[ann.page - 1]

                    rect = fitz.Rect(ann.x0, ann.y0, ann.x1, ann.y1)

                    # Draw rectangle
                    shape = page.new_shape()

                    if ann.fill_color:
                        shape.draw_rect(rect)
                        shape.finish(
                            color=ann.stroke_color,
                            fill=ann.fill_color,
                            width=ann.stroke_width,
                        )
                    else:
                        shape.draw_rect(rect)
                        shape.finish(
                            color=ann.stroke_color,
                            width=ann.stroke_width,
                        )

                    shape.commit()

            # Add line annotations
            if line_annotations:
                for ann in line_annotations:
                    if ann.page < 1 or ann.page > len(doc):
                        continue

                    page = doc[ann.page - 1]

                    # Draw line
                    shape = page.new_shape()
                    shape.draw_line(
                        fitz.Point(ann.x0, ann.y0),
                        fitz.Point(ann.x1, ann.y1),
                    )
                    shape.finish(
                        color=ann.color,
                        width=ann.width,
                    )
                    shape.commit()

            # Save edited document
            doc.save(str(output_path), garbage=4, deflate=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_edit)
        except Exception as e:
            raise ProcessingError(f"Failed to edit PDF: {str(e)}")

    async def add_text(
        self,
        input_path: Path,
        output_path: Path,
        text: str,
        page: int,
        x: float,
        y: float,
        font_size: int = 12,
        font_name: str = "Helvetica",
        color: tuple = (0, 0, 0),
    ) -> Path:
        """Convenience method to add single text."""
        annotation = TextAnnotation(
            text=text,
            page=page,
            x=x,
            y=y,
            font_size=font_size,
            font_name=font_name,
            color=color,
        )
        return await self.execute(
            input_path, output_path, text_annotations=[annotation]
        )

    async def add_image(
        self,
        input_path: Path,
        output_path: Path,
        image_path: Path,
        page: int,
        x: float,
        y: float,
        width: Optional[float] = None,
        height: Optional[float] = None,
    ) -> Path:
        """Convenience method to add single image."""
        annotation = ImageAnnotation(
            image_path=image_path,
            page=page,
            x=x,
            y=y,
            width=width,
            height=height,
        )
        return await self.execute(
            input_path, output_path, image_annotations=[annotation]
        )

    async def add_highlight(
        self,
        input_path: Path,
        output_path: Path,
        page: int,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        color: tuple = (1, 1, 0),  # Yellow
        opacity: float = 0.3,
    ) -> Path:
        """Add highlight annotation to text area."""

        def _highlight():
            import fitz

            doc = fitz.open(str(input_path))

            if page < 1 or page > len(doc):
                raise ProcessingError(f"Invalid page number: {page}")

            pg = doc[page - 1]

            # Create highlight annotation
            rect = fitz.Rect(x0, y0, x1, y1)
            annot = pg.add_highlight_annot(rect)

            # Set color and opacity
            annot.set_colors(stroke=color)
            annot.set_opacity(opacity)
            annot.update()

            doc.save(str(output_path), garbage=4, deflate=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_highlight)
        except Exception as e:
            raise ProcessingError(f"Failed to add highlight: {str(e)}")

    async def add_comment(
        self,
        input_path: Path,
        output_path: Path,
        page: int,
        x: float,
        y: float,
        content: str,
        author: str = "PDFGlide",
    ) -> Path:
        """Add sticky note comment to PDF."""

        def _add_comment():
            import fitz
            from datetime import datetime

            doc = fitz.open(str(input_path))

            if page < 1 or page > len(doc):
                raise ProcessingError(f"Invalid page number: {page}")

            pg = doc[page - 1]

            # Create text annotation (sticky note)
            point = fitz.Point(x, y)
            annot = pg.add_text_annot(point, content)

            # Set properties
            annot.set_info(
                title=author,
                content=content,
                creationDate=datetime.now().strftime("D:%Y%m%d%H%M%S"),
            )
            annot.update()

            doc.save(str(output_path), garbage=4, deflate=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_add_comment)
        except Exception as e:
            raise ProcessingError(f"Failed to add comment: {str(e)}")

    async def add_link(
        self,
        input_path: Path,
        output_path: Path,
        page: int,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        url: str,
    ) -> Path:
        """Add hyperlink to PDF."""

        def _add_link():
            import fitz

            doc = fitz.open(str(input_path))

            if page < 1 or page > len(doc):
                raise ProcessingError(f"Invalid page number: {page}")

            pg = doc[page - 1]

            # Create link
            rect = fitz.Rect(x0, y0, x1, y1)
            link = {
                "kind": fitz.LINK_URI,
                "from": rect,
                "uri": url,
            }
            pg.insert_link(link)

            doc.save(str(output_path), garbage=4, deflate=True)
            doc.close()

            return output_path

        try:
            return await asyncio.to_thread(_add_link)
        except Exception as e:
            raise ProcessingError(f"Failed to add link: {str(e)}")
