"""PDF endpoint tests."""

import pytest
from pathlib import Path
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test health check endpoint."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    """Test root endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "PDFGlide"
    assert "version" in data


@pytest.mark.asyncio
async def test_merge_pdfs_requires_multiple_files(client: AsyncClient, sample_pdf: Path):
    """Test that merge requires at least 2 files."""
    with open(sample_pdf, "rb") as f:
        response = await client.post(
            "/api/v1/pdf/merge",
            files=[("files", ("test.pdf", f, "application/pdf"))],
        )
    assert response.status_code == 400
    assert "2 files required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_merge_pdfs_success(client: AsyncClient, sample_pdf: Path, tmp_path: Path):
    """Test successful PDF merge."""
    # Create second PDF
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    pdf2_path = tmp_path / "sample2.pdf"
    c = canvas.Canvas(str(pdf2_path), pagesize=letter)
    c.drawString(100, 750, "Second PDF")
    c.save()

    with open(sample_pdf, "rb") as f1, open(pdf2_path, "rb") as f2:
        response = await client.post(
            "/api/v1/pdf/merge",
            files=[
                ("files", ("test1.pdf", f1, "application/pdf")),
                ("files", ("test2.pdf", f2, "application/pdf")),
            ],
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "completed"
    assert "download_url" in data["data"]


@pytest.mark.asyncio
async def test_compress_pdf(client: AsyncClient, sample_pdf: Path):
    """Test PDF compression."""
    with open(sample_pdf, "rb") as f:
        response = await client.post(
            "/api/v1/pdf/compress",
            files=[("file", ("test.pdf", f, "application/pdf"))],
            data={"quality": "medium"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "completed"


@pytest.mark.asyncio
async def test_split_pdf(client: AsyncClient, sample_pdf: Path):
    """Test PDF split."""
    with open(sample_pdf, "rb") as f:
        response = await client.post(
            "/api/v1/pdf/split",
            files=[("file", ("test.pdf", f, "application/pdf"))],
            data={"pages": "1"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "completed"
