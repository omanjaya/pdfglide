/**
 * Types for the visual PDF editor.
 */

// Annotation types
export type AnnotationType =
  | 'text'
  | 'image'
  | 'rectangle'
  | 'line'
  | 'highlight'
  | 'comment';

// Base annotation interface
export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  page: number;
  x: number;
  y: number;
}

// Text annotation
export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  fontName: string;
  color: string;
  opacity: number;
}

// Image annotation
export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  imageData: string; // Base64 or blob URL
  imageFile?: File;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
}

// Rectangle annotation
export interface RectangleAnnotation extends BaseAnnotation {
  type: 'rectangle';
  width: number;
  height: number;
  strokeColor: string | null;
  fillColor: string | null;
  strokeWidth: number;
  opacity: number;
}

// Line annotation
export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  x2: number;
  y2: number;
  color: string;
  width: number;
  opacity: number;
}

// Highlight annotation
export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
  width: number;
  height: number;
  color: string;
  opacity: number;
}

// Comment annotation
export interface CommentAnnotation extends BaseAnnotation {
  type: 'comment';
  content: string;
  author: string;
  icon: string;
}

// Union type for all annotations
export type Annotation =
  | TextAnnotation
  | ImageAnnotation
  | RectangleAnnotation
  | LineAnnotation
  | HighlightAnnotation
  | CommentAnnotation;

// Editor tool types
export type EditorTool =
  | 'select'
  | 'text'
  | 'image'
  | 'rectangle'
  | 'line'
  | 'highlight'
  | 'comment';

// Editor state
export interface EditorState {
  currentPage: number;
  totalPages: number;
  zoom: number;
  selectedTool: EditorTool;
  selectedAnnotationId: string | null;
  annotations: Annotation[];
  isDirty: boolean;
}

// PDF page info
export interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

// Default values for new annotations
export const DEFAULT_TEXT_PROPS = {
  fontSize: 14,
  fontName: 'helv',
  color: '#000000',
  opacity: 1.0,
};

export const DEFAULT_RECTANGLE_PROPS = {
  strokeColor: '#000000',
  fillColor: null as string | null,
  strokeWidth: 2,
  opacity: 1.0,
};

export const DEFAULT_LINE_PROPS = {
  color: '#000000',
  width: 2,
  opacity: 1.0,
};

export const DEFAULT_HIGHLIGHT_PROPS = {
  color: '#FFFF00',
  opacity: 0.5,
};

export const DEFAULT_COMMENT_PROPS = {
  author: 'User',
  icon: 'Note',
};

// Helper to generate unique IDs
export function generateAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
