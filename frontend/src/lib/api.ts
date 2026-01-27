import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

export interface TaskResponse {
  success: boolean;
  data: {
    task_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    tool_type: string;
    created_at: string;
    completed_at?: string;
    file_name?: string;
    file_size?: number;
    download_url?: string;
    expires_at?: string;
    metadata?: Record<string, any>;
  };
  error?: string;
}

// PDF endpoints
export async function mergePdfs(files: File[]): Promise<TaskResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post('/pdf/merge', formData);
  return response.data;
}

export async function splitPdf(file: File, pages: string): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages);
  const response = await api.post('/pdf/split', formData);
  return response.data;
}

export interface CompressOptions {
  quality: 'extreme' | 'low' | 'medium' | 'high';
  compress_images?: boolean;
  image_dpi?: number | null;
  remove_metadata?: boolean;
  grayscale?: boolean;
  target_size_kb?: number | null;
}

export async function compressPdf(
  file: File,
  options: CompressOptions | 'extreme' | 'low' | 'medium' | 'high'
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);

  // Support both old signature (just quality string) and new signature (options object)
  if (typeof options === 'string') {
    formData.append('quality', options);
  } else {
    formData.append('quality', options.quality);
    if (options.compress_images !== undefined) {
      formData.append('compress_images', String(options.compress_images));
    }
    if (options.image_dpi != null) {
      formData.append('image_dpi', String(options.image_dpi));
    }
    if (options.remove_metadata !== undefined) {
      formData.append('remove_metadata', String(options.remove_metadata));
    }
    if (options.grayscale !== undefined) {
      formData.append('grayscale', String(options.grayscale));
    }
    if (options.target_size_kb != null) {
      formData.append('target_size_kb', String(options.target_size_kb));
    }
  }

  const response = await api.post('/pdf/compress', formData);
  return response.data;
}

export async function rotatePdf(
  file: File,
  rotation: number,
  pages: string = 'all'
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('rotation', rotation.toString());
  formData.append('pages', pages);
  const response = await api.post('/pdf/rotate', formData);
  return response.data;
}

export async function addWatermark(
  file: File,
  text: string,
  options: {
    position?: string;
    opacity?: number;
    rotation?: number;
    fontSize?: number;
    color?: string;
    pages?: string;
  } = {}
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text', text);
  if (options.position) formData.append('position', options.position);
  if (options.opacity) formData.append('opacity', options.opacity.toString());
  if (options.rotation) formData.append('rotation', options.rotation.toString());
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.color) formData.append('color', options.color);
  if (options.pages) formData.append('pages', options.pages);
  const response = await api.post('/pdf/watermark', formData);
  return response.data;
}

export async function addPageNumbers(
  file: File,
  options: {
    position?: string;
    startNumber?: number;
    formatTemplate?: string;
    fontSize?: number;
    margin?: number;
  } = {}
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.position) formData.append('position', options.position);
  if (options.startNumber) formData.append('start_number', options.startNumber.toString());
  if (options.formatTemplate) formData.append('format_template', options.formatTemplate);
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.margin) formData.append('margin', options.margin.toString());
  const response = await api.post('/pdf/page-numbers', formData);
  return response.data;
}

export async function protectPdf(
  file: File,
  options: {
    userPassword?: string;
    ownerPassword?: string;
    allowPrinting?: boolean;
    allowCopying?: boolean;
    allowModifying?: boolean;
  }
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.userPassword) formData.append('user_password', options.userPassword);
  if (options.ownerPassword) formData.append('owner_password', options.ownerPassword);
  formData.append('allow_printing', String(options.allowPrinting ?? true));
  formData.append('allow_copying', String(options.allowCopying ?? false));
  formData.append('allow_modifying', String(options.allowModifying ?? false));
  const response = await api.post('/pdf/protect', formData);
  return response.data;
}

export async function unlockPdf(file: File, password: string): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);
  const response = await api.post('/pdf/unlock', formData);
  return response.data;
}

export async function organizePdf(file: File, pageOrder: number[]): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page_order', pageOrder.join(','));
  const response = await api.post('/pdf/organize', formData);
  return response.data;
}

export async function deletePdfPages(file: File, pages: number[]): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages.join(','));
  const response = await api.post('/pdf/delete-pages', formData);
  return response.data;
}

export async function extractPdfPages(file: File, pages: number[]): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages.join(','));
  const response = await api.post('/pdf/extract-pages', formData);
  return response.data;
}

// Image endpoints
export async function compressImage(
  file: File,
  quality: number
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('quality', quality.toString());
  const response = await api.post('/image/compress', formData);
  return response.data;
}

export async function resizeImage(
  file: File,
  width?: number,
  height?: number,
  maintainRatio?: boolean
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (width) formData.append('width', width.toString());
  if (height) formData.append('height', height.toString());
  if (maintainRatio !== undefined)
    formData.append('maintain_ratio', maintainRatio.toString());
  const response = await api.post('/image/resize', formData);
  return response.data;
}

export async function convertImage(
  file: File,
  format: string,
  quality: number
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);
  formData.append('quality', quality.toString());
  const response = await api.post('/image/convert', formData);
  return response.data;
}

export async function addImageWatermark(
  file: File,
  text: string,
  options: {
    position?: string;
    opacity?: number;
    fontSize?: number;
    color?: string;
    rotation?: number;
  } = {}
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text', text);
  if (options.position) formData.append('position', options.position);
  if (options.opacity) formData.append('opacity', options.opacity.toString());
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.color) formData.append('color', options.color);
  if (options.rotation !== undefined) formData.append('rotation', options.rotation.toString());
  const response = await api.post('/image/watermark', formData);
  return response.data;
}

// Document endpoints
export async function wordToPdf(file: File): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/word-to-pdf', formData);
  return response.data;
}

export async function pdfToWord(file: File): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/pdf-to-word', formData);
  return response.data;
}

export async function excelToPdf(file: File): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/excel-to-pdf', formData);
  return response.data;
}

// PDF to PowerPoint
export async function pdfToPowerPoint(
  file: File,
  dpi: number = 150
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dpi', dpi.toString());
  const response = await api.post('/pdf/to-powerpoint', formData);
  return response.data;
}

// PDF Redact
export async function redactPdf(
  file: File,
  searchTerms: string[],
  redactColor?: string
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('search_terms', searchTerms.join(','));
  if (redactColor) formData.append('redact_color', redactColor);
  const response = await api.post('/pdf/redact', formData);
  return response.data;
}

export async function redactPdfPatterns(
  file: File,
  patternTypes: ('email' | 'phone' | 'ssn' | 'credit_card' | 'custom')[],
  customPattern?: string
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pattern_types', patternTypes.join(','));
  if (customPattern) formData.append('custom_pattern', customPattern);
  const response = await api.post('/pdf/redact-patterns', formData);
  return response.data;
}

// PDF Compare
export async function comparePdfs(
  file1: File,
  file2: File,
  outputMode: 'visual' | 'text' = 'visual'
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file1', file1);
  formData.append('file2', file2);
  formData.append('output_mode', outputMode);
  const response = await api.post('/pdf/compare', formData);
  return response.data;
}

// PDF to PDF/A
export async function pdfToPdfA(
  file: File,
  level: '1b' | '2b' | '3b' = '2b'
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('level', level);
  const response = await api.post('/pdf/to-pdfa', formData);
  return response.data;
}

// PDF Editor
export async function addTextToPdf(
  file: File,
  text: string,
  page: number,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    fontName?: string;
    color?: string;
  } = {}
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text', text);
  formData.append('page', page.toString());
  formData.append('x', x.toString());
  formData.append('y', y.toString());
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.fontName) formData.append('font_name', options.fontName);
  if (options.color) formData.append('color', options.color);
  const response = await api.post('/pdf/add-text', formData);
  return response.data;
}

export async function addImageToPdf(
  file: File,
  image: File,
  page: number,
  x: number,
  y: number,
  options: {
    width?: number;
    height?: number;
  } = {}
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('image', image);
  formData.append('page', page.toString());
  formData.append('x', x.toString());
  formData.append('y', y.toString());
  if (options.width) formData.append('width', options.width.toString());
  if (options.height) formData.append('height', options.height.toString());
  const response = await api.post('/pdf/add-image-overlay', formData);
  return response.data;
}

export async function addCommentToPdf(
  file: File,
  page: number,
  x: number,
  y: number,
  comment: string,
  author?: string
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page', page.toString());
  formData.append('x', x.toString());
  formData.append('y', y.toString());
  formData.append('comment', comment);
  if (author) formData.append('author', author);
  const response = await api.post('/pdf/add-comment', formData);
  return response.data;
}

// PDF Crop
export async function cropPdf(
  file: File,
  left: number,
  top: number,
  right: number,
  bottom: number,
  pages: string = 'all'
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('left', left.toString());
  formData.append('top', top.toString());
  formData.append('right', right.toString());
  formData.append('bottom', bottom.toString());
  formData.append('pages', pages);
  const response = await api.post('/pdf/crop', formData);
  return response.data;
}

// PDF Repair
export async function repairPdf(file: File): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pdf/repair', formData);
  return response.data;
}

// PDF Sign
export async function signPdf(
  file: File,
  signatureImage: File,
  page: number,
  x: number,
  y: number,
  width?: number,
  height?: number
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', signatureImage);
  formData.append('page', page.toString());
  formData.append('x', x.toString());
  formData.append('y', y.toString());
  if (width) formData.append('width', width.toString());
  if (height) formData.append('height', height.toString());
  const response = await api.post('/pdf/sign', formData);
  return response.data;
}

// Image to PDF
export async function imageToPdf(files: File[]): Promise<TaskResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post('/pdf/from-image', formData);
  return response.data;
}

// PDF to Excel
export async function pdfToExcel(file: File): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pdf/to-excel', formData);
  return response.data;
}

// HTML to PDF
export async function htmlToPdf(
  url: string,
  options: {
    pageSize?: string;
    orientation?: string;
  } = {}
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('url', url);
  if (options.pageSize) formData.append('page_size', options.pageSize);
  if (options.orientation) formData.append('orientation', options.orientation);
  const response = await api.post('/document/html-to-pdf', formData);
  return response.data;
}

// PowerPoint to PDF
export async function pptxToPdf(file: File): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/pptx-to-pdf', formData);
  return response.data;
}

// Download
export function getDownloadUrl(downloadPath: string): string {
  return `${API_URL}${downloadPath}`;
}

// ============== ADVANCED PDF EDIT ==============

// Text search result
export interface TextSearchMatch {
  page: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FindTextResponse {
  success: boolean;
  data: {
    search_text: string;
    match_case: boolean;
    total_matches: number;
    matches: TextSearchMatch[];
  };
  error?: string;
}

// Find text in PDF
export async function findTextInPdf(
  file: File,
  searchText: string,
  options: {
    matchCase?: boolean;
    page?: number;
  } = {}
): Promise<FindTextResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('search_text', searchText);
  if (options.matchCase !== undefined) {
    formData.append('match_case', String(options.matchCase));
  }
  if (options.page !== undefined) {
    formData.append('page', String(options.page));
  }
  const response = await api.post('/pdf/find-text', formData);
  return response.data;
}

// Text replacement
export interface TextReplacement {
  search_text: string;
  replace_text: string;
  match_case?: boolean;
  page?: number;
}

// Replace text in PDF
export async function replaceTextInPdf(
  file: File,
  replacements: TextReplacement[]
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('replacements', JSON.stringify(replacements));
  const response = await api.post('/pdf/replace-text', formData);
  return response.data;
}

// Form field types
export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'listbox'
  | 'button'
  | 'signature'
  | 'unknown';

export interface FormField {
  name: string;
  field_type: FormFieldType;
  value: string | null;
  default_value: string | null;
  options: string[] | null;
  required: boolean;
  read_only: boolean;
  page: number;
  rect: number[] | null;
}

export interface FormFieldsResponse {
  success: boolean;
  data: {
    fields: FormField[];
    field_count: number;
    has_form: boolean;
  };
  error?: string;
}

// Get form fields from PDF
export async function getFormFields(file: File): Promise<FormFieldsResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pdf/form-fields', formData);
  return response.data;
}

// Fill form in PDF
export async function fillFormPdf(
  file: File,
  fieldValues: Record<string, string | boolean>,
  flatten: boolean = false
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('field_values', JSON.stringify(fieldValues));
  formData.append('flatten', String(flatten));
  const response = await api.post('/pdf/fill-form', formData);
  return response.data;
}

// Edit operation types
export type EditOperationType =
  | 'text'
  | 'image'
  | 'rectangle'
  | 'line'
  | 'highlight'
  | 'comment'
  | 'redact';

export interface TextEditOperation {
  type: 'text';
  text: string;
  page: number;
  x: number;
  y: number;
  font_size?: number;
  font_name?: string;
  color?: string;
  opacity?: number;
}

export interface ImageEditOperation {
  type: 'image';
  image_index: number;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity?: number;
  rotation?: number;
}

export interface RectangleEditOperation {
  type: 'rectangle';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke_color?: string;
  fill_color?: string;
  stroke_width?: number;
  opacity?: number;
}

export interface LineEditOperation {
  type: 'line';
  page: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  opacity?: number;
}

export interface HighlightEditOperation {
  type: 'highlight';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  opacity?: number;
}

export interface CommentEditOperation {
  type: 'comment';
  page: number;
  x: number;
  y: number;
  content: string;
  author?: string;
  icon?: string;
}

export interface RedactEditOperation {
  type: 'redact';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill_color?: string;
}

export type EditOperation =
  | TextEditOperation
  | ImageEditOperation
  | RectangleEditOperation
  | LineEditOperation
  | HighlightEditOperation
  | CommentEditOperation
  | RedactEditOperation;

// Combined PDF edit
export async function editPdfCombined(
  file: File,
  operations: EditOperation[],
  images?: File[]
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('operations', JSON.stringify(operations));
  if (images && images.length > 0) {
    images.forEach((img) => formData.append('images', img));
  }
  const response = await api.post('/pdf/edit', formData);
  return response.data;
}

// ============== ASYNC TASK MANAGEMENT ==============

export interface AsyncTaskResponse {
  success: boolean;
  data: {
    task_id: string;
    status: 'queued' | 'pending';
    message: string;
    status_url: string;
    poll_url?: string;
  };
  error?: string;
}

export interface TaskStatusResponse {
  success: boolean;
  data: {
    task_id: string;
    status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    tool_type: string;
    created_at: string;
    updated_at?: string;
    completed_at?: string;
    progress?: number;
    download_url?: string;
    file_name?: string;
    file_size?: number;
    expires_at?: string;
    error?: string;
    metadata?: Record<string, any>;
  };
  error?: string;
}

// Get task status
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await api.get(`/tasks/${taskId}/status`);
  return response.data;
}

// Cancel a task
export async function cancelTask(taskId: string): Promise<{ success: boolean; data: { message: string } }> {
  const response = await api.delete(`/tasks/${taskId}`);
  return response.data;
}

// ============== ASYNC PDF ENDPOINTS ==============
// These endpoints queue the task for background processing and return immediately

// Merge PDFs (async)
export async function mergePdfsAsync(files: File[]): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post('/pdf/merge/async', formData);
  return response.data;
}

// Compress PDF (async)
export async function compressPdfAsync(
  file: File,
  options: CompressOptions | 'extreme' | 'low' | 'medium' | 'high'
): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  formData.append('file', file);

  if (typeof options === 'string') {
    formData.append('quality', options);
  } else {
    formData.append('quality', options.quality);
    if (options.compress_images !== undefined) {
      formData.append('compress_images', String(options.compress_images));
    }
    if (options.image_dpi != null) {
      formData.append('image_dpi', String(options.image_dpi));
    }
    if (options.remove_metadata !== undefined) {
      formData.append('remove_metadata', String(options.remove_metadata));
    }
    if (options.grayscale !== undefined) {
      formData.append('grayscale', String(options.grayscale));
    }
    if (options.target_size_kb != null) {
      formData.append('target_size_kb', String(options.target_size_kb));
    }
  }

  const response = await api.post('/pdf/compress/async', formData);
  return response.data;
}

// Split PDF (async)
export async function splitPdfAsync(file: File, pages: string): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages);
  const response = await api.post('/pdf/split/async', formData);
  return response.data;
}

// Rotate PDF (async)
export async function rotatePdfAsync(
  file: File,
  rotation: number,
  pages: string = 'all'
): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('rotation', rotation.toString());
  formData.append('pages', pages);
  const response = await api.post('/pdf/rotate/async', formData);
  return response.data;
}

// Add watermark (async)
export async function addWatermarkAsync(
  file: File,
  text: string,
  options: {
    position?: string;
    opacity?: number;
    rotation?: number;
    fontSize?: number;
    color?: string;
    pages?: string;
  } = {}
): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text', text);
  if (options.position) formData.append('position', options.position);
  if (options.opacity) formData.append('opacity', options.opacity.toString());
  if (options.rotation) formData.append('rotation', options.rotation.toString());
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.color) formData.append('color', options.color);
  if (options.pages) formData.append('pages', options.pages);
  const response = await api.post('/pdf/watermark/async', formData);
  return response.data;
}

// ============== SMART PROCESSING ==============
// Automatically chooses sync or async based on file size

const ASYNC_THRESHOLD_SIZE = 5 * 1024 * 1024; // 5MB

export interface SmartProcessingOptions {
  /** Force async processing regardless of file size */
  forceAsync?: boolean;
  /** Custom size threshold in bytes */
  sizeThreshold?: number;
}

/**
 * Smart merge that uses async for large files
 */
export async function mergePdfsSmart(
  files: File[],
  options: SmartProcessingOptions = {}
): Promise<TaskResponse | AsyncTaskResponse> {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const threshold = options.sizeThreshold ?? ASYNC_THRESHOLD_SIZE;

  if (options.forceAsync || totalSize > threshold) {
    return mergePdfsAsync(files);
  }
  return mergePdfs(files);
}

/**
 * Smart compress that uses async for large files
 */
export async function compressPdfSmart(
  file: File,
  quality: CompressOptions | 'extreme' | 'low' | 'medium' | 'high',
  options: SmartProcessingOptions = {}
): Promise<TaskResponse | AsyncTaskResponse> {
  const threshold = options.sizeThreshold ?? ASYNC_THRESHOLD_SIZE;

  if (options.forceAsync || file.size > threshold) {
    return compressPdfAsync(file, quality);
  }
  return compressPdf(file, quality);
}

/**
 * Check if a response is an async task response
 */
export function isAsyncResponse(response: TaskResponse | AsyncTaskResponse): response is AsyncTaskResponse {
  return 'data' in response && 'status_url' in (response.data as any);
}
