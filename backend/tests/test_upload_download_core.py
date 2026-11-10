"""Tests for upload streaming, file-name sanitising and the download/cleanup lifecycle."""

import asyncio
import io
import unicodedata
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI, UploadFile
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.datastructures import Headers

from app.config import settings
from app.core import file_handler as fh
from app.core.exceptions import FileSizeExceededError
from app.core.file_handler import FileHandler, build_stored_name, sanitize_filename
from app.models.database import Base
from app.models.task import InputFile, OutputFile, Task
from app.utils import cleanup

# ---------------------------------------------------------------- sanitising


@pytest.mark.parametrize(
    "raw",
    [
        "../../etc/passwd",
        "..\\..\\windows\\system32\\cmd.exe",
        "/etc/passwd",
        "a/b/c.pdf",
        "C:\\Users\\x\\file.pdf",
        "....//....//x.pdf",
        "..",
        ".",
        "...",
    ],
)
def test_no_traversal_or_separators(raw):
    out = sanitize_filename(raw)
    assert "/" not in out and "\\" not in out
    assert out not in ("..", ".")
    assert not out.startswith(".")
    assert (Path("/base") / out).resolve().parent == Path("/base")


def test_basename_is_kept():
    assert sanitize_filename("../../etc/report.pdf") == "report.pdf"
    assert sanitize_filename("C:\\Users\\x\\file.pdf") == "file.pdf"


def test_control_null_and_format_chars_removed():
    out = sanitize_filename("a\x00b\x01c\x1f\x7fd\u202e\u200b.pdf")
    assert out == "abcd.pdf"
    assert all(unicodedata.category(c)[0] != "C" for c in out)


@pytest.mark.parametrize("raw", ["", "   ", "\x00", "\t\n", "...", "___", "CON", "nul.txt", "COM1.pdf", " . "])
def test_empty_or_reserved_become_unnamed(raw):
    assert sanitize_filename(raw) == "unnamed"


def test_trailing_dots_stripped():
    assert sanitize_filename("report.pdf.") == "report.pdf"
    assert sanitize_filename(".pdf.") == "pdf"


def test_leading_dots_and_dashes_stripped():
    assert sanitize_filename(".htaccess") == "htaccess"
    assert sanitize_filename("--rf.pdf") == "rf.pdf"


def test_whitespace_and_symbols_become_underscore():
    assert sanitize_filename("my file (1) $x.pdf") == "my_file__1___x.pdf"


@pytest.mark.parametrize(
    "name",
    [
        "เอกสารสำคัญ.pdf",  # Thai (with combining vowels)
        "ที่อยู่.docx",
        "文档报告.pdf",  # Chinese
        "تقرير_سنوي.pdf",  # Arabic
        "दस्तावेज़.pdf",  # Hindi (virama, nukta)
        "Приказ-№5.pdf",
        "日本語ファイル.xlsx",
        "한국어.pdf",
        "Ünïcödé-ñame_2024.pdf",
    ],
)
def test_unicode_letters_preserved(name):
    out = sanitize_filename(name)
    expected = unicodedata.normalize("NFC", name).replace("№", "_")
    assert out == expected
    assert out.endswith("." + name.rsplit(".", 1)[1])


def test_nfc_normalisation():
    decomposed = "cafe\u0301.pdf"
    assert sanitize_filename(decomposed) == "caf\u00e9.pdf"
    assert unicodedata.is_normalized("NFC", sanitize_filename("한국어.pdf"))
    assert unicodedata.is_normalized("NFC", sanitize_filename("\u1112\u1161\u11ab.pdf"))


def test_original_name_length_is_capped_in_bytes():
    out = sanitize_filename("字" * 500 + ".pdf")
    assert len(out.encode()) <= fh.MAX_ORIGINAL_NAME_BYTES
    assert out.endswith(".pdf")
    assert sanitize_filename("a" * 1000 + ".pdf").endswith(".pdf")


def test_long_extension_is_truncated():
    out = sanitize_filename("x." + "e" * 100)
    assert len(out.split(".")[-1]) < fh.MAX_EXT_CHARS


FILE_ID = "a" * 32 + "_1700000000_0"


def test_stored_name_layout_and_stem_limit():
    name = build_stored_name(FILE_ID, "report.pdf")
    assert name == f"{FILE_ID}_report.pdf"
    long = build_stored_name(FILE_ID, "s" * 80 + ".pdf")
    assert long == f"{FILE_ID}_{'s' * 50}.pdf"


@pytest.mark.parametrize("ch", ["字", "ก", "ع", "\U00020000"])  # 3-byte and 4-byte letters
def test_stored_name_fits_255_bytes(ch):
    original = sanitize_filename(ch * 300 + "." + ch * 30)
    stored = build_stored_name(FILE_ID, original)
    assert len(stored.encode()) <= fh.MAX_STORED_NAME_BYTES
    # still a valid string (no half characters)
    stored.encode("utf-8").decode("utf-8")
    assert stored.startswith(FILE_ID + "_")


def test_stored_name_byte_budget_with_worst_case_extension():
    original = sanitize_filename("字" * 50 + "." + "\U00020000" * 20)
    stored = build_stored_name(FILE_ID, original)
    assert len(stored.encode()) <= 255


def test_stored_name_chars_stem_50():
    stored = build_stored_name(FILE_ID, "字" * 70 + ".pdf")
    assert stored == f"{FILE_ID}_{'字' * 50}.pdf"


# ------------------------------------------------------------ chunked upload


class CountingUpload:
    """UploadFile stand-in that records the largest single read() asked of it."""

    def __init__(self, data_chunks, filename="big.pdf"):
        self.filename = filename
        self.content_type = "application/pdf"
        self._chunks = list(data_chunks)
        self.max_request = 0
        self.consumed = 0

    async def read(self, size=-1):
        self.max_request = max(self.max_request, size if size is not None else -1)
        if size is None or size < 0:
            self.max_request = 10**12
        if not self._chunks:
            return b""
        buf = self._chunks.pop(0)
        self.consumed += len(buf)
        return buf


async def test_save_upload_streams_and_writes_everything(tmp_path):
    payload = [b"%PDF" + b"x" * 1000, b"y" * 2000, b"z" * 10]
    up = CountingUpload(payload)
    info = await FileHandler.save_upload(up, tmp_path, FILE_ID, max_size=10_000)
    assert info.file_path.read_bytes() == b"".join(payload)
    assert info.file_size == 3014
    assert 0 < up.max_request <= fh.UPLOAD_CHUNK_SIZE  # never read(-1)


async def test_oversized_upload_rejected_midstream_and_partial_removed(tmp_path):
    # 100 chunks of 1 KiB, limit 5 KiB: must stop early, not read it all.
    up = CountingUpload([b"a" * 1024 for _ in range(100)])
    with pytest.raises(FileSizeExceededError):
        await FileHandler.save_upload(up, tmp_path, FILE_ID, max_size=5 * 1024)
    assert list(tmp_path.iterdir()) == []
    assert up.consumed < 100 * 1024  # stopped as soon as the limit was crossed
    assert up.consumed <= 6 * 1024


async def test_exact_limit_is_allowed(tmp_path):
    up = CountingUpload([b"a" * 1024] * 5)
    info = await FileHandler.save_upload(up, tmp_path, FILE_ID, max_size=5 * 1024)
    assert info.file_size == 5 * 1024


async def test_default_limit_comes_from_settings(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 100)
    with pytest.raises(FileSizeExceededError):
        await FileHandler.save_upload(CountingUpload([b"a" * 101]), tmp_path, FILE_ID)
    assert list(tmp_path.iterdir()) == []


async def test_read_error_removes_partial_file(tmp_path):
    class Broken(CountingUpload):
        async def read(self, size=-1):
            if self.consumed:
                raise ConnectionError("client went away")
            return await super().read(size)

    with pytest.raises(ConnectionError):
        await FileHandler.save_upload(Broken([b"a" * 10, b"b"]), tmp_path, FILE_ID, max_size=1000)
    assert list(tmp_path.iterdir()) == []


async def test_real_uploadfile_with_unicode_name(tmp_path):
    up = UploadFile(io.BytesIO(b"%PDF-1.4 hello"), filename="เอกสาร.pdf",
                    headers=Headers({"content-type": "application/pdf"}))
    info = await FileHandler.save_upload(up, tmp_path, FILE_ID)
    assert info.stored_name == f"{FILE_ID}_เอกสาร.pdf"
    assert info.file_path.read_bytes() == b"%PDF-1.4 hello"
    assert info.original_name == "เอกสาร.pdf"


# ------------------------------------------------------- grace / pure logic


def test_grace_expiry_only_moves_earlier():
    now = datetime(2026, 1, 1, 12, 0, 0)
    assert cleanup.grace_expiry(now, now + timedelta(minutes=5), 120) == now + timedelta(seconds=120)
    # already sooner than the grace window: unchanged (a download never extends life)
    assert cleanup.grace_expiry(now, now + timedelta(seconds=30), 120) == now + timedelta(seconds=30)
    # idempotent
    once = cleanup.grace_expiry(now, now + timedelta(minutes=5), 120)
    assert cleanup.grace_expiry(now, once, 120) == once
    assert cleanup.grace_expiry(now, now + timedelta(minutes=5), 0) == now


def test_is_within(tmp_path):
    (tmp_path / "d").mkdir()
    assert cleanup.is_within(tmp_path / "d" / "f", tmp_path / "d")
    assert not cleanup.is_within(tmp_path / "d" / ".." / "x", tmp_path / "d")
    (tmp_path / "link").symlink_to("/etc")
    assert not cleanup.is_within(tmp_path / "link" / "passwd", tmp_path / "d")


# ---------------------------------------------- DB-backed purge + endpoint


@pytest.fixture
async def env(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", tmp_path / "storage")
    monkeypatch.setattr(settings, "DELETE_AFTER_DOWNLOAD", True)
    monkeypatch.setenv("DOWNLOAD_GRACE_SECONDS", "1")
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 't.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(cleanup, "async_session_maker", maker)
    yield maker
    await engine.dispose()


TASK = "b" * 32 + "_1700000001"


async def make_task(maker, expires_in=300, task_id=TASK, stored_in="flat"):
    up, proc = settings.upload_path, settings.processed_path
    inp = up / f"{task_id}_0_orig.pdf"
    inp.write_bytes(b"in")
    out = proc / f"{'c' * 32}_1700000002.pdf"
    out.write_bytes(b"%PDF-out")
    async with maker() as s:
        s.add(Task(id=task_id, tool_type="x", status="completed"))
        s.add(InputFile(id="i1", task_id=task_id, original_name="orig.pdf", stored_name=inp.name,
                        file_path=str(inp), file_size=2, mime_type="application/pdf"))
        s.add(OutputFile(id="c" * 32 + "_1700000002", task_id=task_id, file_name="หนึ่ง_compressed.pdf",
                         file_path=str(out), file_size=8, mime_type="application/pdf",
                         expires_at=datetime.utcnow() + timedelta(seconds=expires_in)))
        await s.commit()
    return inp, out


async def counts(maker):
    from sqlalchemy import func, select
    async with maker() as s:
        return [(await s.execute(select(func.count()).select_from(m))).scalar() for m in (Task, InputFile, OutputFile)]


async def test_purge_task_removes_flat_inputs_output_and_rows(env):
    inp, out = await make_task(env)
    stray = settings.upload_path / f"{TASK}_1_second.pdf"  # input whose row is missing
    stray.write_bytes(b"x")
    legacy = settings.upload_path / TASK
    legacy.mkdir()
    (legacy / "f").write_bytes(b"x")
    unrelated = settings.upload_path / ("d" * 32 + "_1700000009_0_other.pdf")
    unrelated.write_bytes(b"keep")
    async with env() as s:
        removed = await cleanup.purge_task(s, TASK)
    assert removed == {"input_files": 2, "output_files": 1}
    assert not inp.exists() and not out.exists() and not stray.exists() and not legacy.exists()
    assert unrelated.exists()
    assert await counts(env) == [0, 0, 0]
    async with env() as s:  # idempotent
        await cleanup.purge_task(s, TASK)


async def test_purge_refuses_paths_outside_storage(env, tmp_path):
    outside = tmp_path / "precious.txt"
    outside.write_text("x")
    await make_task(env)
    async with env() as s:
        row = (await s.get(InputFile, "i1"))
        row.file_path = str(outside)
        await s.commit()
    async with env() as s:
        await cleanup.purge_task(s, TASK)
    assert outside.exists()


async def test_sweeper_purges_expired_task_completely(env):
    inp, out = await make_task(env, expires_in=-10)
    assert await cleanup.cleanup_expired_files() == 1
    assert not inp.exists() and not out.exists()
    assert await counts(env) == [0, 0, 0]


async def test_sweeper_leaves_live_tasks(env):
    inp, out = await make_task(env, expires_in=300)
    assert await cleanup.cleanup_expired_files() == 0
    assert inp.exists() and out.exists()


async def test_delayed_purge_scheduled_once(env):
    inp, out = await make_task(env)
    assert cleanup.schedule_task_purge(TASK, 0.2, env) is True
    assert cleanup.schedule_task_purge(TASK, 0.2, env) is False
    await asyncio.sleep(0.6)
    assert not inp.exists() and not out.exists()
    assert await counts(env) == [0, 0, 0]
    assert TASK not in cleanup._pending_purges


@pytest.fixture
async def client(env):
    from app.api.v1.endpoints import download
    from app.models.database import get_db

    app = FastAPI()
    app.include_router(download.router, prefix="/api/v1")

    async def _db():
        async with env() as s:
            yield s

    app.dependency_overrides[get_db] = _db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        yield c


FID = "c" * 32 + "_1700000002"


async def test_head_does_not_consume_or_start_clock(env, client):
    inp, out = await make_task(env)
    r = await client.head(f"/api/v1/download/{FID}")
    assert r.status_code == 200
    assert TASK not in cleanup._pending_purges
    async with env() as s:
        row = await s.get(OutputFile, FID)
        assert row.download_count == 0
        assert row.expires_at > datetime.utcnow() + timedelta(seconds=200)


async def test_download_survives_retry_range_and_double_click_then_purges(env, client):
    inp, out = await make_task(env)
    r1 = await client.get(f"/api/v1/download/{FID}")
    assert r1.status_code == 200 and r1.content == b"%PDF-out"
    assert "filename*=utf-8''" in r1.headers["content-disposition"].lower()  # RFC 5987 for Thai name
    # immediately after: retry, range/resume, HEAD all still work
    assert (await client.get(f"/api/v1/download/{FID}")).content == b"%PDF-out"
    r3 = await client.get(f"/api/v1/download/{FID}", headers={"Range": "bytes=4-"})
    assert r3.status_code == 206 and r3.content == b"-out"
    assert (await client.head(f"/api/v1/download/{FID}")).status_code == 200
    # the privacy intent holds: expiry was shortened to the grace window, not extended
    async with env() as s:
        row = await s.get(OutputFile, FID)
        assert row.download_count == 3
        assert row.expires_at <= datetime.utcnow() + timedelta(seconds=2)
    await asyncio.sleep(2.5)
    assert not inp.exists() and not out.exists()
    assert await counts(env) == [0, 0, 0]
    assert (await client.get(f"/api/v1/download/{FID}")).status_code == 404


async def test_delete_after_download_disabled_keeps_expiry(env, client, monkeypatch):
    monkeypatch.setattr(settings, "DELETE_AFTER_DOWNLOAD", False)
    inp, out = await make_task(env)
    assert (await client.get(f"/api/v1/download/{FID}")).status_code == 200
    assert TASK not in cleanup._pending_purges
    async with env() as s:
        assert (await s.get(OutputFile, FID)).expires_at > datetime.utcnow() + timedelta(seconds=200)


async def test_stale_processed_files_are_swept(tmp_path):
    """Files in processed/ with no database row must not linger."""
    import os
    import time

    from app.utils.cleanup import cleanup_processed_files

    processed = tmp_path / "processed"
    processed.mkdir()
    old = processed / "aaaa_1700000000_pages_1-1.pdf"
    fresh = processed / "bbbb_1700000000.pdf"
    old.write_bytes(b"x")
    fresh.write_bytes(b"x")
    two_hours_ago = time.time() - 2 * 3600
    os.utime(old, (two_hours_ago, two_hours_ago))

    assert await cleanup_processed_files(tmp_path, minutes_old=60) == 1
    assert not old.exists()
    assert fresh.exists()
