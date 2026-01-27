'use client';

import { useState, useCallback } from 'react';
import { PenTool } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { PdfVisualEditor } from '@/components/pdf-editor/PdfVisualEditor';
import {
  editPdfCombined,
  EditOperation,
  TaskResponse,
} from '@/lib/api';
import {
  Annotation,
  TextAnnotation,
  ImageAnnotation,
  RectangleAnnotation,
  LineAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
} from '@/types/pdf-editor';

type Status = 'idle' | 'editing' | 'processing' | 'completed' | 'error';

export default function VisualEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (newFiles: File[]) => {
    setFiles(newFiles);
    if (newFiles.length > 0) {
      setStatus('editing');
    } else {
      setStatus('idle');
    }
  };

  // Convert annotations to API operations
  const convertAnnotationsToOperations = useCallback(
    (annotations: Annotation[], imageFiles: File[]): EditOperation[] => {
      const operations: EditOperation[] = [];

      annotations.forEach((ann) => {
        switch (ann.type) {
          case 'text': {
            const textAnn = ann as TextAnnotation;
            operations.push({
              type: 'text',
              text: textAnn.text,
              page: textAnn.page,
              x: textAnn.x,
              y: textAnn.y,
              font_size: textAnn.fontSize,
              font_name: textAnn.fontName,
              color: textAnn.color,
              opacity: textAnn.opacity,
            });
            break;
          }

          case 'image': {
            const imgAnn = ann as ImageAnnotation;
            const imageIndex = imageFiles.findIndex(
              (f) => f === imgAnn.imageFile
            );
            if (imageIndex >= 0) {
              operations.push({
                type: 'image',
                image_index: imageIndex,
                page: imgAnn.page,
                x: imgAnn.x,
                y: imgAnn.y,
                width: imgAnn.width,
                height: imgAnn.height,
                opacity: imgAnn.opacity,
                rotation: imgAnn.rotation,
              });
            }
            break;
          }

          case 'rectangle': {
            const rectAnn = ann as RectangleAnnotation;
            operations.push({
              type: 'rectangle',
              page: rectAnn.page,
              x: rectAnn.x,
              y: rectAnn.y,
              width: rectAnn.width,
              height: rectAnn.height,
              stroke_color: rectAnn.strokeColor || undefined,
              fill_color: rectAnn.fillColor || undefined,
              stroke_width: rectAnn.strokeWidth,
              opacity: rectAnn.opacity,
            });
            break;
          }

          case 'line': {
            const lineAnn = ann as LineAnnotation;
            operations.push({
              type: 'line',
              page: lineAnn.page,
              x1: lineAnn.x,
              y1: lineAnn.y,
              x2: lineAnn.x2,
              y2: lineAnn.y2,
              color: lineAnn.color,
              width: lineAnn.width,
              opacity: lineAnn.opacity,
            });
            break;
          }

          case 'highlight': {
            const hlAnn = ann as HighlightAnnotation;
            operations.push({
              type: 'highlight',
              page: hlAnn.page,
              x: hlAnn.x,
              y: hlAnn.y,
              width: hlAnn.width,
              height: hlAnn.height,
              color: hlAnn.color,
              opacity: hlAnn.opacity,
            });
            break;
          }

          case 'comment': {
            const cmtAnn = ann as CommentAnnotation;
            operations.push({
              type: 'comment',
              page: cmtAnn.page,
              x: cmtAnn.x,
              y: cmtAnn.y,
              content: cmtAnn.content,
              author: cmtAnn.author,
              icon: cmtAnn.icon,
            });
            break;
          }
        }
      });

      return operations;
    },
    []
  );

  const handleSave = async (annotations: Annotation[], imageFiles: File[]) => {
    if (files.length === 0 || annotations.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const operations = convertAnnotationsToOperations(annotations, imageFiles);

      const response = await editPdfCombined(
        files[0],
        operations,
        imageFiles.length > 0 ? imageFiles : undefined
      );

      if (response.success) {
        setResult(response.data);
        setStatus('completed');
      } else {
        setError(response.error || 'Processing failed');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleCancel = () => {
    setFiles([]);
    setStatus('idle');
  };

  const handleReset = () => {
    setFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Visual PDF Editor"
      description="Add text, images, shapes, and annotations to your PDF visually"
      icon={PenTool}
      color="bg-indigo-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={handleFileChange}
          />

          <p className="text-center text-xs sm:text-sm text-muted-foreground px-2">
            Upload a PDF to start editing. You can add text, images, shapes, and annotations.
          </p>
        </div>
      )}

      {status === 'editing' && files.length > 0 && (
        <div className="h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)] min-h-[450px] sm:min-h-[600px]">
          <PdfVisualEditor
            file={files[0]}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      <ProcessingStatus
        status={
          status === 'processing'
            ? 'processing'
            : status === 'completed'
            ? 'completed'
            : status === 'error' && error
            ? 'error'
            : 'idle'
        }
        message={error || undefined}
        fileName={result?.file_name}
        fileSize={result?.file_size}
        downloadUrl={result?.download_url}
        onRetry={() => setStatus('editing')}
        onReset={handleReset}
      />
    </ToolLayout>
  );
}
