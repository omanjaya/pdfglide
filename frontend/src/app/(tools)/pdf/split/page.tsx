'use client';

import { useMemo, useState } from 'react';
import { Scissors, Eye, Archive, CheckCircle2 } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { PdfPageSelector } from '@/components/pdf/PdfPageSelector';
import { useToolRun } from '@/hooks/useToolRun';
import { splitPdf, TaskResponse } from '@/lib/api';

type SplitMode = 'all' | 'range' | 'extract';
type InputMode = 'visual' | 'manual';

const SPLIT_MODES: { value: SplitMode; label: string; description: string }[] = [
  { value: 'all', label: 'All pages', description: 'One PDF per page' },
  { value: 'range', label: 'Custom ranges', description: 'One PDF per range' },
  { value: 'extract', label: 'Extract pages', description: 'Only pages you pick' },
];

/** {1,2,3,5} -> "1-3, 5" */
function toRanges(pages: Set<number>): string {
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    ranges.push(start === sorted[i] ? `${start}` : `${start}-${sorted[i]}`);
  }
  return ranges.join(', ');
}

export default function SplitPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [inputMode, setInputMode] = useState<InputMode>('visual');
  const [pages, setPages] = useState('');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const selectedPagesString = useMemo(() => toRanges(selectedPages), [selectedPages]);
  const pagesParam = splitMode === 'all' ? 'all' : inputMode === 'visual' ? selectedPagesString : pages.trim();
  const valid = splitMode === 'all' || pagesParam.length > 0;

  const split = () => {
    if (file && valid) run.run((req) => splitPdf(file, pagesParam, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setSplitMode('all');
    setInputMode('visual');
    setPages('');
    setSelectedPages(new Set());
  };
  const changeMode = (mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === 'all') setSelectedPages(new Set());
  };

  const manual = splitMode !== 'all' && inputMode === 'manual';

  return (
    <ToolLayout
      title="Split PDF"
      description="Separate PDF pages into multiple files"
      icon={Scissors}
      tone="blue"
      width="xl"
      status={run.announcement}
    >
      {/* Kept mounted (hidden) while processing so the page thumbnails and selection survive Cancel and errors. */}
      <ToolPanel aria-label="Split PDF" hidden={run.status !== 'idle'}>
        <div className="mx-auto max-w-2xl">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="blue" typeLabel="PDF" />
        </div>

        {!file && (
          <div className="mx-auto max-w-2xl">
            <FeatureGrid
              tone="blue"
              items={[
                { icon: Eye, label: 'Visual picker', desc: 'Click pages to select' },
                { icon: Scissors, label: 'Ranges', desc: 'Custom page ranges' },
                { icon: Archive, label: 'ZIP output', desc: 'Several files in one ZIP' },
              ]}
            />
          </div>
        )}

        {file && (
          <div className="mt-6 space-y-5">
            <ChoiceGroup<SplitMode> label="Split mode" tone="blue" value={splitMode} onChange={changeMode} columns={3} options={SPLIT_MODES} />

            {splitMode !== 'all' && (
              <ChoiceGroup<InputMode>
                label="Choose pages by"
                tone="blue"
                value={inputMode}
                onChange={setInputMode}
                columns={2}
                options={[
                  { value: 'visual', label: 'Clicking pages' },
                  { value: 'manual', label: 'Typing ranges' },
                ]}
              />
            )}

            {manual ? (
              <Field
                label={splitMode === 'range' ? 'Page ranges' : 'Pages to extract'}
                hint={
                  splitMode === 'range'
                    ? 'Each range becomes its own PDF. Separate ranges with commas, e.g. 1-3, 5, 7-10.'
                    : 'Pages or ranges to keep, e.g. 1, 3, 5-7. Each comma-separated item becomes its own PDF.'
                }
              >
                <input
                  type="text"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder={splitMode === 'range' ? 'e.g. 1-3, 5, 7-10' : 'e.g. 1, 3, 5-7'}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </Field>
            ) : (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-900">{splitMode === 'all' ? 'All pages' : 'Select pages'}</h2>
                <PdfPageSelector file={file} selectedPages={selectedPages} onSelectionChange={setSelectedPages} />
                {splitMode !== 'all' && selectedPages.size > 0 && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="font-medium">Selected pages:</span>
                    <code className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs">{selectedPagesString}</code>
                  </p>
                )}
              </div>
            )}

            <InfoNote>
              {splitMode === 'all'
                ? 'Every page becomes its own PDF and you get them in one ZIP.'
                : 'Each page or range you list becomes its own PDF. With several you get a ZIP named after your file; with a single range you get one PDF.'}{' '}
              Bookmarks, metadata and form fields are kept where they apply.
            </InfoNote>

            <div className="flex justify-center">
              <PrimaryButton tone="blue" icon={<Scissors className="h-5 w-5" />} onClick={split} disabled={!valid}>
                {splitMode === 'all' ? 'Split all pages' : !manual && selectedPages.size > 0 ? `Split ${selectedPages.size} selected pages` : 'Split pages'}
              </PrimaryButton>
            </div>
          </div>
        )}
        <TrustStrip />
      </ToolPanel>

      {run.isBusy && (
        <ProcessingCard
          stage={run.status === 'uploading' ? 'uploading' : 'processing'}
          progress={run.uploadProgress}
          loaded={run.uploadLoaded}
          total={run.uploadTotal}
          fileName={file?.name}
          fileSize={file?.size}
          title="Splitting your PDF"
          tone="blue"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your split is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel={run.result.file_name?.toLowerCase().endsWith('.zip') ? 'Download ZIP' : 'Download PDF'}
          resetLabel="Split another PDF"
          onReset={startOver}
          copyLink
          tone="blue"
        >
          {run.result.file_name?.toLowerCase().endsWith('.zip') && (
            <p className="text-center text-sm text-gray-600">The ZIP contains one PDF per range, named after your original file.</p>
          )}
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={split}
          onEdit={run.backToEdit}
          editLabel="Change pages"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
