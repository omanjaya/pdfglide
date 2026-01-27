# PDFGlide

Multi-format file processing tool - an enhanced clone of iLovePDF supporting PDF, Image, Word, Excel, and more.

## Features

### PDF Tools
- **Merge PDF** - Combine multiple PDFs into one
- **Split PDF** - Separate pages into multiple files
- **Compress PDF** - Reduce file size

### Image Tools
- **Compress Image** - Reduce image file size
- **Resize Image** - Change dimensions
- **Convert Image** - Convert between formats (JPG, PNG, WebP, GIF)

### Document Tools
- **Word to PDF** - Convert Word documents to PDF
- **PDF to Word** - Convert PDF to editable Word
- **Excel to PDF** - Convert spreadsheets to PDF

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- TanStack Query

### Backend
- Python 3.11+
- FastAPI
- PostgreSQL + SQLAlchemy
- pikepdf, Pillow, python-docx

## Quick Start

### Using Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# Access the app
open http://localhost:3000
```

### Manual Setup

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL (required)
# Adjust DATABASE_URL in .env if needed

# Run server
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## Environment Variables

### Backend (.env)
```
APP_ENV=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/pdfglide
STORAGE_PATH=./storage
MAX_UPLOAD_SIZE=104857600
FILE_EXPIRY_HOURS=1
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## System Requirements

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- LibreOffice (for document conversion)
- Tesseract OCR (optional, for OCR features)

### Install System Dependencies

**macOS:**
```bash
brew install postgresql libreoffice tesseract poppler
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql libreoffice tesseract-ocr poppler-utils
```

## Project Structure

```
pdfglide/
├── frontend/           # Next.js application
│   ├── src/
│   │   ├── app/        # Pages (App Router)
│   │   ├── components/ # React components
│   │   ├── lib/        # Utilities
│   │   └── hooks/      # Custom hooks
│   └── package.json
│
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── api/        # API endpoints
│   │   ├── services/   # Business logic
│   │   ├── processors/ # File processors
│   │   ├── models/     # Database models
│   │   └── schemas/    # Pydantic schemas
│   └── requirements.txt
│
├── docs/               # Documentation
├── docker-compose.yml
└── README.md
```

## API Documentation

Once the backend is running, access the API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT
