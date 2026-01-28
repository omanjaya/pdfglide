'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MousePointer2,
  Type,
  Image as ImageIcon,
  Square,
  Minus,
  Highlighter,
  MessageSquare,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  Trash2,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePdfRenderer } from '@/hooks/usePdfRenderer';
import {
  Annotation,
  EditorTool,
  TextAnnotation,
  RectangleAnnotation,
  LineAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
  ImageAnnotation,
  generateAnnotationId,
  DEFAULT_TEXT_PROPS,
  DEFAULT_RECTANGLE_PROPS,
  DEFAULT_LINE_PROPS,
  DEFAULT_HIGHLIGHT_PROPS,
  DEFAULT_COMMENT_PROPS,
} from '@/types/pdf-editor';

interface PdfVisualEditorProps {
  file: File;
  onSave: (annotations: Annotation[], imageFiles: File[]) => void;
  onCancel: () => void;
}

export function PdfVisualEditor({ file, onSave, onCancel }: PdfVisualEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const {
    isLoading,
    error,
    totalPages,
    currentPage,
    pageInfo,
    zoom,
    setCurrentPage,
    setZoom,
    renderPage,
    loadPdf,
  } = usePdfRenderer();

  const [selectedTool, setSelectedTool] = useState<EditorTool>('select');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  // Text input state
  const [textInput, setTextInput] = useState('');
  const [commentInput, setCommentInput] = useState('');

  // Load PDF on mount
  useEffect(() => {
    loadPdf(file);
  }, [file, loadPdf]);

  // Render page when it changes
  useEffect(() => {
    if (canvasRef.current && !isLoading && totalPages > 0) {
      renderPage(canvasRef.current);
    }
  }, [currentPage, zoom, isLoading, totalPages, renderPage]);

  // Get relative position from mouse event
  const getRelativePosition = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current) return null;

      const rect = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      return { x, y };
    },
    [zoom]
  );

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const pos = getRelativePosition(e);
      if (!pos) return;

      if (selectedTool === 'select') {
        const clickedAnnotation = annotations.find((ann) => {
          if (ann.page !== currentPage) return false;
          const dx = pos.x - ann.x;
          const dy = pos.y - ann.y;
          return dx >= 0 && dx <= 100 && dy >= -20 && dy <= 20;
        });

        setSelectedAnnotation(clickedAnnotation?.id || null);
        return;
      }

      if (selectedTool === 'text' && textInput.trim()) {
        const newAnnotation: TextAnnotation = {
          id: generateAnnotationId(),
          type: 'text',
          page: currentPage,
          x: pos.x,
          y: pos.y,
          text: textInput,
          ...DEFAULT_TEXT_PROPS,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
        setTextInput('');
      }

      if (selectedTool === 'comment' && commentInput.trim()) {
        const newAnnotation: CommentAnnotation = {
          id: generateAnnotationId(),
          type: 'comment',
          page: currentPage,
          x: pos.x,
          y: pos.y,
          content: commentInput,
          ...DEFAULT_COMMENT_PROPS,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
        setCommentInput('');
      }

      if (selectedTool === 'highlight') {
        const newAnnotation: HighlightAnnotation = {
          id: generateAnnotationId(),
          type: 'highlight',
          page: currentPage,
          x: pos.x,
          y: pos.y,
          width: 100,
          height: 20,
          ...DEFAULT_HIGHLIGHT_PROPS,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
      }
    },
    [selectedTool, currentPage, annotations, textInput, commentInput, getRelativePosition]
  );

  // Handle mouse down for drawing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (selectedTool === 'rectangle' || selectedTool === 'line') {
        const pos = getRelativePosition(e);
        if (pos) {
          setIsDragging(true);
          setDragStart(pos);
        }
      }
    },
    [selectedTool, getRelativePosition]
  );

  // Handle mouse up for drawing
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart) return;

      const pos = getRelativePosition(e);
      if (!pos) return;

      if (selectedTool === 'rectangle') {
        const width = Math.abs(pos.x - dragStart.x);
        const height = Math.abs(pos.y - dragStart.y);
        const x = Math.min(pos.x, dragStart.x);
        const y = Math.min(pos.y, dragStart.y);

        if (width > 5 && height > 5) {
          const newAnnotation: RectangleAnnotation = {
            id: generateAnnotationId(),
            type: 'rectangle',
            page: currentPage,
            x,
            y,
            width,
            height,
            ...DEFAULT_RECTANGLE_PROPS,
          };
          setAnnotations((prev) => [...prev, newAnnotation]);
        }
      }

      if (selectedTool === 'line') {
        const newAnnotation: LineAnnotation = {
          id: generateAnnotationId(),
          type: 'line',
          page: currentPage,
          x: dragStart.x,
          y: dragStart.y,
          x2: pos.x,
          y2: pos.y,
          ...DEFAULT_LINE_PROPS,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
      }

      setIsDragging(false);
      setDragStart(null);
    },
    [isDragging, dragStart, selectedTool, currentPage, getRelativePosition]
  );

  // Handle image upload
  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const newAnnotation: ImageAnnotation = {
          id: generateAnnotationId(),
          type: 'image',
          page: currentPage,
          x: 100,
          y: 100,
          imageData: reader.result as string,
          imageFile: file,
          width: 150,
          height: 100,
          opacity: 1,
          rotation: 0,
        };
        setAnnotations((prev) => [...prev, newAnnotation]);
        setImageFiles((prev) => [...prev, file]);
      };
      reader.readAsDataURL(file);
    },
    [currentPage]
  );

  // Delete selected annotation
  const handleDeleteAnnotation = useCallback(() => {
    if (selectedAnnotation) {
      setAnnotations((prev) => prev.filter((ann) => ann.id !== selectedAnnotation));
      setSelectedAnnotation(null);
    }
  }, [selectedAnnotation]);

  // Handle save
  const handleSave = useCallback(() => {
    onSave(annotations, imageFiles);
  }, [annotations, imageFiles, onSave]);

  // Get selected annotation
  const selected = annotations.find((ann) => ann.id === selectedAnnotation);

  // Current page annotations
  const pageAnnotations = annotations.filter((ann) => ann.page === currentPage);

  // Tool buttons
  const tools = [
    { id: 'select' as EditorTool, icon: MousePointer2, label: 'Select' },
    { id: 'text' as EditorTool, icon: Type, label: 'Text' },
    { id: 'image' as EditorTool, icon: ImageIcon, label: 'Image' },
    { id: 'rectangle' as EditorTool, icon: Square, label: 'Rect' },
    { id: 'line' as EditorTool, icon: Minus, label: 'Line' },
    { id: 'highlight' as EditorTool, icon: Highlighter, label: 'Highlight' },
    { id: 'comment' as EditorTool, icon: MessageSquare, label: 'Note' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 sm:h-96">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 sm:h-96">
        <p className="text-red-500 text-sm sm:text-base">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-2 sm:p-3 border-b bg-muted/30 gap-2">
        {/* Tools */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedTool(tool.id)}
              title={tool.label}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0"
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          ))}

          {selectedTool === 'image' && (
            <Input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-28 sm:w-36 h-8 text-xs"
            />
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(zoom - 0.25)}
              disabled={zoom <= 0.25}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(zoom + 0.25)}
              disabled={zoom >= 4}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs w-12 text-center">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile panel toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPanel(!showPanel)}
            className="h-8 w-8 p-0 lg:hidden"
          >
            <Settings2 className="h-4 w-4" />
          </Button>

          {/* Action buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} className="h-8">
              <X className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
            <Button size="sm" onClick={handleSave} className="h-8">
              <Save className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-2 sm:p-4">
          <div
            className="relative inline-block shadow-lg bg-white mx-auto"
            style={{
              width: pageInfo ? pageInfo.width * zoom : 'auto',
              height: pageInfo ? pageInfo.height * zoom : 'auto',
            }}
          >
            <canvas ref={canvasRef} className="block" />

            {/* Annotation overlay */}
            <div
              ref={overlayRef}
              className="absolute inset-0 cursor-crosshair"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
            >
              {pageAnnotations.map((ann) => (
                <div
                  key={ann.id}
                  className={`absolute ${
                    ann.id === selectedAnnotation
                      ? 'ring-2 ring-primary ring-offset-1'
                      : ''
                  }`}
                  style={{
                    left: ann.x * zoom,
                    top: ann.y * zoom,
                    transform: 'translate(0, -50%)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAnnotation(ann.id);
                  }}
                >
                  {ann.type === 'text' && (
                    <span
                      style={{
                        fontSize: ann.fontSize * zoom,
                        color: ann.color,
                        opacity: ann.opacity,
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ann.text}
                    </span>
                  )}

                  {ann.type === 'rectangle' && (
                    <div
                      style={{
                        width: ann.width * zoom,
                        height: ann.height * zoom,
                        border: ann.strokeColor
                          ? `${ann.strokeWidth}px solid ${ann.strokeColor}`
                          : 'none',
                        backgroundColor: ann.fillColor || 'transparent',
                        opacity: ann.opacity,
                        transform: 'translate(0, 50%)',
                      }}
                    />
                  )}

                  {ann.type === 'highlight' && (
                    <div
                      style={{
                        width: ann.width * zoom,
                        height: ann.height * zoom,
                        backgroundColor: ann.color,
                        opacity: ann.opacity,
                        transform: 'translate(0, 50%)',
                      }}
                    />
                  )}

                  {ann.type === 'comment' && (
                    <div
                      className="bg-yellow-100 border border-yellow-300 p-1 rounded shadow-sm"
                      style={{ fontSize: 10 * zoom }}
                    >
                      <MessageSquare
                        className="h-3 w-3 text-yellow-600"
                        style={{ transform: `scale(${zoom})` }}
                      />
                    </div>
                  )}

                  {ann.type === 'image' && (
                    <img
                      src={ann.imageData}
                      alt="Annotation"
                      style={{
                        width: ann.width * zoom,
                        height: ann.height * zoom,
                        opacity: ann.opacity,
                        transform: `rotate(${ann.rotation}deg) translate(0, 50%)`,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Properties panel - Desktop */}
        <div className={`w-56 lg:w-64 border-l bg-background p-3 overflow-auto hidden lg:block`}>
          <PropertiesPanel
            selectedTool={selectedTool}
            textInput={textInput}
            setTextInput={setTextInput}
            commentInput={commentInput}
            setCommentInput={setCommentInput}
            selected={selected}
            annotations={annotations}
            onDelete={handleDeleteAnnotation}
          />
        </div>

        {/* Properties panel - Mobile */}
        {showPanel && (
          <div className="absolute inset-x-0 bottom-0 z-10 bg-background border-t p-3 lg:hidden max-h-[40vh] overflow-auto">
            <PropertiesPanel
              selectedTool={selectedTool}
              textInput={textInput}
              setTextInput={setTextInput}
              commentInput={commentInput}
              setCommentInput={setCommentInput}
              selected={selected}
              annotations={annotations}
              onDelete={handleDeleteAnnotation}
            />
          </div>
        )}
      </div>

      {/* Mobile action buttons */}
      <div className="flex sm:hidden items-center justify-end gap-2 p-2 border-t">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// Properties panel component
function PropertiesPanel({
  selectedTool,
  textInput,
  setTextInput,
  commentInput,
  setCommentInput,
  selected,
  annotations,
  onDelete,
}: {
  selectedTool: EditorTool;
  textInput: string;
  setTextInput: (v: string) => void;
  commentInput: string;
  setCommentInput: (v: string) => void;
  selected: Annotation | undefined;
  annotations: Annotation[];
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Properties</h3>

        {selectedTool === 'text' && (
          <div className="space-y-2">
            <Label className="text-xs">Text to add</Label>
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Click on PDF to place text
            </p>
          </div>
        )}

        {selectedTool === 'comment' && (
          <div className="space-y-2">
            <Label className="text-xs">Comment</Label>
            <Input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Enter comment..."
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Click on PDF to place note
            </p>
          </div>
        )}

        {selectedTool === 'rectangle' && (
          <p className="text-xs text-muted-foreground">
            Click and drag to draw rectangle
          </p>
        )}

        {selectedTool === 'line' && (
          <p className="text-xs text-muted-foreground">
            Click and drag to draw line
          </p>
        )}

        {selectedTool === 'highlight' && (
          <p className="text-xs text-muted-foreground">
            Click on PDF to add highlight
          </p>
        )}

        {selectedTool === 'image' && (
          <p className="text-xs text-muted-foreground">
            Select an image file above
          </p>
        )}

        {selectedTool === 'select' && (
          <p className="text-xs text-muted-foreground">
            Click on annotation to select
          </p>
        )}
      </div>

      {selected && (
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground capitalize">
              Selected: {selected.type}
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full h-8"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {annotations.length > 0 && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
