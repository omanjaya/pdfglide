'use client';

import { useState } from 'react';
import { Crop, FileText, Maximize2, RotateCcw } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { Button } from '@/components/ui/Button';
import { useToolRun } from '@/hooks/useToolRun';
import { cropPdf, TaskResponse } from '@/lib/api';

type Side = 'top' | 'right' | 'bottom' | 'left';
type Margins = Record<Side, number>;

const SIDES: { key: Side; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
];

const PRESETS = [
  { value: 0, label: 'None' },
  { value: 20, label: 'Small' },
  { value: 40, label: 'Medium' },
  { value: 60, label: 'Large' },
];

const ZERO: Margins = { top: 0, right: 0, bottom: 0, left: 0 };

export default function CropPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [margins, setMargins] = useState<Margins>(ZERO);
  const [uniform, setUniform] = useState(true);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const setSide = (side: Side, value: number) =>
    setMargins((m) => (uniform ? { top: value, right: value, bottom: value, left: value } : { ...m, [side]: value }));
  const allSame = margins.top === margins.right && margins.top === margins.bottom && margins.top === margins.left;
  const noMargins = SIDES.every((s) => margins[s.key] === 0);

  const crop = () => {
    // cropPdf(file, left, top, right, bottom, pages, req)
    if (file) run.run((req) => cropPdf(file, margins.left, margins.top, margins.right, margins.bottom, 'all', req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setMargins(ZERO);
    setUniform(true);
  };

  // Preview sizes (px) for the sketch of the page.
  const px = (side: Side) => Math.min(margins[side] / 2, side === 'top' || side === 'bottom' ? 50 : 40);

  return (
    <ToolLayout
      title="Crop PDF"
      description="Remove margins and crop the edges of your PDF pages"
      icon={Crop}
      tone="amber"
      width="lg"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Crop PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="amber" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="amber"
              items={[
                { icon: Maximize2, label: 'Remove margins', desc: 'Trim white space' },
                { icon: Crop, label: 'Custom crop', desc: 'Set each side' },
                { icon: RotateCcw, label: 'Presets', desc: 'Small, medium, large' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="mx-auto" aria-hidden="true">
                  <div className="relative h-[260px] w-[200px]">
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
                      <FileText className="h-16 w-16 text-gray-300" />
                    </div>
                    <div className="absolute inset-x-0 top-0 border-amber-600 bg-amber-500/20" style={{ height: px('top'), borderBottomWidth: margins.top ? 2 : 0 }} />
                    <div className="absolute inset-x-0 bottom-0 border-amber-600 bg-amber-500/20" style={{ height: px('bottom'), borderTopWidth: margins.bottom ? 2 : 0 }} />
                    <div className="absolute inset-y-0 left-0 border-orange-600 bg-orange-500/20" style={{ width: px('left'), borderRightWidth: margins.left ? 2 : 0 }} />
                    <div className="absolute inset-y-0 right-0 border-orange-600 bg-orange-500/20" style={{ width: px('right'), borderLeftWidth: margins.right ? 2 : 0 }} />
                    <div
                      className="absolute rounded border-2 border-dashed border-green-600 bg-green-50/30"
                      style={{ top: px('top'), right: px('right'), bottom: px('bottom'), left: px('left') }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-gray-600">Preview: shaded edges are removed</p>
                </div>

                <OptionsPanel title="Crop margins" icon={Crop} description="How much to cut from each edge, in points (72 pt = 1 inch).">
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={uniform}
                      onChange={(e) => setUniform(e.target.checked)}
                      className="h-5 w-5 shrink-0 rounded border-gray-300 accent-amber-700 focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                    />
                    <span className="text-sm text-gray-900">Apply the same margin to all sides</span>
                  </label>

                  <ChoiceGroup
                    label="Quick presets"
                    tone="amber"
                    value={allSame ? margins.top : -1}
                    onChange={(v) => setMargins({ top: v, right: v, bottom: v, left: v })}
                    columns={4}
                    options={PRESETS}
                  />

                  {SIDES.map(({ key, label }) => (
                    <div key={key} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3">
                      <label htmlFor={`crop-${key}`} className="text-sm font-medium text-gray-800">{label} (pt)</label>
                      <input
                        type="range"
                        min={0}
                        max={200}
                        value={margins[key]}
                        onChange={(e) => setSide(key, parseInt(e.target.value))}
                        aria-label={`${label} margin slider`}
                        className="h-11 w-full min-w-0 cursor-pointer accent-amber-700"
                      />
                      <input
                        id={`crop-${key}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={500}
                        value={margins[key]}
                        onChange={(e) => setSide(key, Math.max(0, parseInt(e.target.value) || 0))}
                        className="min-h-[44px] w-full rounded-lg border border-gray-300 px-2 text-center text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/30"
                      />
                    </div>
                  ))}

                  <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setMargins(ZERO)} disabled={noMargins}>
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                    Reset margins
                  </Button>
                </OptionsPanel>
              </div>

              <InfoNote>The margins are cut from every page. The pages are cropped (hidden outside the new edges), not resized.</InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="amber" icon={<Crop className="h-5 w-5" />} onClick={crop} disabled={noMargins}>
                  Crop PDF
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
          title="Cropping your pages"
          tone="amber"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your cropped PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Crop another PDF"
          onReset={startOver}
          copyLink
          tone="amber"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={crop}
          onEdit={run.backToEdit}
          editLabel="Change margins"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
