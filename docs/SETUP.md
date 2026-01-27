# PDFGlide Setup Guide

## Prerequisites
- Node.js 18+
- Python 3.11+
- LibreOffice (for document conversion)
- Tesseract OCR (optional, for OCR feature)

## Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd pdfglide
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# atau
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Create storage directories
mkdir -p storage/uploads storage/processed

# Copy environment file
cp .env.example .env
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
```

### 4. Install System Dependencies

**macOS:**
```bash
brew install libreoffice tesseract poppler
```

**Ubuntu/Debian:**
```bash
sudo apt install libreoffice tesseract-ocr poppler-utils
```

**Windows:**
- Download and install LibreOffice from https://www.libreoffice.org
- Download and install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki

## Running the Application

### Development Mode
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Production Mode
```bash
# Backend
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend
npm run build
npm start
```

### Using Docker
```bash
docker-compose up -d
```

## Configuration

### Backend Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| APP_ENV | Environment (development/production) | development |
| DEBUG | Enable debug mode | true |
| DATABASE_URL | SQLite database path | sqlite:///./storage/pdfglide.db |
| STORAGE_PATH | File storage directory | ./storage |
| MAX_UPLOAD_SIZE | Max upload size in bytes | 104857600 (100MB) |
| FILE_EXPIRY_HOURS | Hours until files expire | 1 |

### Frontend Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_API_URL | Backend API URL | http://localhost:8000 |

## Troubleshooting

### LibreOffice not found
Ensure LibreOffice is installed and `soffice` command is available in PATH.

### Tesseract not found
Install Tesseract and ensure `tesseract` command is available in PATH.

### File upload fails
Check storage directory permissions and MAX_UPLOAD_SIZE setting.
