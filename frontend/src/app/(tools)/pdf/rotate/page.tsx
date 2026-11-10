'use client';

import { useState } from 'react';
import { RotateCw, RotateCcw, FlipVertical, Layers } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { rotatePdf, TaskResponse } from '@/lib/api';

type PageOption = 'all' | 'odd' | 'even' | 'custom';

const ROTATION_OPTIONS = [
  { value: 90, label: '90° ↻', description: 'Rotate right' },
  { value: 180, label: '180° ↕', description: 'Flip' },
  { value: 270, label: '270° ↺', description: 'Rotate left' },
];

const PAGE_OPTIONS: { value: PageOption; label: string; description: string }[] = [
  { value: 'all', label: 'All pages', description: 'Rotate every page' },
  { value: 'odd', label: 'Odd pages', description: '1, 3, 5, 7...' },
  { value: 'even', label: 'Even pages', description: '2, 4, 6, 8...' },
  { value: 'custom', label: 'Custom', description: 'Specific pages' },
];

/** The server only understands "all" or explicit lists/ranges, so odd/even become lists (pages past the end are ignored). */
const stepPages = (start: number) => Array.from({ length: 1000 }, (_, i) => start + i * 2).join(',');
const pagesParam = (option: PageOption, custom: string) =>
  option === 'custom' ? custom.trim() : option === 'odd' ? stepPages(1) : option === 'even' ? stepPages(2) : 'all';

export default function RotatePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [rotation, setRotation] = useState(90);
  const [pageOption, setPageOption] = useState<PageOption>('all');
  const [customPages, setCustomPages] = useState('');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];
  const customMissing = pageOption === 'custom' && !customPages.trim();

  const rotate = () => {
    if (!file || customMissing) return;
    run.run((req) => rotatePdf(file, rotation, pagesParam(pageOption, customPages), req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setRotation(90);
    setPageOption('all');
    setCustomPages('');
  };

  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate PDF pages to any angle"
      icon={RotateCw}
      tone="purple"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Rotate PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="purple" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="purple"
              items={[
                { icon: RotateCw, label: '90° right', desc: 'Quarter turn clockwise' },
                { icon: FlipVertical, label: '180° flip', desc: 'Upside down' },
                { icon: Layers, label: 'Chosen pages', desc: 'All, odd, even or custom' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-center gap-6 py-2" aria-hidden="true">
                <div className="flex h-24 w-20 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-xs text-gray-600 shadow-sm">Before</div>
                <RotateCcw className="h-6 w-6 -scale-x-100 text-purple-700" />
                <div className="flex h-24 w-20 items-center justify-center">
                  <div
                    className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-purple-400 bg-purple-50 text-xs text-purple-800 shadow-sm transition-transform motion-reduce:transition-none"
                    style={{ transform: `rotate(${rotation}deg)` }}
                  >
                    After
                  </div>
                </div>
              </div>

              <OptionsPanel title="Rotation options" icon={RotateCw}>
                <ChoiceGroup<number> label="Rotation angle" tone="purple" value={rotation} onChange={setRotation} columns={3} options={ROTATION_OPTIONS} />
                <ChoiceGroup<PageOption> label="Pages to rotate" tone="purple" value={pageOption} onChange={setPageOption} columns={4} options={PAGE_OPTIONS} />
                {pageOption === 'custom' && (
                  <Field label="Page numbers" hint="Page numbers separated by commas, or ranges like 5-10." required>
                    <input
                      type="text"
                      value={customPages}
                      onChange={(e) => setCustomPages(e.target.value)}
                      placeholder="e.g. 1, 3, 5-10"
                      className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/30"
                    />
                  </Field>
                )}
              </OptionsPanel>

              <InfoNote>Pages you do not select stay as they are. Rotation is added to any rotation a page already has.</InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="purple" icon={<RotateCw className="h-5 w-5" />} onClick={rotate} disabled={customMissing}>
                  Rotate {rotation}°
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
          title={`Rotating pages by ${rotation}°`}
          tone="purple"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF is rotated"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Rotate another PDF"
          onReset={startOver}
          copyLink
          tone="purple"
        >
          <p className="text-center text-sm text-gray-600">
            Rotated {rotation}° ({pageOption === 'custom' ? `pages ${customPages.trim()}` : `${pageOption} pages`}).
          </p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={rotate}
          onEdit={run.backToEdit}
          editLabel="Change options"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
