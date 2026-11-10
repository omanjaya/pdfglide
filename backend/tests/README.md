# Backend tests

The suite needs no PostgreSQL, Redis or Celery. `conftest.py` points the app at a
throwaway SQLite file and a temporary storage directory *before* importing it
(any `DATABASE_URL` in your shell is ignored), overrides the `get_db` dependency
with a per-test SQLite engine whose tables come from the models, and disables the
in-memory rate limiter. The app lifespan (cleanup scheduler) is not started.

## Run locally

```bash
cd backend
pip install -r requirements.txt
python -m pytest -q tests
```

Tests that need LibreOffice (`soffice`) skip themselves if it is missing or cannot
start. Other tests may need Ghostscript/poppler/Tesseract on the machine.

## Run in Docker (production image, no DB)

```bash
docker run --rm --network none -v "$PWD/backend:/app" -w /app \
  -e HOME=/tmp -e PYTHONPATH=/app <backend-image> python -m pytest -q -p no:cacheprovider tests
```

## Layout

- `test_naming.py`, `test_*_core.py`, `test_split_merge.py`, ...: pure unit tests, no client.
- `test_pdf.py`, `test_image.py`, `test_document.py`: endpoint smoke tests via the `client` fixture.
- `test_api_contract.py`: response shape (`{success, data, error}`), clean user-facing
  names, download headers, valid output files, 4xx on bad input.

Errors come back as `{"success": false, "error": "..."}` (not FastAPI's `detail`).
`xfail(strict=True)` marks a known endpoint bug; fix the bug and remove the marker.
