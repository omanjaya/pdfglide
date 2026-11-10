'use client';

import { useState } from 'react';
import { Presentation, FileCheck2, Layers, Zap } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { pptxToPdf, TaskResponse } from '@/lib/api';

const ACCEPT = {
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
};

export default function PptxToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (file) run.run((req) => pptxToPdf(file, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };

  return (
    <ToolLayout
      title="PowerPoint to PDF"
      description="Turn PowerPoint presentations (PPTX, PPT) into PDF files, one slide per page."
      icon={Presentation}
      tone="orange"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert PowerPoint to PDF">
          <FileUploader accept={ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="orange" typeLabel="PPTX or PPT" />

          {!file && (
            <FeatureGrid
              tone="orange"
              items={[
                { icon: FileCheck2, label: 'PPTX and PPT', desc: 'PowerPoint 97 and newer' },
                { icon: Layers, label: 'Slides as pages', desc: 'One slide per page' },
                { icon: Zap, label: 'Fast', desc: 'Usually a few seconds' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                Fonts are matched to the closest typeface available on our server. Animations and transitions
                are not included in a PDF.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="orange" icon={<Presentation className="h-5 w-5" />} onClick={convert}>
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
          fileName={file?.name}
          fileSize={file?.size}
          title="Converting to PDF"
          hint="Presentations with many images can take up to a minute."
          tone="orange"
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
          resetLabel="Convert another file"
          onReset={startOver}
          tone="orange"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Choose a different file"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
