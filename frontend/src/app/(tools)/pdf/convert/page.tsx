'use client';

import { useState } from 'react';
import { FileImage, Files, Image as ImageIcon, Layers } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { api, TaskResponse } from '@/lib/api';

type Format = 'jpg' | 'png';

const FORMAT_OPTIONS: { value: Format; label: string; description: string }[] = [
  { value: 'jpg', label: 'JPG', description: 'Smaller files, works everywhere' },
  { value: 'png', label: 'PNG', description: 'Lossless quality' },
];

export default function PdfToImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<Format>('jpg');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (!file) return;
    run.run(async (req) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);
      return (await api.post('/pdf/to-image', formData, req)).data;
    });
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setFormat('jpg');
  };

  return (
    <ToolLayout
      title="PDF to Image"
      description="Convert PDF pages to JPG or PNG images"
      icon={FileImage}
      tone="red"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert PDF to images">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="red" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="red"
              items={[
                { icon: ImageIcon, label: 'JPG or PNG', desc: 'Pick the format you need' },
                { icon: Layers, label: 'Every page', desc: 'One image per page' },
                { icon: Files, label: 'ZIP for many pages', desc: 'Several images arrive as one ZIP' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Output format">
                <ChoiceGroup label="Image format" value={format} onChange={setFormat} options={FORMAT_OPTIONS} tone="red" />
              </OptionsPanel>
              <InfoNote>
                Each page becomes its own image. A PDF with several pages comes as a ZIP with the images named after
                the original file. JPG has no transparency, so transparent areas are filled with white.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="red" icon={<FileImage className="h-5 w-5" />} onClick={convert}>
                  Convert to {format.toUpperCase()}
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
          fileName={file?.name}
          fileSize={file?.size}
          title={`Converting pages to ${format.toUpperCase()}`}
          hint="Long PDFs take longer because every page is rendered."
          tone="red"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your images are ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download images"
          resetLabel="Convert another PDF"
          onReset={startOver}
          tone="red"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Change format or file"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
