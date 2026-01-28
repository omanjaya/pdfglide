# PDFGlide - Development Rules

## Project Overview
PDFGlide adalah multi-format file processing tool (clone iLovePDF) yang mendukung PDF, Image, Word, Excel, dan format lainnya.

## Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Python 3.11+ + FastAPI
- **Database**: PostgreSQL + SQLAlchemy (async)
- **Processing**: pikepdf, Pillow, python-docx, openpyxl, LibreOffice headless
- **OCR**: Tesseract (multi-language: eng, ind, chi_sim, jpn, kor, ara, deu, fra, spa)
- **Queue**: Celery + Redis

## Project Structure
```
pdfglide/
├── frontend/          # Next.js application
├── backend/           # FastAPI application
├── docs/              # Documentation
└── docker-compose.yml
```

## Coding Standards

### Frontend (TypeScript/React)
- Use TypeScript strict mode
- Component naming: PascalCase (e.g., `FileUploader.tsx`)
- Hook naming: camelCase with `use` prefix (e.g., `useFileUpload.ts`)
- Use functional components with hooks
- Props interface must be defined for all components
- Use absolute imports with `@/` prefix
- Tailwind for styling, avoid inline styles
- shadcn/ui for base components

### Backend (Python)
- Python 3.11+ with type hints
- Use Pydantic for data validation
- Follow PEP 8 naming conventions
- Use async/await for I/O operations
- Services handle business logic, processors handle file operations
- All endpoints must have proper error handling
- Use dependency injection via FastAPI's Depends

## File Naming Conventions

### Frontend
- Components: `PascalCase.tsx` (e.g., `FileUploader.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useFileUpload.ts`)
- Utils: `camelCase.ts` (e.g., `fileUtils.ts`)
- Types: `camelCase.ts` (e.g., `file.ts`)
- Pages: `page.tsx` (Next.js App Router)

### Backend
- Modules: `snake_case.py` (e.g., `pdf_service.py`)
- Classes: `PascalCase` (e.g., `PDFService`)
- Functions: `snake_case` (e.g., `merge_pdfs`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)

## API Design Rules
- RESTful endpoints under `/api/v1/`
- Use proper HTTP methods (POST for processing, GET for retrieval)
- Return consistent response structure:
  ```json
  {
    "success": true,
    "data": {},
    "error": null
  }
  ```
- File uploads via multipart/form-data
- Download via unique file ID with expiration

## Error Handling
- Frontend: Use error boundaries and toast notifications
- Backend: Custom exception classes with proper HTTP status codes
- Always log errors with context
- Never expose internal errors to users

## Testing Requirements
- Backend: Pytest with async support
- Frontend: Vitest + Testing Library
- Test file processing with sample files
- Minimum coverage: 70%

## Git Commit Format
```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore
Scope: frontend, backend, docs, config
```

## File Size Limits
- Max upload: 100MB per file
- Max files per request: 20
- Processed files expire after: 1 hour

## Security Rules
- Validate file types by magic bytes, not just extension
- Sanitize filenames
- Use UUID for stored files
- Auto-cleanup expired files
- No execution of uploaded files
- Rate limiting on all endpoints

## Environment Variables

### Backend (.env)
```
APP_ENV=development
DEBUG=true
DATABASE_URL=sqlite:///./storage/pdfglide.db
STORAGE_PATH=./storage
MAX_UPLOAD_SIZE=104857600
FILE_EXPIRY_HOURS=1
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Running the Project

### Docker (Recommended - with Hot Reload)
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Rebuild after requirements.txt change
docker compose build backend
docker compose up -d backend
```

**Hot Reload sudah aktif** - Backend akan auto-reload saat file di `backend/app/` berubah.

Services:
- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:3000
- **Flower** (Celery monitor): http://localhost:5555
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Backend (Manual)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Common Commands
```bash
# Backend
pytest                          # Run tests
ruff check .                    # Lint
ruff format .                   # Format

# Frontend
npm run dev                     # Development server
npm run build                   # Production build
npm run lint                    # Lint
npm run test                    # Run tests
```

## OCR Features (PDF to Word)

Fitur OCR dengan Tesseract untuk convert scanned PDF ke Word:

**Quality Presets:**
- `draft`: 150 DPI, no preprocessing (cepat)
- `standard`: 200 DPI, with preprocessing (default)
- `high`: 300 DPI, with preprocessing (akurat)

**Image Preprocessing:**
- Grayscale conversion
- Contrast enhancement (1.5x)
- Sharpness enhancement (1.2x)
- Denoise (median filter)
- Binarization (threshold 140)

**Supported Languages:**
- `eng` - English
- `ind` - Indonesian
- `chi_sim` - Chinese (Simplified)
- `jpn` - Japanese
- `kor` - Korean
- `ara` - Arabic
- `deu` - German
- `fra` - French
- `spa` - Spanish

**Layout Detection:**
- Auto-detect headings (uppercase, title case, short lines)
- Preserve paragraph structure
- Block-based text grouping
