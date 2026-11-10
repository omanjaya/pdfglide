'use client';

import { useState } from 'react';
import { Wrench, Database, FileCode, Shield } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { repairPdf, TaskResponse } from '@/lib/api';

export default function RepairPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const repair = () => {
    if (file) run.run((req) => repairPdf(file, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };

  return (
    <ToolLayout
      title="Repair PDF"
      description="Fix corrupted or damaged PDF files and recover your data"
      icon={Wrench}
      tone="pink"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Repair PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="pink" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="pink"
              items={[
                { icon: FileCode, label: 'Structure fix', desc: 'Corrupted PDF structure' },
                { icon: Database, label: 'XRef rebuild', desc: 'Cross-reference tables' },
                { icon: Shield, label: 'Broken objects', desc: 'Dropped when unreadable' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                We reopen the file, rebuild its structure and cross-reference tables, and save a clean copy of everything that can still be read.
                Recovery depends on the damage: a severely corrupted file may not be fully recoverable.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="pink" icon={<Wrench className="h-5 w-5" />} onClick={repair}>
                  Repair PDF
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
          title="Repairing your PDF"
          tone="pink"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF is repaired"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download repaired PDF"
          resetLabel="Repair another PDF"
          onReset={startOver}
          copyLink
          tone="pink"
        >
          <p className="text-center text-sm text-gray-600">Open the repaired file and check the pages you need.</p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <div className="space-y-4">
          <ErrorCard
            message={run.error || 'Something went wrong.'}
            fileName={file?.name}
            fileSize={file?.size}
            onRetry={repair}
            onEdit={run.backToEdit}
            editLabel="Choose a different file"
            onReset={startOver}
          />
          <InfoNote>
            Repair tips: make sure the file is a PDF (even a damaged one), try uploading it again, or try another copy. The file may be too damaged to repair.
          </InfoNote>
        </div>
      )}
    </ToolLayout>
  );
}
