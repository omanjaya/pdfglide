'use client';

import { useEffect, useState } from 'react';
import { FileText, GripVertical, Image as ImageIcon, Layers } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { imageToPdf, TaskResponse } from '@/lib/api';

const ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

/** Numbered thumbnails in the order the pages will have. Object URLs are revoked on change. */
function PageOrder({ files }: { files: File[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = files.map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  return (
    <section aria-label="Page order preview">
      <h2 className="mb-2 text-sm font-semibold text-gray-800">Page order</h2>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {files.map((file, i) => (
          <li key={`${file.name}-${i}`} className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {urls[i] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={urls[i]} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute left-1.5 top-1.5 rounded-full bg-pink-700 px-2 py-0.5 text-xs font-medium text-white">
              <span className="sr-only">Page </span>
              {i + 1}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function ImageToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();

  const convert = () => {
    if (files.length) run.run((req) => imageToPdf(files, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };

  return (
    <ToolLayout
      title="Image to PDF"
      description="Convert multiple images into a single PDF document"
      icon={ImageIcon}
      tone="pink"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert images to PDF">
          <FileUploader
            accept={ACCEPT}
            files={files}
            onFilesChange={setFiles}
            tone="pink"
            typeLabel="JPG, PNG, WebP or GIF"
            title="Drag & drop your images here"
            hint="Up to 20 images. Each image becomes one page."
            reorderable
          />

          {files.length === 0 && (
            <FeatureGrid
              tone="pink"
              items={[
                { icon: Layers, label: 'Several images', desc: 'Up to 20 in one PDF' },
                { icon: GripVertical, label: 'Reorder pages', desc: 'Move images up or down' },
                { icon: FileText, label: 'Page = image', desc: 'Each page takes its image size' },
              ]}
            />
          )}

          {files.length > 0 && (
            <div className="mt-6 space-y-5">
              {files.length > 1 && <PageOrder files={files} />}
              <InfoNote>
                Photo orientation is respected. JPG and PNG images are embedded without re-compression, and each page
                takes the size of its image (capped at A3).
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="pink" icon={<FileText className="h-5 w-5" />} onClick={convert}>
                  Convert to PDF
                </PrimaryButton>
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
          files={files}
          title={`Building a PDF from ${files.length} image${files.length > 1 ? 's' : ''}`}
          tone="pink"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Convert more images"
          onReset={startOver}
          tone="pink"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={files.length === 1 ? files[0].name : `${files.length} images`}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Change images"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
