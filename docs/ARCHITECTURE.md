# PDFGlide Architecture

## System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│    Storage      │
│   (Next.js)     │◀────│   (FastAPI)     │◀────│   (SQLite +     │
│                 │     │                 │     │    Files)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Layer Architecture

### 1. Presentation Layer (Frontend)
- **Technology**: Next.js 14 with App Router
- **Responsibility**: User interface, client-side validation, file preview
- **Components**:
  - UI Components (Button, Card, Modal)
  - Shared Components (FileUploader, ToolLayout)
  - Page Components (Tool-specific pages)

### 2. API Layer
- **Technology**: FastAPI
- **Responsibility**: HTTP handling, request validation, routing
- **Structure**:
  ```
  api/
  └── v1/
      ├── endpoints/
      │   ├── pdf.py
      │   ├── image.py
      │   └── document.py
      └── router.py
  ```

### 3. Service Layer
- **Responsibility**: Business logic, orchestration
- **Pattern**: Each tool category has its own service
- **Structure**:
  ```
  services/
  ├── base.py          # BaseService class
  ├── pdf_service.py
  ├── image_service.py
  └── document_service.py
  ```

### 4. UseCase Layer (NEW)
- **Responsibility**: Orchestrate operations, reduce boilerplate
- **Pattern**: Command pattern for operations
- **Structure**:
  ```
  usecases/
  ├── base.py              # BaseUseCase with common logic
  ├── pdf_usecases.py      # MergePDFUseCase, SplitPDFUseCase, etc.
  └── document_usecases.py # WordToPDFUseCase, HTMLToPDFUseCase, etc.
  ```

### 5. Processing Layer
- **Responsibility**: Actual file manipulation
- **Pattern**: Strategy pattern for different operations
- **Structure**:
  ```
  processors/
  ├── base.py
  ├── pdf/
  │   ├── merger.py
  │   ├── splitter.py
  │   ├── compressor.py
  │   ├── rotator.py
  │   ├── watermark.py
  │   ├── page_numbers.py
  │   ├── protector.py
  │   ├── organizer.py
  │   ├── repairer.py      # [NEW] Fix corrupted PDFs
  │   ├── cropper.py       # [NEW] Crop margins
  │   ├── signer.py        # [NEW] Add signatures
  │   ├── metadata.py      # [NEW] Edit metadata
  │   ├── table_extractor.py # [NEW] PDF to Excel
  │   └── converter.py
  ├── image/
  │   ├── compressor.py
  │   ├── resizer.py
  │   ├── watermark.py
  │   └── background_remover.py
  └── document/
      ├── office_converter.py
      ├── html_converter.py  # [NEW] HTML/URL to PDF
      └── pptx_converter.py  # [NEW] PowerPoint to PDF
  ```

### 6. Repository Layer (NEW)
- **Responsibility**: Database operations abstraction
- **Structure**:
  ```
  repositories/
  └── task_repository.py   # Task CRUD operations
  ```

### 7. Data Layer
- **Database**: SQLite for task metadata
- **File Storage**: Local filesystem
- **Models**: SQLAlchemy ORM

## Request Flow

```
User Action
    │
    ▼
┌─────────────────────────────────────┐
│         Frontend (Next.js)          │
│  1. Validate file (size, type)      │
│  2. Show upload progress            │
│  3. Send to API                     │
└──────────────┬──────────────────────┘
               │ POST /api/v1/pdf/merge
               ▼
┌─────────────────────────────────────┐
│         API Layer (FastAPI)         │
│  1. Validate request                │
│  2. Create task record              │
│  3. Call service                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         Service Layer               │
│  1. Validate business rules         │
│  2. Save input files                │
│  3. Call processor                  │
│  4. Save output file                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         Processing Layer            │
│  1. Load files                      │
│  2. Process (merge/split/etc)       │
│  3. Return result                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│         Data Layer                  │
│  1. Store processed file            │
│  2. Update task status              │
│  3. Return download URL             │
└─────────────────────────────────────┘
```

## Key Design Decisions

### 1. Separate Processing Layer
- Processors are decoupled from HTTP concerns
- Easy to test in isolation
- Can be reused for batch processing

### 2. Task-based Architecture
- Every operation creates a task
- Enables async processing for large files
- Provides audit trail

### 3. File Expiration
- Processed files expire after 1 hour
- Automatic cleanup via scheduled job
- Prevents storage bloat

### 4. Type Safety
- TypeScript on frontend
- Pydantic schemas on backend
- Clear contracts between layers
