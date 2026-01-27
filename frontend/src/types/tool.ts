import { LucideIcon } from 'lucide-react';

export type ToolCategory = 'pdf' | 'image' | 'document' | 'other';

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  href: string;
  icon: LucideIcon;
  color: string;
}

export interface ToolGroup {
  category: ToolCategory;
  label: string;
  icon: LucideIcon;
  color: string;
  tools: Tool[];
}

// PDF Options
export interface PDFMergeOptions {
  // No specific options
}

export interface PDFSplitOptions {
  pages: string;
}

export interface PDFCompressOptions {
  quality: 'low' | 'medium' | 'high';
}

// Image Options
export interface ImageCompressOptions {
  quality: number;
}

export interface ImageResizeOptions {
  width?: number;
  height?: number;
  maintainRatio: boolean;
}

export interface ImageConvertOptions {
  format: 'jpg' | 'png' | 'webp' | 'gif';
  quality: number;
}
