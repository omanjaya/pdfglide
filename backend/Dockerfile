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
# constraints.txt pins every package to the versions production was tested with,
# so a rebuild never silently upgrades dependencies. Refresh it deliberately with:
#   docker run --rm project-backend pip freeze > backend/constraints.txt
COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt -c constraints.txt

# Office / document fonts (separate layer: keeps the LibreOffice + pip layers cached).
# Metric clones where they exist (Liberation, Carlito, Caladea, Arimo/Tinos/Cousine),
# Noto incl. CJK/Thai/Arabic/Indic, and look-alikes for common MS fonts. We deliberately do NOT
# use ttf-mscorefonts-installer (contrib, EULA, build-time download from SourceForge).
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-mono \
    fonts-croscore \
    fonts-liberation2 \
    fonts-urw-base35 \
    fonts-open-sans \
    fonts-lato \
    fonts-ebgaramond \
    fonts-inconsolata \
    fonts-comic-neue \
    fonts-thai-tlwg \
    fonts-hosny-amiri \
    fonts-freefont-ttf \
    fonts-dejavu-extra \
    fonts-wine \
    && mkdir -p /usr/local/share/fonts/wine \
    && for f in tahoma tahomabd wingding webdings; do ln -sf /usr/share/wine/fonts/$f.ttf /usr/local/share/fonts/wine/$f.ttf; done \
    && rm -rf /var/lib/apt/lists/*
# Bundled open-licensed metric-compatible fonts not packaged by Debian:
# Gelasio (for Georgia, OFL) and Selawik (for Segoe UI, OFL). Licences are alongside.
COPY fonts/ /usr/local/share/fonts/pdfglide/
COPY fonts.conf /etc/fonts/conf.d/59-pdfglide-office.conf
RUN fc-cache -f

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
