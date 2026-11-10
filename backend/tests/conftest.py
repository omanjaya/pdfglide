"""Test configuration and fixtures.

The integration tests are self-contained: no PostgreSQL, Redis or Celery needed.

* Before ``app`` is imported, the environment is pointed at a throwaway SQLite
  file and a temporary storage directory (always, even if DATABASE_URL is set
  in the shell, so the tests can never touch a real database).
* The ``client`` fixture overrides ``app.api.deps.get_db`` with a session on a
  fresh per-test SQLite engine whose tables are created from the models.
* ASGITransport does not run the app lifespan, so the cleanup scheduler and
  ``init_db`` never start. The in-memory rate limiter is switched off for tests.

Nothing here is autouse, so DB-free test modules are unaffected.
"""

import os
import tempfile
from pathlib import Path

# ---- Environment: must happen BEFORE importing app.config / app.main ----
_TEST_ROOT = Path(tempfile.mkdtemp(prefix="pdfglide-tests-"))
_DB_FILE = _TEST_ROOT / "test.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_DB_FILE}"
os.environ["DATABASE_URL_SYNC"] = f"sqlite:///{_DB_FILE}"
os.environ["STORAGE_PATH"] = str(_TEST_ROOT / "storage")
os.environ["APP_ENV"] = "development"
os.environ["DEBUG"] = "false"  # no SQL echo
os.environ["API_KEY"] = ""  # auth disabled
os.environ["ENABLE_ASYNC_PROCESSING"] = "false"
os.environ["ENABLE_AUDIT_LOGGING"] = "false"
os.environ["REDIS_URL"] = ""

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool  # noqa: E402

from app.main import app  # noqa: E402
from app.models.database import Base, get_db  # noqa: E402
from app import models as _models  # noqa: E402,F401  (register all tables on Base.metadata)


_SOFFICE_STATE: dict = {}


def soffice_skip_reason() -> str | None:
    """None if LibreOffice can really convert here, else why tests should skip.

    Being on PATH is not enough: in a read-only/odd-HOME container ``soffice``
    exists but dies with "User installation could not be completed".
    """
    if "reason" in _SOFFICE_STATE:
        return _SOFFICE_STATE["reason"]
    import shutil
    import subprocess

    exe = shutil.which("soffice")
    if exe is None:
        reason = "LibreOffice (soffice) not installed"
    else:
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "probe.txt"
            src.write_text("probe")
            try:
                proc = subprocess.run(
                    [exe, "--headless", "--convert-to", "pdf", "--outdir", d, str(src)],
                    capture_output=True, timeout=120,
                )
                ok = proc.returncode == 0 and (Path(d) / "probe.pdf").exists()
            except Exception:
                ok = False
        reason = None if ok else "LibreOffice is installed but cannot run in this environment"
    _SOFFICE_STATE["reason"] = reason
    return reason


@pytest.fixture
def require_soffice():
    reason = soffice_skip_reason()
    if reason:
        pytest.skip(reason)


@pytest.fixture(scope="session", autouse=False)
def test_root() -> Path:
    return _TEST_ROOT


@pytest.fixture
async def client(monkeypatch):
    """Async test client over the real app with a throwaway SQLite database."""
    from app.core.rate_limiter import RateLimiter

    # Burst limits would make multi-request tests flaky.
    monkeypatch.setattr(RateLimiter, "check_rate_limit", lambda self, request: (True, {}))

    engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _get_db():
        async with maker() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.fixture
def sample_pdf(tmp_path: Path) -> Path:
    """Create a sample PDF file for testing."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    pdf_path = tmp_path / "sample.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=letter)
    c.drawString(100, 750, "Test PDF Document")
    c.save()
    return pdf_path


@pytest.fixture
def sample_image(tmp_path: Path) -> Path:
    """Create a sample image file for testing."""
    from PIL import Image

    img_path = tmp_path / "sample.jpg"
    img = Image.new("RGB", (100, 100), color="red")
    img.save(img_path, "JPEG")
    return img_path
