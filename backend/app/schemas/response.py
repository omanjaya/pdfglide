"""API response schemas."""

from typing import TypeVar, Generic, Optional, Any

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """Standard API response wrapper."""

    success: bool = True
    data: Optional[T] = None
    error: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response schema."""

    success: bool = False
    data: None = None
    error: str
    detail: Optional[Any] = None
