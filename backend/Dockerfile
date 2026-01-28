FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # LibreOffice for document conversion
    libreoffice \
    # OCR with multiple languages
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-ind \
    tesseract-ocr-chi-sim \
    tesseract-ocr-jpn \
    tesseract-ocr-kor \
    tesseract-ocr-ara \
    tesseract-ocr-deu \
    tesseract-ocr-fra \
    tesseract-ocr-spa \
    # PDF processing
    poppler-utils \
    ghostscript \
    # Image processing
    libmagic1 \
    libpng-dev \
    libjpeg-dev \
    # WeasyPrint dependencies
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    # Fonts
    fonts-liberation \
    fonts-dejavu-core \
    # PostgreSQL
    libpq-dev \
    # Build tools
    gcc \
    # Health check
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download rembg models for background removal (avoids download at runtime)
RUN python -c "from rembg import new_session; new_session('u2net_human_seg')" || true

# Copy application code
COPY . .

# Create storage directories
RUN mkdir -p storage/uploads storage/processed

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
