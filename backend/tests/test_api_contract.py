"""API contract tests: response shape, user-facing names, downloads, bad input.

These deliberately do not assert on exact merge/ZIP entry names, output sizes,
or on what a second download does (those are being changed independently).
"""

import io
import re
import zipfile
from pathlib import Path

import pytest
from httpx import AsyncClient

INTERNAL_ID_RE = re.compile(r"[a-f0-9]{32}_\d{9,11}")
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def make_pdf(path: Path, pages: int = 1, label: str = "Page") -> Path:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    c = canvas.Canvas(str(path), pagesize=letter)
    for i in range(pages):
        c.drawString(100, 750, f"{label} {i + 1}")
        c.showPage()
    c.save()
    return path


def content_disposition_filename(header: str) -> str:
    from urllib.parse import unquote

    m = re.search(r"filename\*=(?:UTF-8|utf-8)''([^;]+)", header)
    if m:
        return unquote(m.group(1))
    m = re.search(r'filename="([^"]*)"', header)
    assert m, f"no filename in Content-Disposition: {header!r}"
    return m.group(1)


def assert_clean_name(name: str, suffix: str):
    assert name.lower().endswith(suffix), name
    assert not INTERNAL_ID_RE.search(name), f"internal ID leaked: {name}"
    assert "__" not in name, f"double underscore in name: {name}"


async def assert_success_and_download(client: AsyncClient, response, suffix: str) -> bytes:
    """Check the {success, data, error} contract, clean name, download headers; return bytes."""
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body.get("error") is None
    data = body["data"]
    assert data["status"] == "completed"
    for key in ("task_id", "file_name", "file_size", "download_url"):
        assert key in data, f"missing {key}"
    assert data["file_size"] > 0
    assert_clean_name(data["file_name"], suffix)

    dl = await client.get(data["download_url"])
    assert dl.status_code == 200, dl.text
    served = content_disposition_filename(dl.headers["content-disposition"])
    assert served == data["file_name"]
    assert_clean_name(served, suffix)
    assert len(dl.content) > 0
    return dl.content


def assert_valid_pdf(content: bytes, pages: int | None = None):
    import pikepdf

    with pikepdf.open(io.BytesIO(content)) as pdf:
        if pages is not None:
            assert len(pdf.pages) == pages


async def test_compress_pdf_contract(client: AsyncClient, tmp_path: Path):
    src = make_pdf(tmp_path / "My Report.pdf", pages=2)
    r = await client.post(
        "/api/v1/pdf/compress",
        files={"file": ("My Report.pdf", src.read_bytes(), PDF)},
        data={"quality": "medium"},
    )
    content = await assert_success_and_download(client, r, ".pdf")
    assert_valid_pdf(content, pages=2)


async def test_rotate_pdf_contract(client: AsyncClient, tmp_path: Path):
    src = make_pdf(tmp_path / "doc.pdf", pages=3)
    r = await client.post(
        "/api/v1/pdf/rotate",
        files={"file": ("doc.pdf", src.read_bytes(), PDF)},
        data={"rotation": "90", "pages": "all"},
    )
    content = await assert_success_and_download(client, r, ".pdf")
    import pikepdf

    with pikepdf.open(io.BytesIO(content)) as pdf:
        assert len(pdf.pages) == 3
        assert all(int(p.get("/Rotate", 0)) % 360 == 90 for p in pdf.pages)


async def test_rotate_rejects_bad_angle(client: AsyncClient, tmp_path: Path):
    src = make_pdf(tmp_path / "doc.pdf")
    r = await client.post(
        "/api/v1/pdf/rotate",
        files={"file": ("doc.pdf", src.read_bytes(), PDF)},
        data={"rotation": "45"},
    )
    assert r.status_code == 400
    assert r.json()["success"] is False
    assert "90" in r.json()["error"]


async def test_split_multiple_ranges_returns_zip(client: AsyncClient, tmp_path: Path):
    src = make_pdf(tmp_path / "book.pdf", pages=5)
    r = await client.post(
        "/api/v1/pdf/split",
        files={"file": ("book.pdf", src.read_bytes(), PDF)},
        data={"pages": "1-2,4-5"},
    )
    content = await assert_success_and_download(client, r, ".zip")
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        assert zf.testzip() is None
        names = zf.namelist()
        assert len(names) == 2
        for n in names:
            assert_clean_name(n, ".pdf")
            assert_valid_pdf(zf.read(n))


async def test_split_single_range_returns_pdf(client: AsyncClient, tmp_path: Path):
    src = make_pdf(tmp_path / "book.pdf", pages=4)
    r = await client.post(
        "/api/v1/pdf/split",
        files={"file": ("book.pdf", src.read_bytes(), PDF)},
        data={"pages": "2-3"},
    )
    content = await assert_success_and_download(client, r, ".pdf")
    assert_valid_pdf(content, pages=2)


async def test_merge_pdf_contract(client: AsyncClient, tmp_path: Path):
    a = make_pdf(tmp_path / "a.pdf", pages=1, label="A")
    b = make_pdf(tmp_path / "b.pdf", pages=2, label="B")
    r = await client.post(
        "/api/v1/pdf/merge",
        files=[
            ("files", ("a.pdf", a.read_bytes(), PDF)),
            ("files", ("b.pdf", b.read_bytes(), PDF)),
        ],
    )
    content = await assert_success_and_download(client, r, ".pdf")
    assert_valid_pdf(content, pages=3)


async def test_compress_image_contract(client: AsyncClient, tmp_path: Path):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (300, 200), "blue").save(buf, "JPEG")
    r = await client.post(
        "/api/v1/image/compress",
        files={"file": ("holiday photo.jpg", buf.getvalue(), "image/jpeg")},
        data={"quality": "80"},
    )
    assert r.status_code == 200, r.text
    name = r.json()["data"]["file_name"]
    suffix = Path(name).suffix.lower()
    assert suffix in (".jpg", ".jpeg", ".png", ".webp", ".zip"), name
    content = await assert_success_and_download(client, r, suffix)
    if suffix != ".zip":
        with Image.open(io.BytesIO(content)) as img:
            img.verify()


async def test_word_to_pdf_contract(client: AsyncClient, tmp_path: Path, require_soffice):
    from docx import Document

    path = tmp_path / "letter.docx"
    doc = Document()
    doc.add_paragraph("Hello contract test")
    doc.save(path)
    r = await client.post(
        "/api/v1/document/word-to-pdf",
        files={"file": ("letter.docx", path.read_bytes(), DOCX)},
    )
    content = await assert_success_and_download(client, r, ".pdf")
    assert content.startswith(b"%PDF")


# ---- Invalid input: must be a 4xx with a readable message, never a 500 ----


async def _assert_client_error(r):
    assert 400 <= r.status_code < 500, (r.status_code, r.text)
    body = r.json()
    assert body["success"] is False
    msg = body.get("error")
    assert isinstance(msg, str) and len(msg) > 5
    assert "Traceback" not in msg


async def test_compress_pdf_rejects_non_pdf(client: AsyncClient):
    r = await client.post(
        "/api/v1/pdf/compress",
        files={"file": ("notes.txt", b"just some text", "text/plain")},
        data={"quality": "medium"},
    )
    await _assert_client_error(r)


async def test_compress_pdf_rejects_fake_pdf(client: AsyncClient):
    r = await client.post(
        "/api/v1/pdf/compress",
        files={"file": ("fake.pdf", b"this is not a pdf", PDF)},
        data={"quality": "medium"},
    )
    await _assert_client_error(r)


async def test_rotate_rejects_non_pdf(client: AsyncClient):
    r = await client.post(
        "/api/v1/pdf/rotate",
        files={"file": ("pic.jpg", b"\xff\xd8\xff\xe0 not really", "image/jpeg")},
        data={"rotation": "90"},
    )
    await _assert_client_error(r)


async def test_image_compress_rejects_non_image(client: AsyncClient, tmp_path: Path):
    src = make_pdf(tmp_path / "doc.pdf")
    r = await client.post(
        "/api/v1/image/compress",
        files={"file": ("doc.pdf", src.read_bytes(), PDF)},
        data={"quality": "80"},
    )
    await _assert_client_error(r)


async def test_missing_file_is_validation_error(client: AsyncClient):
    r = await client.post("/api/v1/pdf/compress", data={"quality": "medium"})
    assert r.status_code == 422
    assert r.json()["success"] is False


async def test_download_unknown_id_is_404(client: AsyncClient):
    r = await client.get("/api/v1/download/deadbeefdeadbeefdeadbeefdeadbeef")
    assert r.status_code == 404
    assert r.json()["success"] is False


async def test_unreadable_pdf_is_rejected_with_clear_message(client):
    """A file that starts like a PDF but cannot be opened must fail up front."""
    files = {"file": ("broken.pdf", b"%PDF-1.4\nthis is not really a pdf", "application/pdf")}
    for endpoint in ("/api/v1/pdf/compress", "/api/v1/pdf/to-pdfa"):
        response = await client.post(endpoint, files=files)
        assert response.status_code == 400, endpoint
        assert "not a valid PDF" in response.json()["error"]
