"""Image endpoint tests."""

import pytest
from pathlib import Path
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_compress_image(client: AsyncClient, sample_image: Path):
    """Test image compression."""
    with open(sample_image, "rb") as f:
        response = await client.post(
            "/api/v1/image/compress",
            files=[("file", ("test.jpg", f, "image/jpeg"))],
            data={"quality": "80"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "completed"


@pytest.mark.asyncio
async def test_resize_image(client: AsyncClient, sample_image: Path):
    """Test image resize."""
    with open(sample_image, "rb") as f:
        response = await client.post(
            "/api/v1/image/resize",
            files=[("file", ("test.jpg", f, "image/jpeg"))],
            data={"width": "200", "maintain_ratio": "true"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "completed"


@pytest.mark.asyncio
async def test_resize_requires_dimensions(client: AsyncClient, sample_image: Path):
    """Test that resize requires at least one dimension."""
    with open(sample_image, "rb") as f:
        response = await client.post(
            "/api/v1/image/resize",
            files=[("file", ("test.jpg", f, "image/jpeg"))],
            data={"maintain_ratio": "true"},
        )

    assert response.status_code == 400
    assert "width or height" in response.json()["detail"]


@pytest.mark.asyncio
async def test_convert_image(client: AsyncClient, sample_image: Path):
    """Test image format conversion."""
    with open(sample_image, "rb") as f:
        response = await client.post(
            "/api/v1/image/convert",
            files=[("file", ("test.jpg", f, "image/jpeg"))],
            data={"format": "png", "quality": "90"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "completed"


@pytest.mark.asyncio
async def test_convert_invalid_format(client: AsyncClient, sample_image: Path):
    """Test conversion with invalid format."""
    with open(sample_image, "rb") as f:
        response = await client.post(
            "/api/v1/image/convert",
            files=[("file", ("test.jpg", f, "image/jpeg"))],
            data={"format": "invalid", "quality": "90"},
        )

    assert response.status_code == 400
    assert "Invalid format" in response.json()["detail"]
