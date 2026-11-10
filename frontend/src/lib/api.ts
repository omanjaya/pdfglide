import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

/**
 * Optional per-request config accepted by every upload helper below
 * (e.g. `{ signal, onUploadProgress }`), so pages can offer Cancel and a real
 * upload progress bar. See `useToolRun`.
 */
export type RequestConfig = AxiosRequestConfig;

// ============== ERROR HANDLING ==============
// The backend answers errors with `{"success": false, "data": null, "error": "<message>"}`
// (4xx), FastAPI validation errors with `{"detail": [...]}`, and proxies may answer with
// HTML or nothing at all. `getErrorMessage` turns any of those into one human sentence.
// The response interceptor below also writes that sentence into `err.message` and
// `err.response.data.detail`, so legacy pages that read either keep working.

const GENERIC_STATUS_TEXT = /^request failed with status code \d+$/i;

const MIME_NAMES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'Word (DOC)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
  'application/vnd.ms-excel': 'Excel (XLS)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (XLSX)',
  'application/vnd.ms-powerpoint': 'PowerPoint (PPT)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (PPTX)',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
};

/** Rewrites the most common technical server messages into plain language; anything else passes through. */
function humanize(text: string): string {
  const mismatch = text.match(/^File content does not match its type '([^']+)'/i);
  if (mismatch) {
    const kind = MIME_NAMES[mismatch[1]] || mismatch[1];
    return `This file is not a real ${kind} file (its contents do not match its name or type). Please check that it is not corrupted or renamed from another format.`;
  }
  const notAllowed = text.match(/^File type '([^']+)' not allowed\. Expected: \[(.*)\]/i);
  if (notAllowed) {
    const expected = notAllowed[2]
      .split(',')
      .map((m) => m.trim().replace(/^'|'$/g, ''))
      .map((m) => MIME_NAMES[m] || m);
    const found = MIME_NAMES[notAllowed[1]] || notAllowed[1];
    return `This tool does not accept ${found} files. Please choose ${expected.join(' or ')}.`;
  }
  return text;
}

/** The site is free: never relay upgrade / pricing prompts from the server. */
function stripUpsell(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/upgrade|pricing|\bpro\b|business plan|subscri/i.test(sentence))
    .join(' ');
}

function cleanMessage(text: string): string {
  return humanize(stripUpsell(text))
    // Never show server file-system paths (e.g. "/app/storage/uploads/abc_fake.pdf: ...").
    .replace(/(?<![\w:/.])\/(?:app|tmp|var|home|srv|data|usr)\/[^\s:'"]+/g, 'the uploaded file')
    .replace(/^value error,\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull a readable message out of whatever shape the server sent. */
function messageFromBody(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === 'string') {
    const t = data.trim();
    // HTML error pages from a proxy are not for humans.
    if (!t || t.startsWith('<') || t.length > 300) return null;
    return cleanMessage(t);
  }
  if (typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;

  const fromField = (v: unknown): string | null => {
    if (typeof v === 'string' && v.trim()) return cleanMessage(v);
    if (Array.isArray(v)) {
      // FastAPI validation: [{loc: ['body','pages'], msg: '...'}]
      const parts = v
        .map((item) => {
          if (typeof item === 'string') return cleanMessage(item);
          if (item && typeof item === 'object') {
            const it = item as { loc?: unknown[]; msg?: unknown };
            const msg = typeof it.msg === 'string' ? cleanMessage(it.msg) : '';
            const field = Array.isArray(it.loc)
              ? String(it.loc[it.loc.length - 1] ?? '')
              : '';
            if (!msg) return '';
            return field && field !== 'body' && !/^\d+$/.test(field)
              ? `${field.replace(/_/g, ' ')}: ${msg}`
              : msg;
          }
          return '';
        })
        .filter(Boolean);
      return parts.length ? parts.join('; ') : null;
    }
    if (v && typeof v === 'object') {
      // e.g. tier limits: {error, message, upgrade_url}
      const o = v as Record<string, unknown>;
      return fromField(o.message) || fromField(o.error);
    }
    return null;
  }

  // Backend validation handler: {"error": "Validation error", "details": [{field, message}]}
  if (Array.isArray(body.details) && body.details.length) {
    const parts = body.details
      .map((d) => {
        const it = d as { field?: unknown; message?: unknown };
        const msg = typeof it?.message === 'string' ? cleanMessage(it.message) : '';
        const field = typeof it?.field === 'string' ? it.field.split(/\s*->\s*|\./).pop() || '' : '';
        if (!msg) return '';
        return field && field !== 'body' && !/^\d+$/.test(field) ? `${field.replace(/_/g, ' ')}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }

  return fromField(body.error) || fromField(body.detail) || fromField(body.message);
}

/** True when the request was cancelled on purpose (AbortController / axios cancel). */
export function isRequestCancelled(err: unknown): boolean {
  return axios.isCancel(err) || (err as { code?: string } | null)?.code === 'ERR_CANCELED';
}

/** One clear, human message for any error thrown by an API call. Never throws. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isRequestCancelled(err)) return 'The request was cancelled.';

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;

    if (!err.response) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || /timeout/i.test(err.message)) {
        return 'The server took too long to respond. Please try again, or try a smaller file.';
      }
      return "We couldn't reach the server. Check your internet connection and try again.";
    }

    const fromServer = messageFromBody(err.response.data);

    // Server-provided text is the most specific thing we have for client errors.
    if (fromServer && status && status < 500) return fromServer;

    if (status === 413) return 'This file is too large to upload. Please choose a smaller file.';
    if (status === 429) return 'Too many requests right now. Please wait a minute and try again.';
    if (status === 408 || status === 504) {
      return 'The server took too long to finish. Please try again, or try a smaller file.';
    }
    if (status === 502 || status === 503) {
      return 'The service is temporarily unavailable. Please try again in a moment.';
    }
    if (status && status >= 500) {
      return fromServer && !/^internal server error$/i.test(fromServer)
        ? fromServer
        : 'Something went wrong on our side. Please try again in a moment.';
    }
    if (status === 401 || status === 403) return fromServer || 'You are not allowed to do that.';
    if (status === 404) return fromServer || 'We could not find what you asked for.';
    return fromServer || fallback;
  }

  if (err instanceof Error && err.message && !GENERIC_STATUS_TEXT.test(err.message)) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && !isRequestCancelled(error)) {
      const message = getErrorMessage(error);
      (error as AxiosError & { userMessage?: string }).userMessage = message;
      error.message = message;
      const data = error.response?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        (data as Record<string, unknown>).detail = message;
      }
    }
    return Promise.reject(error);
  }
);

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
export async function mergePdfs(files: File[], config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post('/pdf/merge', formData, config);
  return response.data;
}

export async function splitPdf(file: File, pages: string, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages);
  const response = await api.post('/pdf/split', formData, config);
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
  options: CompressOptions | 'extreme' | 'low' | 'medium' | 'high',
  config?: RequestConfig
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

  const response = await api.post('/pdf/compress', formData, config);
  return response.data;
}

export async function rotatePdf(
  file: File,
  rotation: number,
  pages: string = 'all',
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('rotation', rotation.toString());
  formData.append('pages', pages);
  const response = await api.post('/pdf/rotate', formData, config);
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
  } = {},
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text', text);
  if (options.position) formData.append('position', options.position);
  if (options.opacity !== undefined) formData.append('opacity', options.opacity.toString());
  if (options.rotation !== undefined) formData.append('rotation', options.rotation.toString());
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.color) formData.append('color', options.color);
  if (options.pages) formData.append('pages', options.pages);
  const response = await api.post('/pdf/watermark', formData, config);
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
  } = {},
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.position) formData.append('position', options.position);
  if (options.startNumber) formData.append('start_number', options.startNumber.toString());
  if (options.formatTemplate) formData.append('format_template', options.formatTemplate);
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.margin) formData.append('margin', options.margin.toString());
  const response = await api.post('/pdf/page-numbers', formData, config);
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
  },
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.userPassword) formData.append('user_password', options.userPassword);
  if (options.ownerPassword) formData.append('owner_password', options.ownerPassword);
  formData.append('allow_printing', String(options.allowPrinting ?? true));
  formData.append('allow_copying', String(options.allowCopying ?? false));
  formData.append('allow_modifying', String(options.allowModifying ?? false));
  const response = await api.post('/pdf/protect', formData, config);
  return response.data;
}

export async function unlockPdf(file: File, password: string, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);
  const response = await api.post('/pdf/unlock', formData, config);
  return response.data;
}

export async function organizePdf(file: File, pageOrder: number[], config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page_order', pageOrder.join(','));
  const response = await api.post('/pdf/organize', formData, config);
  return response.data;
}

export async function deletePdfPages(file: File, pages: number[], config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages.join(','));
  const response = await api.post('/pdf/delete-pages', formData, config);
  return response.data;
}

export async function extractPdfPages(file: File, pages: number[], config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages.join(','));
  const response = await api.post('/pdf/extract-pages', formData, config);
  return response.data;
}

// Image endpoints
// Every image response carries `data.metadata` with at least original_size and output_size.
export interface ImageStats {
  original_size?: number;
  output_size?: number;
}
export interface CompressImageStats extends ImageStats {
  compressed_size?: number;
  saved_bytes?: number;
  /** Percent saved (0-100). */
  compression_ratio?: number;
  format?: string;
  method?: string;
  /** True when the image could not be made smaller: the original bytes are returned. */
  kept_original?: boolean;
  metadata_removed?: boolean;
  had_location_data?: boolean;
  animated?: boolean;
}
export interface ResizeImageStats extends ImageStats {
  original_width?: number;
  original_height?: number;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'exact';
  upscaled?: boolean;
  animation_dropped?: boolean;
}
export interface ConvertImageStats extends ImageStats {
  source_format?: string;
  target_format?: string;
  animation_dropped?: boolean;
  flattened_transparency?: boolean;
}
export interface RemoveBackgroundStats extends ImageStats {
  width?: number;
  height?: number;
  has_transparency?: boolean;
  matting?: boolean;
}
export interface WatermarkImageStats extends ImageStats {
  watermark_type?: 'text' | 'image';
  font?: string;
  font_size_px?: number;
  position?: string;
  animation_dropped?: boolean;
}

/** TaskResponse whose `data.metadata` is typed for an image tool. */
export type ImageTaskResponse<M extends ImageStats> = Omit<TaskResponse, 'data'> & {
  data: Omit<TaskResponse['data'], 'metadata'> & { metadata?: M };
};

export async function compressImage(
  file: File,
  quality: number,
  config?: RequestConfig & { stripMetadata?: boolean }
): Promise<ImageTaskResponse<CompressImageStats>> {
  const { stripMetadata, ...req } = config ?? {};
  const formData = new FormData();
  formData.append('file', file);
  formData.append('quality', quality.toString());
  if (stripMetadata !== undefined) formData.append('strip_metadata', String(stripMetadata));
  const response = await api.post('/image/compress', formData, req);
  return response.data;
}

export interface ResizeImageExtras {
  fit?: 'contain' | 'cover' | 'exact';
  /** Scale both sides by this percent (1-1000) instead of width/height. */
  percentage?: number;
  noUpscale?: boolean;
  /** JPEG/WebP output quality 1-100. */
  quality?: number;
}

export async function resizeImage(
  file: File,
  width?: number,
  height?: number,
  maintainRatio?: boolean,
  config?: RequestConfig & ResizeImageExtras
): Promise<ImageTaskResponse<ResizeImageStats>> {
  const { fit, percentage, noUpscale, quality, ...req } = config ?? {};
  const formData = new FormData();
  formData.append('file', file);
  if (width) formData.append('width', width.toString());
  if (height) formData.append('height', height.toString());
  if (maintainRatio !== undefined) formData.append('maintain_ratio', maintainRatio.toString());
  if (fit) formData.append('fit', fit);
  if (percentage) formData.append('percentage', percentage.toString());
  if (noUpscale) formData.append('no_upscale', 'true');
  if (quality) formData.append('quality', quality.toString());
  const response = await api.post('/image/resize', formData, req);
  return response.data;
}

export async function convertImage(
  file: File,
  format: string,
  quality: number,
  config?: RequestConfig & { background?: string }
): Promise<ImageTaskResponse<ConvertImageStats>> {
  const { background, ...req } = config ?? {};
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);
  formData.append('quality', quality.toString());
  if (background) formData.append('background', background);
  const response = await api.post('/image/convert', formData, req);
  return response.data;
}

export interface RemoveBackgroundOptions {
  /** 'transparent' (default), 'white', 'black' or '#RRGGBB'. */
  bgColor?: string;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  /** Skip alpha matting: quicker, softer hair and fine edges. */
  fastMode?: boolean;
}

export async function removeBackground(
  file: File,
  options: RemoveBackgroundOptions = {},
  config?: RequestConfig
): Promise<ImageTaskResponse<RemoveBackgroundStats>> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.bgColor && options.bgColor !== 'transparent') formData.append('bg_color', options.bgColor);
  if (options.outputFormat) formData.append('output_format', options.outputFormat);
  if (options.quality) formData.append('quality', options.quality.toString());
  if (options.fastMode) formData.append('fast_mode', 'true');
  const response = await api.post('/image/remove-background', formData, config);
  return response.data;
}

export interface ImageWatermarkOptions {
  /** top|center|bottom x left|center|right (e.g. "top-left", "center") or "tile". */
  position?: string;
  opacity?: number;
  /** Size for a 1000 px wide picture; the server scales it with the image. */
  fontSize?: number;
  color?: string;
  /** Degrees, clockwise. */
  rotation?: number;
  /** Logo to use instead of (or without) text. */
  image?: File;
  /** Logo width as percent of the image width (2-100). */
  imageScale?: number;
}

export async function addImageWatermark(
  file: File,
  text: string,
  options: ImageWatermarkOptions = {},
  config?: RequestConfig
): Promise<ImageTaskResponse<WatermarkImageStats>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text', text);
  if (options.position) formData.append('position', options.position);
  if (options.opacity) formData.append('opacity', options.opacity.toString());
  if (options.fontSize) formData.append('font_size', options.fontSize.toString());
  if (options.color) formData.append('color', options.color);
  if (options.rotation !== undefined) formData.append('rotation', options.rotation.toString());
  if (options.image) {
    formData.append('watermark_image', options.image);
    if (options.imageScale) formData.append('image_scale', options.imageScale.toString());
  }
  const response = await api.post('/image/watermark', formData, config);
  return response.data;
}

// Document endpoints
export async function wordToPdf(file: File, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/word-to-pdf', formData, config);
  return response.data;
}

export interface PdfToWordOptions {
  quality?: 'draft' | 'standard' | 'high';
  lang?: string;
}

export async function pdfToWord(
  file: File,
  options: PdfToWordOptions = {},
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.quality) formData.append('quality', options.quality);
  if (options.lang) formData.append('lang', options.lang);
  const response = await api.post('/document/pdf-to-word', formData, config);
  return response.data;
}

export async function excelToPdf(file: File, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/excel-to-pdf', formData, config);
  return response.data;
}

// PDF to PowerPoint
export async function pdfToPowerPoint(
  file: File,
  dpi: number = 150,
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dpi', dpi.toString());
  const response = await api.post('/pdf/to-powerpoint', formData, config);
  return response.data;
}

// PDF Redact
export async function redactPdf(
  file: File,
  searchTerms: string[],
  redactColor?: string,
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('search_terms', searchTerms.join(','));
  if (redactColor) formData.append('redact_color', redactColor);
  const response = await api.post('/pdf/redact', formData, config);
  return response.data;
}

export async function redactPdfPatterns(
  file: File,
  patternTypes: ('email' | 'phone' | 'ssn' | 'credit_card' | 'custom')[],
  customPattern?: string,
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pattern_types', patternTypes.join(','));
  if (customPattern) formData.append('custom_pattern', customPattern);
  const response = await api.post('/pdf/redact-patterns', formData, config);
  return response.data;
}

// PDF Compare
export async function comparePdfs(
  file1: File,
  file2: File,
  outputMode: 'visual' | 'text' = 'visual',
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file1', file1);
  formData.append('file2', file2);
  formData.append('output_mode', outputMode);
  const response = await api.post('/pdf/compare', formData, config);
  return response.data;
}

// PDF to PDF/A
export async function pdfToPdfA(
  file: File,
  level: '1b' | '2b' | '3b' = '2b',
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('level', level);
  const response = await api.post('/pdf/to-pdfa', formData, config);
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
  } = {},
  config?: RequestConfig
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
  const response = await api.post('/pdf/add-text', formData, config);
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
  } = {},
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('image', image);
  formData.append('page', page.toString());
  formData.append('x', x.toString());
  formData.append('y', y.toString());
  if (options.width) formData.append('width', options.width.toString());
  if (options.height) formData.append('height', options.height.toString());
  const response = await api.post('/pdf/add-image-overlay', formData, config);
  return response.data;
}

export async function addCommentToPdf(
  file: File,
  page: number,
  x: number,
  y: number,
  comment: string,
  author?: string,
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('page', page.toString());
  formData.append('x', x.toString());
  formData.append('y', y.toString());
  formData.append('comment', comment);
  if (author) formData.append('author', author);
  const response = await api.post('/pdf/add-comment', formData, config);
  return response.data;
}

// PDF Crop
export async function cropPdf(
  file: File,
  left: number,
  top: number,
  right: number,
  bottom: number,
  pages: string = 'all',
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('left', left.toString());
  formData.append('top', top.toString());
  formData.append('right', right.toString());
  formData.append('bottom', bottom.toString());
  formData.append('pages', pages);
  const response = await api.post('/pdf/crop', formData, config);
  return response.data;
}

// PDF Repair
export async function repairPdf(file: File, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pdf/repair', formData, config);
  return response.data;
}

// Image to PDF
export async function imageToPdf(files: File[], config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post('/pdf/from-image', formData, config);
  return response.data;
}

// PDF to Excel
export async function pdfToExcel(file: File, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pdf/to-excel', formData, config);
  return response.data;
}

// HTML to PDF
export async function htmlToPdf(
  url: string,
  options: {
    pageSize?: string;
    orientation?: string;
  } = {},
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('url', url);
  if (options.pageSize) formData.append('page_size', options.pageSize);
  if (options.orientation) formData.append('orientation', options.orientation);
  const response = await api.post('/document/html-to-pdf', formData, config);
  return response.data;
}

// PowerPoint to PDF
export async function pptxToPdf(file: File, config?: RequestConfig): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/document/pptx-to-pdf', formData, config);
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
  } = {},
  config?: RequestConfig
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
  const response = await api.post('/pdf/find-text', formData, config);
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
  replacements: TextReplacement[],
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('replacements', JSON.stringify(replacements));
  const response = await api.post('/pdf/replace-text', formData, config);
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
export async function getFormFields(file: File, config?: RequestConfig): Promise<FormFieldsResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/pdf/form-fields', formData, config);
  return response.data;
}

// Fill form in PDF
export async function fillFormPdf(
  file: File,
  fieldValues: Record<string, string | boolean>,
  flatten: boolean = false,
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('field_values', JSON.stringify(fieldValues));
  formData.append('flatten', String(flatten));
  const response = await api.post('/pdf/fill-form', formData, config);
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
  images?: File[],
  config?: RequestConfig
): Promise<TaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('operations', JSON.stringify(operations));
  if (images && images.length > 0) {
    images.forEach((img) => formData.append('images', img));
  }
  const response = await api.post('/pdf/edit', formData, config);
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
export async function mergePdfsAsync(files: File[], config?: RequestConfig): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post('/pdf/merge/async', formData, config);
  return response.data;
}

// Compress PDF (async)
export async function compressPdfAsync(
  file: File,
  options: CompressOptions | 'extreme' | 'low' | 'medium' | 'high',
  config?: RequestConfig
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

  const response = await api.post('/pdf/compress/async', formData, config);
  return response.data;
}

// Split PDF (async)
export async function splitPdfAsync(file: File, pages: string, config?: RequestConfig): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pages', pages);
  const response = await api.post('/pdf/split/async', formData, config);
  return response.data;
}

// Rotate PDF (async)
export async function rotatePdfAsync(
  file: File,
  rotation: number,
  pages: string = 'all',
  config?: RequestConfig
): Promise<AsyncTaskResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('rotation', rotation.toString());
  formData.append('pages', pages);
  const response = await api.post('/pdf/rotate/async', formData, config);
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
  } = {},
  config?: RequestConfig
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
  const response = await api.post('/pdf/watermark/async', formData, config);
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
