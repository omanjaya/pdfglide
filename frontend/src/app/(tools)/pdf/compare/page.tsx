'use client';

import { useState } from 'react';
import { ArrowLeftRight, Eye, FileSearch, GitCompare } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { comparePdfs, TaskResponse } from '@/lib/api';

type OutputMode = 'visual' | 'text';

const MODE_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
  { value: 'visual', label: 'Visual', description: 'Side-by-side with highlighted differences (PDF)' },
  { value: 'text', label: 'Text', description: 'Text-based diff report (TXT)' },
];

const PDF = { 'application/pdf': ['.pdf'] };

export default function ComparePdfPage() {
  const [original, setOriginal] = useState<File[]>([]);
  const [modified, setModified] = useState<File[]>([]);
  const [mode, setMode] = useState<OutputMode>('visual');
  const run = useToolRun<TaskResponse['data']>();
  const [file1, file2] = [original[0], modified[0]];

  const compare = () => {
    if (file1 && file2) run.run((req) => comparePdfs(file1, file2, mode, req));
  };
  const startOver = () => {
    run.reset();
    setOriginal([]);
    setModified([]);
    setMode('visual');
  };

  return (
    <ToolLayout
      title="Compare PDFs"
      description="Find differences between two PDF documents"
      icon={GitCompare}
      tone="blue"
      width="lg"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Compare two PDFs">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section aria-labelledby="compare-original" className="space-y-2">
              <h2 id="compare-original" className="text-sm font-semibold text-gray-800">Original PDF</h2>
              <FileUploader accept={PDF} multiple={false} files={original} onFilesChange={setOriginal} tone="blue" typeLabel="PDF" title="Drop the original PDF" />
            </section>
            <section aria-labelledby="compare-modified" className="space-y-2">
              <h2 id="compare-modified" className="text-sm font-semibold text-gray-800">Modified PDF</h2>
              <FileUploader accept={PDF} multiple={false} files={modified} onFilesChange={setModified} tone="cyan" typeLabel="PDF" title="Drop the modified PDF" />
            </section>
          </div>

          {!(file1 && file2) && (
            <FeatureGrid
              tone="blue"
              items={[
                { icon: ArrowLeftRight, label: 'Two documents', desc: 'Original and modified version' },
                { icon: Eye, label: 'Visual report', desc: 'Differences highlighted' },
                { icon: FileSearch, label: 'Text report', desc: 'A plain-text list of changes' },
              ]}
            />
          )}

          {file1 && file2 && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Comparison mode">
                <ChoiceGroup label="Report type" value={mode} onChange={setMode} options={MODE_OPTIONS} tone="blue" columns={2} />
              </OptionsPanel>
              <div className="flex justify-center">
                <PrimaryButton tone="blue" icon={<GitCompare className="h-5 w-5" />} onClick={compare}>
                  Compare PDFs
                </PrimaryButton>
              </div>
            </div>
          )}
          {!(file1 && file2) && (file1 || file2) && (
            <InfoNote className="mt-4">Add the {file1 ? 'modified' : 'original'} PDF to continue.</InfoNote>
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
          files={[file1, file2].filter((f): f is File => !!f)}
          title="Comparing your PDFs"
          tone="blue"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your comparison report is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download report"
          resetLabel="Compare other PDFs"
          onReset={startOver}
          tone="blue"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={[file1?.name, file2?.name].filter(Boolean).join(' and ')}
          onRetry={compare}
          onEdit={run.backToEdit}
          editLabel="Change files or mode"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
