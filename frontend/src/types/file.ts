export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface ProcessedFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  expiresAt: string;
}

export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export interface ProcessingState {
  status: ProcessingStatus;
  progress: number;
  message?: string;
  result?: ProcessedFile;
  error?: string;
}
