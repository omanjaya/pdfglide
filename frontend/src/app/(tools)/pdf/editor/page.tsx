'use client';

import { useEffect, useState } from 'react';
import { Edit3, Image as ImageIcon, MessageSquare, Move, Type } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { addTextToPdf, addImageToPdf, addCommentToPdf, TaskResponse } from '@/lib/api';

type EditMode = 'text' | 'image' | 'comment';

const MODE_OPTIONS: { value: EditMode; label: string; description: string }[] = [
  { value: 'text', label: 'Add text', description: 'Insert text at any position' },
  { value: 'image', label: 'Add image', description: 'Place an image on a page' },
  { value: 'comment', label: 'Add comment', description: 'Annotate with a note' },
];

const VERBS: Record<EditMode, string> = {
  text: 'Adding your text',
  image: 'Placing your image',
  comment: 'Adding your comment',
};

const INPUT =
  'min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/30';

export default function PdfEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<EditMode>('text');
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(12);
  const [page, setPage] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [comment, setComment] = useState('');
  const [author, setAuthor] = useState('');
  const [imageWidth, setImageWidth] = useState<number | undefined>();
  const [imageHeight, setImageHeight] = useState<number | undefined>();
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];
  const image = images[0];

  useEffect(() => {
    if (!image) return setPreview(null);
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const ready = mode === 'text' ? !!text.trim() : mode === 'image' ? !!image : !!comment.trim();

  const apply = () => {
    if (!file || !ready) return;
    run.run((req) => {
      if (mode === 'text') return addTextToPdf(file, text, page, x, y, { fontSize }, req);
      if (mode === 'image') return addImageToPdf(file, image, page, x, y, { width: imageWidth, height: imageHeight }, req);
      return addCommentToPdf(file, page, x, y, comment, author || undefined, req);
    });
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setImages([]);
    setMode('text');
    setText('');
    setFontSize(12);
    setPage(1);
    setX(50);
    setY(50);
    setComment('');
    setAuthor('');
    setImageWidth(undefined);
    setImageHeight(undefined);
  };

  return (
    <ToolLayout
      title="PDF Editor"
      description="Add text, images, and comments to your PDF documents"
      icon={Edit3}
      tone="purple"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Edit a PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="purple" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="purple"
              items={[
                { icon: Type, label: 'Add text', desc: 'Choose position and size' },
                { icon: ImageIcon, label: 'Add images', desc: 'Place a picture on a page' },
                { icon: MessageSquare, label: 'Add comments', desc: 'Leave a note on a page' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Edit type">
                <ChoiceGroup label="What to add" value={mode} onChange={setMode} options={MODE_OPTIONS} tone="purple" columns={3} />
              </OptionsPanel>

              <OptionsPanel title="Position" icon={Move} description="Page number and position from the bottom-left corner, in points.">
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <Field label="Page">
                    <input type="number" inputMode="numeric" min={1} value={page} onChange={(e) => setPage(parseInt(e.target.value) || 1)} className={INPUT} />
                  </Field>
                  <Field label="X position">
                    <input type="number" inputMode="numeric" min={0} value={x} onChange={(e) => setX(parseInt(e.target.value) || 0)} className={INPUT} />
                  </Field>
                  <Field label="Y position">
                    <input type="number" inputMode="numeric" min={0} value={y} onChange={(e) => setY(parseInt(e.target.value) || 0)} className={INPUT} />
                  </Field>
                </div>
              </OptionsPanel>

              {mode === 'text' && (
                <OptionsPanel title="Text content">
                  <Field label="Text">
                    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to add..." rows={3} className={INPUT} />
                  </Field>
                  <Field label={`Font size: ${fontSize}px`} hint="Between 8px and 72px.">
                    <input type="range" min={8} max={72} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className="min-h-[44px] w-full accent-purple-700" />
                  </Field>
                </OptionsPanel>
              )}

              {mode === 'image' && (
                <OptionsPanel title="Image settings">
                  <FileUploader
                    accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/gif': ['.gif'] }}
                    multiple={false}
                    files={images}
                    onFilesChange={setImages}
                    tone="purple"
                    typeLabel="PNG or JPG"
                    title="Drag & drop the image to place"
                  />
                  {preview && (
                    <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="Preview of the image to place" className="max-h-32 rounded" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Width (optional)">
                      <input type="number" inputMode="numeric" min={1} value={imageWidth || ''} placeholder="Auto" onChange={(e) => setImageWidth(e.target.value ? parseInt(e.target.value) : undefined)} className={INPUT} />
                    </Field>
                    <Field label="Height (optional)">
                      <input type="number" inputMode="numeric" min={1} value={imageHeight || ''} placeholder="Auto" onChange={(e) => setImageHeight(e.target.value ? parseInt(e.target.value) : undefined)} className={INPUT} />
                    </Field>
                  </div>
                </OptionsPanel>
              )}

              {mode === 'comment' && (
                <OptionsPanel title="Comment content">
                  <Field label="Comment">
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Enter your comment..." rows={3} className={INPUT} />
                  </Field>
                  <Field label="Author (optional)">
                    <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" className={INPUT} />
                  </Field>
                </OptionsPanel>
              )}

              <div className="flex flex-col items-center gap-2">
                <PrimaryButton tone="purple" icon={<Edit3 className="h-5 w-5" />} onClick={apply} disabled={!ready}>
                  Apply edit
                </PrimaryButton>
                {!ready && (
                  <p className="text-xs text-gray-600">
                    {mode === 'text' ? 'Enter the text to add.' : mode === 'image' ? 'Choose an image to add.' : 'Enter the comment to add.'}
                  </p>
                )}
              </div>
            </div>
          )}
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
          title={VERBS[mode]}
          tone="purple"
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
          tone="purple"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={apply}
          onEdit={run.backToEdit}
          editLabel="Change the edit"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
