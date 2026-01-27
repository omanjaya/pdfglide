# PDFGlide API Reference

Base URL: `http://localhost:8000/api/v1`

## Common Response Format
```json
{
  "success": true,
  "data": {
    "task_id": "abc123",
    "download_url": "/api/v1/download/abc123"
  },
  "error": null
}
```

## PDF Endpoints

### POST /pdf/merge
Merge multiple PDF files into one.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `files`: PDF files (multiple)

**Response:**
```json
{
  "success": true,
  "data": {
    "task_id": "abc123",
    "file_name": "merged.pdf",
    "file_size": 1024000,
    "download_url": "/api/v1/download/abc123",
    "expires_at": "2024-01-01T12:00:00Z"
  }
}
```

### POST /pdf/split
Split PDF into multiple files.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: PDF file
  - `pages`: Page ranges (e.g., "1-3,5,7-10")

### POST /pdf/compress
Compress PDF file size.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: PDF file
  - `quality`: Compression level (low, medium, high)

## Image Endpoints

### POST /image/compress
Compress image file size.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file (JPG, PNG, WebP)
  - `quality`: 1-100 (default: 80)

### POST /image/resize
Resize image dimensions.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file
  - `width`: Target width (pixels)
  - `height`: Target height (pixels)
  - `maintain_ratio`: boolean (default: true)

### POST /image/convert
Convert image format.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file
  - `format`: Target format (jpg, png, webp)

## Document Endpoints

### POST /document/word-to-pdf
Convert Word document to PDF.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Word file (.docx)

### POST /document/pdf-to-word
Convert PDF to Word document.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: PDF file

## Utility Endpoints

### GET /download/{file_id}
Download processed file.

### GET /task/{task_id}/status
Get task processing status.

**Response:**
```json
{
  "success": true,
  "data": {
    "task_id": "abc123",
    "status": "completed",
    "progress": 100,
    "download_url": "/api/v1/download/abc123"
  }
}
```
