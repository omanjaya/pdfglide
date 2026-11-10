'use client';

import { useRef, useState } from 'react';
import { Highlighter, Image as ImageIcon, MessageCircle, PenTool, Square, Type } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { PdfVisualEditor } from '@/components/pdf-editor/PdfVisualEditor';
import { useToolRun } from '@/hooks/useToolRun';
import { editPdfCombined, EditOperation, TaskResponse } from '@/lib/api';
import {
  Annotation,
  TextAnnotation,
  ImageAnnotation,
  RectangleAnnotation,
  LineAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
} from '@/types/pdf-editor';

function toOperations(annotations: Annotation[], imageFiles: File[]): EditOperation[] {
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
  }

export default function VisualEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  // The editor stays mounted (hidden) while saving, so a cancel or an error brings the user back to their edits.
  const lastSave = useRef<{ annotations: Annotation[]; imageFiles: File[] } | null>(null);
  const file = files[0];
  const editing = !!file && run.status === 'idle';

  const save = (annotations: Annotation[], imageFiles: File[]) => {
    if (!file || annotations.length === 0) return;
    lastSave.current = { annotations, imageFiles };
    run.run((req) =>
      editPdfCombined(file, toOperations(annotations, imageFiles), imageFiles.length > 0 ? imageFiles : undefined, req)
    );
  };
  const retry = () => lastSave.current && save(lastSave.current.annotations, lastSave.current.imageFiles);
  const startOver = () => {
    run.reset();
    setFiles([]);
    lastSave.current = null;
  };

  return (
    <>
      {file && (
        <div className={editing ? 'h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-100' : 'hidden'}>
          <PdfVisualEditor file={file} onSave={save} onCancel={startOver} />
        </div>
      )}

      {!editing && (
        <ToolLayout
          title="Visual PDF Editor"
          description="Add text, images, shapes, and annotations to your PDF visually"
          icon={PenTool}
          tone="indigo"
          status={run.announcement}
        >
          {run.status === 'idle' && (
            <ToolPanel aria-label="Open a PDF in the visual editor">
              <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="indigo" typeLabel="PDF" title="Drag & drop the PDF to edit" />
              <FeatureGrid
                tone="indigo"
                items={[
                  { icon: Type, label: 'Text and images', desc: 'Insert them anywhere on a page' },
                  { icon: Square, label: 'Shapes and lines', desc: 'Rectangles, lines and arrows' },
                  { icon: Highlighter, label: 'Highlights', desc: 'Mark content on the page' },
                ]}
              />
              <InfoNote icon={<MessageCircle className="h-4 w-4" />} className="mt-4">
                The PDF opens in the editor next. Add sticky-note comments, move things around, then save to get the
                edited PDF.
              </InfoNote>
              <TrustStrip />
            </ToolPanel>
          )}

          {run.isBusy && (
            <ProcessingCard
              stage={run.status === 'uploading' ? 'uploading' : 'processing'}
              progress={run.uploadProgress}
              loaded={run.uploadLoaded}
              total={run.uploadTotal}
              fileName={file?.name}
              fileSize={file?.size}
              title="Applying your edits"
              hint="Your edits stay in the editor if you cancel."
              tone="indigo"
              onCancel={run.cancel}
            />
          )}

          {run.status === 'done' && run.result && (
            <ResultCard
              title="Your edited PDF is ready"
              fileName={run.result.file_name}
              fileSize={run.result.file_size}
              downloadUrl={run.result.download_url}
              downloadLabel="Download edited PDF"
              resetLabel="Edit another PDF"
              onReset={startOver}
              tone="indigo"
            />
          )}

          {run.status === 'error' && (
            <ErrorCard
              message={run.error || 'Something went wrong.'}
              fileName={file?.name}
              fileSize={file?.size}
              onRetry={retry}
              onEdit={run.backToEdit}
              editLabel="Back to the editor"
              onReset={startOver}
            />
          )}
        </ToolLayout>
      )}
    </>
  );
}
