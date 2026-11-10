'use client';

import { useState } from 'react';
import { Layers, Trash2, Scissors, ArrowUpDown } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { organizePdf, deletePdfPages, extractPdfPages, TaskResponse } from '@/lib/api';

type Mode = 'reorder' | 'delete' | 'extract';

const MODES: Record<
  Mode,
  { label: string; description: string; icon: typeof Layers; placeholder: string; help: string; example: string; button: string; busy: string; done: string }
> = {
  reorder: {
    label: 'Reorder',
    description: 'Rearrange pages',
    icon: ArrowUpDown,
    placeholder: '3,1,2,4 (for a 4-page PDF)',
    help: 'Enter the new page order. You can repeat pages to duplicate them.',
    example: 'Enter "3,1,2,4" to move page 3 to the first position.',
    button: 'Reorder pages',
    busy: 'Reordering your pages',
    done: 'Your pages are reordered',
  },
  delete: {
    label: 'Delete',
    description: 'Remove pages',
    icon: Trash2,
    placeholder: '2,4,6',
    help: 'Enter the page numbers to remove from the PDF.',
    example: 'Enter "2,4" to remove pages 2 and 4 from the PDF.',
    button: 'Delete pages',
    busy: 'Deleting the pages',
    done: 'The pages are removed',
  },
  extract: {
    label: 'Extract',
    description: 'Keep some pages',
    icon: Scissors,
    placeholder: '1,3,5',
    help: 'Enter the page numbers to extract into a new PDF.',
    example: 'Enter "1,3,5" to create a new PDF with only those pages.',
    button: 'Extract pages',
    busy: 'Extracting the pages',
    done: 'Your pages are extracted',
  },
};

export default function OrganizePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('reorder');
  const [pageOrder, setPageOrder] = useState('');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];
  const m = MODES[mode];

  const pages = pageOrder.split(',').map((p) => p.trim()).filter(Boolean).map(Number);
  const invalid = pageOrder.trim() !== '' && pages.some((n) => !Number.isInteger(n) || n < 1);
  const canRun = pages.length > 0 && !invalid;

  const organize = () => {
    if (!file || !canRun) return;
    const call = mode === 'reorder' ? organizePdf : mode === 'delete' ? deletePdfPages : extractPdfPages;
    run.run((req) => call(file, pages, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setMode('reorder');
    setPageOrder('');
  };

  return (
    <ToolLayout
      title="Organize PDF"
      description="Reorder, delete, or extract pages from your PDF document"
      icon={Layers}
      tone="orange"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Organize PDF pages">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="orange" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="orange"
              items={[
                { icon: ArrowUpDown, label: 'Reorder', desc: 'Rearrange pages' },
                { icon: Trash2, label: 'Delete', desc: 'Remove pages' },
                { icon: Scissors, label: 'Extract', desc: 'Get specific pages' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="What do you want to do?" icon={m.icon}>
                <ChoiceGroup<Mode>
                  label="Operation"
                  tone="orange"
                  value={mode}
                  onChange={setMode}
                  columns={3}
                  options={(Object.keys(MODES) as Mode[]).map((k) => ({ value: k, label: MODES[k].label, description: MODES[k].description }))}
                />
                <Field
                  label="Page numbers"
                  hint={`${m.help} Separate numbers with commas.`}
                  error={invalid ? 'Use whole page numbers separated by commas, like 3,1,2.' : null}
                >
                  <input
                    type="text"
                    value={pageOrder}
                    onChange={(e) => setPageOrder(e.target.value)}
                    placeholder={m.placeholder}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-600/30"
                  />
                </Field>
              </OptionsPanel>

              <InfoNote>
                <strong>Example:</strong> {m.example} Bookmarks, metadata and form fields are kept where they apply.
              </InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="orange" icon={<m.icon className="h-5 w-5" />} onClick={organize} disabled={!canRun}>
                  {m.button}
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
          title={m.busy}
          tone="orange"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title={m.done}
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Organize another PDF"
          onReset={startOver}
          copyLink
          tone="orange"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={organize}
          onEdit={run.backToEdit}
          editLabel="Change pages"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
