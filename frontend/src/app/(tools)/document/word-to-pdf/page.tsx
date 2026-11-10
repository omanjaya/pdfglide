'use client';

import { useState } from 'react';
import { FileOutput, FileCheck2, Type, Zap } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { wordToPdf, TaskResponse } from '@/lib/api';

const ACCEPT = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
};

export default function WordToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (file) run.run((req) => wordToPdf(file, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };

  return (
    <ToolLayout
      title="Word to PDF"
      description="Turn Word documents (DOCX, DOC) into PDF files you can share and print."
      icon={FileOutput}
      tone="blue"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert Word to PDF">
          <FileUploader accept={ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="blue" typeLabel="DOCX or DOC" />

          {!file && (
            <FeatureGrid
              tone="blue"
              items={[
                { icon: FileCheck2, label: 'DOCX and DOC', desc: 'Word 97 and newer' },
                { icon: Type, label: 'Layout kept', desc: 'Pages, tables, images' },
                { icon: Zap, label: 'Fast', desc: 'Usually a few seconds' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                Fonts are matched to the closest typeface available on our server, so text may reflow
                slightly if your document uses a font we do not have.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="blue" icon={<FileOutput className="h-5 w-5" />} onClick={convert}>
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
          hint="Larger documents can take up to a minute."
          tone="blue"
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
          tone="blue"
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
