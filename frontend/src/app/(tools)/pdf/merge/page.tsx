'use client';

import { useState } from 'react';
import { Combine, FileText, Shuffle, Layers } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { mergePdfs, TaskResponse } from '@/lib/api';

export default function MergePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  const ready = files.length >= 2;

  const merge = () => {
    if (ready) run.run((req) => mergePdfs(files, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };

  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single document"
      icon={Combine}
      tone="red"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Merge PDF files">
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            files={files}
            onFilesChange={setFiles}
            tone="red"
            typeLabel="PDF"
            maxFiles={20}
            reorderable
            title="Drag & drop PDF files here"
            hint={files.length < 2 ? 'Add at least 2 PDF files (up to 20).' : undefined}
          />

          {!files.length && (
            <FeatureGrid
              tone="red"
              items={[
                { icon: FileText, label: 'Multiple PDFs', desc: 'Up to 20 files' },
                { icon: Shuffle, label: 'Reorder', desc: 'Move files up or down' },
                { icon: Layers, label: 'Bookmarks kept', desc: 'And form fields' },
              ]}
            />
          )}

          {files.length > 0 && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                Files are combined in the order shown above, so use the Up and Down buttons to rearrange them.
                Bookmarks and form fields from your files are kept.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="red" icon={<Combine className="h-5 w-5" />} onClick={merge} disabled={!ready}>
                  {ready ? `Merge ${files.length} PDFs` : 'Add one more PDF to merge'}
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
          title={`Merging ${files.length} PDFs`}
          hint="Pages are joined in the order you chose."
          tone="red"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDFs are merged"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download merged PDF"
          resetLabel="Merge more PDFs"
          onReset={startOver}
          copyLink
          tone="red"
        >
          <p className="text-center text-sm text-gray-600">{files.length} files combined into one document.</p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          title="Merge failed"
          fileName={files.length === 1 ? files[0].name : `${files.length} PDF files`}
          fileSize={files.length === 1 ? files[0].size : files.reduce((n, f) => n + f.size, 0)}
          onRetry={merge}
          onEdit={run.backToEdit}
          editLabel="Change files"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
