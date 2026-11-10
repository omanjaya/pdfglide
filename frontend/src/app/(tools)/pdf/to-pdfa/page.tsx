'use client';

import { useState } from 'react';
import { Archive, Clock, FileCheck, Shield } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard, StatTile } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { pdfToPdfA, TaskResponse } from '@/lib/api';

type PdfaLevel = '1b' | '2b' | '3b';

const LEVEL_OPTIONS: { value: PdfaLevel; label: string; description: string }[] = [
  { value: '1b', label: 'PDF/A-1b', description: 'Maximum compatibility' },
  { value: '2b', label: 'PDF/A-2b', description: 'Modern standard' },
  { value: '3b', label: 'PDF/A-3b', description: 'Allows embedded files' },
];

export default function PdfToPdfAPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<PdfaLevel>('2b');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (file) run.run((req) => pdfToPdfA(file, level, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setLevel('2b');
  };

  return (
    <ToolLayout
      title="PDF to PDF/A"
      description="Convert a PDF to the PDF/A archival format"
      icon={Archive}
      tone="amber"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert PDF to PDF/A">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="amber" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="amber"
              items={[
                { icon: Shield, label: 'Archival format', desc: 'PDF/A is an ISO standard' },
                { icon: Clock, label: 'Long-term', desc: 'Made to stay readable' },
                { icon: FileCheck, label: 'Self-contained', desc: 'Fonts are embedded' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="PDF/A level" description="If you are not sure, keep PDF/A-2b.">
                <ChoiceGroup label="Conformance level" value={level} onChange={setLevel} options={LEVEL_OPTIONS} tone="amber" columns={3} />
              </OptionsPanel>
              <InfoNote>
                The output embeds the fonts and an sRGB output intent. We have not checked the result with a PDF/A
                validator, so if you need certified compliance, validate the file before you submit it.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="amber" icon={<Archive className="h-5 w-5" />} onClick={convert}>
                  Convert to PDF/A-{level}
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
          title={`Converting to PDF/A-${level}`}
          hint="Embedding fonts can take a while for long documents."
          tone="amber"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF/A file is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF/A"
          stats={<StatTile label="Level" value={`PDF/A-${level}`} />}
          resetLabel="Convert another PDF"
          onReset={startOver}
          tone="amber"
        >
          <p className="text-center text-xs text-gray-600">
            Fonts and an sRGB output intent are embedded. Compliance has not been checked with a validator.
          </p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Change file or level"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
