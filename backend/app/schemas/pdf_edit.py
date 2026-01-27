"""
Schemas for PDF editing operations.
"""
from enum import Enum
from typing import List, Optional, Union, Literal
from pydantic import BaseModel, Field


class TextSearchResult(BaseModel):
    """Result from text search in PDF."""
    page: int = Field(..., description="Page number (1-indexed)")
    text: str = Field(..., description="Found text")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    width: float = Field(..., description="Bounding box width")
    height: float = Field(..., description="Bounding box height")


class TextReplacement(BaseModel):
    """Single text replacement operation."""
    search_text: str = Field(..., description="Text to search for")
    replace_text: str = Field(..., description="Text to replace with")
    match_case: bool = Field(default=True, description="Case-sensitive matching")
    page: Optional[int] = Field(default=None, description="Specific page (1-indexed), or all pages if None")


class FormFieldType(str, Enum):
    """Types of form fields."""
    TEXT = "text"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    DROPDOWN = "dropdown"
    LISTBOX = "listbox"
    BUTTON = "button"
    SIGNATURE = "signature"
    UNKNOWN = "unknown"


class FormField(BaseModel):
    """Form field metadata."""
    name: str = Field(..., description="Field name")
    field_type: FormFieldType = Field(..., description="Type of form field")
    value: Optional[str] = Field(default=None, description="Current value")
    default_value: Optional[str] = Field(default=None, description="Default value")
    options: Optional[List[str]] = Field(default=None, description="Options for dropdown/radio")
    required: bool = Field(default=False, description="Whether field is required")
    read_only: bool = Field(default=False, description="Whether field is read-only")
    page: int = Field(..., description="Page number (1-indexed)")
    rect: Optional[List[float]] = Field(default=None, description="Field rectangle [x1, y1, x2, y2]")


class FormFieldsResponse(BaseModel):
    """Response containing form fields."""
    fields: List[FormField] = Field(default_factory=list)
    field_count: int = Field(default=0)
    has_form: bool = Field(default=False)


# Edit operation types
class TextOperation(BaseModel):
    """Add text to PDF."""
    type: Literal["text"] = "text"
    text: str = Field(..., description="Text to add")
    page: int = Field(..., description="Page number (1-indexed)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    font_size: int = Field(default=12, ge=6, le=144)
    font_name: str = Field(default="helv", description="Font name (helv, tiro, cour, etc.)")
    color: str = Field(default="#000000", description="Text color in hex")
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)


class ImageOperation(BaseModel):
    """Add image to PDF."""
    type: Literal["image"] = "image"
    image_index: int = Field(..., description="Index of uploaded image (0-indexed)")
    page: int = Field(..., description="Page number (1-indexed)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    width: Optional[float] = Field(default=None, description="Width (auto if None)")
    height: Optional[float] = Field(default=None, description="Height (auto if None)")
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)
    rotation: float = Field(default=0.0, description="Rotation in degrees")


class RectangleOperation(BaseModel):
    """Add rectangle to PDF."""
    type: Literal["rectangle"] = "rectangle"
    page: int = Field(..., description="Page number (1-indexed)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    width: float = Field(..., description="Rectangle width")
    height: float = Field(..., description="Rectangle height")
    stroke_color: Optional[str] = Field(default="#000000", description="Stroke color in hex")
    fill_color: Optional[str] = Field(default=None, description="Fill color in hex (None for no fill)")
    stroke_width: float = Field(default=1.0, ge=0.0)
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)


class LineOperation(BaseModel):
    """Add line to PDF."""
    type: Literal["line"] = "line"
    page: int = Field(..., description="Page number (1-indexed)")
    x1: float = Field(..., description="Start X coordinate")
    y1: float = Field(..., description="Start Y coordinate")
    x2: float = Field(..., description="End X coordinate")
    y2: float = Field(..., description="End Y coordinate")
    color: str = Field(default="#000000", description="Line color in hex")
    width: float = Field(default=1.0, ge=0.1)
    opacity: float = Field(default=1.0, ge=0.0, le=1.0)


class HighlightOperation(BaseModel):
    """Add highlight annotation to PDF."""
    type: Literal["highlight"] = "highlight"
    page: int = Field(..., description="Page number (1-indexed)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    width: float = Field(..., description="Highlight width")
    height: float = Field(..., description="Highlight height")
    color: str = Field(default="#FFFF00", description="Highlight color in hex")
    opacity: float = Field(default=0.5, ge=0.0, le=1.0)


class CommentOperation(BaseModel):
    """Add comment/note annotation to PDF."""
    type: Literal["comment"] = "comment"
    page: int = Field(..., description="Page number (1-indexed)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    content: str = Field(..., description="Comment text")
    author: Optional[str] = Field(default=None, description="Author name")
    icon: str = Field(default="Note", description="Icon type (Note, Comment, Help, etc.)")


class RedactOperation(BaseModel):
    """Redact area in PDF."""
    type: Literal["redact"] = "redact"
    page: int = Field(..., description="Page number (1-indexed)")
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")
    width: float = Field(..., description="Redact area width")
    height: float = Field(..., description="Redact area height")
    fill_color: str = Field(default="#000000", description="Redaction fill color")


# Union type for all operations
EditOperation = Union[
    TextOperation,
    ImageOperation,
    RectangleOperation,
    LineOperation,
    HighlightOperation,
    CommentOperation,
    RedactOperation,
]


class PDFEditRequest(BaseModel):
    """Request for combined PDF editing."""
    operations: List[EditOperation] = Field(..., description="List of edit operations")


class FindTextRequest(BaseModel):
    """Request to find text in PDF."""
    search_text: str = Field(..., min_length=1, description="Text to search for")
    match_case: bool = Field(default=False, description="Case-sensitive search")
    page: Optional[int] = Field(default=None, description="Specific page (1-indexed), or all pages if None")


class ReplaceTextRequest(BaseModel):
    """Request to replace text in PDF."""
    replacements: List[TextReplacement] = Field(..., min_length=1)


class FillFormRequest(BaseModel):
    """Request to fill form fields."""
    field_values: dict = Field(..., description="Map of field name to value")
    flatten: bool = Field(default=False, description="Flatten form after filling")
