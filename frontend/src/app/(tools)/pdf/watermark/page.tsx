'use client';

import { useId, useState } from 'react';
import { Droplets, Check, Lock, FileText, Copyright, Building2 } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { addWatermark, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

const POSITIONS = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center-left', label: 'Center left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const COLOR_OPTIONS = [
  { value: 'gray', label: 'Gray', hex: '#6B7280' },
  { value: 'red', label: 'Red', hex: '#EF4444' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6' },
  { value: 'green', label: 'Green', hex: '#22C55E' },
  { value: 'black', label: 'Black', hex: '#000000' },
  { value: 'white', label: 'White', hex: '#FFFFFF' },
];

const slider = 'h-11 w-full cursor-pointer accent-cyan-700';

export default function WatermarkPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('CONFIDENTIAL');
  const [position, setPosition] = useState('center');
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(45);
  const [fontSize, setFontSize] = useState(60);
  const [color, setColor] = useState('gray');
  const run = useToolRun<TaskResponse['data']>();
  const colorName = useId();
  const file = files[0];
  const hex = COLOR_OPTIONS.find((c) => c.value === color)?.hex ?? '#6B7280';

  const apply = () => {
    if (!file || !text.trim()) return;
    // addWatermark() skips falsy values and the server then defaults the angle to 45, so send 360 for "no rotation".
    run.run((req) => addWatermark(file, text, { position, opacity, rotation: rotation || 360, fontSize, color }, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setText('CONFIDENTIAL');
    setPosition('center');
    setOpacity(0.3);
    setRotation(45);
    setFontSize(60);
    setColor('gray');
  };

  return (
    <ToolLayout
      title="PDF Watermark"
      description="Add a text watermark to your PDF"
      icon={Droplets}
      tone="cyan"
      width="xl"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Add watermark to PDF">
          <div className="mx-auto max-w-2xl">
            <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="cyan" typeLabel="PDF" />
            {!file && (
              <FeatureGrid
                tone="cyan"
                items={[
                  { icon: Lock, label: 'Confidential', desc: 'Or any text you like' },
                  { icon: FileText, label: 'Draft', desc: 'Position, colour, angle' },
                  { icon: Building2, label: 'Company name', desc: 'Opacity and size' },
                ]}
              />
            )}
          </div>

          {file && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
              <figure className="mx-auto w-full max-w-[220px] lg:max-w-none lg:self-start">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-gray-200 bg-white" aria-hidden="true">
                  <div className="absolute inset-3 overflow-hidden rounded border border-gray-300 bg-white shadow-sm">
                    {text && (
                      <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        style={{ transform: `rotate(${rotation}deg)`, opacity }}
                      >
                        <span className="whitespace-nowrap font-bold" style={{ fontSize: `${Math.min(fontSize / 4, 24)}px`, color: hex }}>
                          {text}
                        </span>
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      {['w-3/4', 'w-full', 'w-5/6', 'w-full', 'w-2/3'].map((w, i) => (
                        <div key={i} className={cn('h-2 rounded bg-gray-200', w)} />
                      ))}
                    </div>
                  </div>
                </div>
                <figcaption className="mt-2 text-center text-xs text-gray-600">Rough preview: position is applied when you add it.</figcaption>
              </figure>

              <div className="space-y-5">
                <OptionsPanel title="Watermark options" icon={Droplets}>
                  <Field label="Watermark text" required error={!text.trim() ? 'Enter the text to stamp on the pages.' : null}>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Enter watermark text"
                      className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 text-base focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/30"
                    />
                  </Field>

                  <ChoiceGroup label="Position" tone="cyan" value={position} onChange={setPosition} columns={3} options={POSITIONS} />

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-gray-800">Colour</legend>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <label
                          key={c.value}
                          title={c.label}
                          className={cn(
                            'relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                            color === c.value ? 'border-cyan-600 ring-2 ring-cyan-600/30' : 'border-gray-300'
                          )}
                          style={{ backgroundColor: c.hex }}
                        >
                          <input type="radio" name={colorName} value={c.value} checked={color === c.value} onChange={() => setColor(c.value)} className="sr-only" />
                          <span className="sr-only">{c.label}</span>
                          {color === c.value && <Check className={cn('h-5 w-5', c.value === 'white' ? 'text-gray-800' : 'text-white')} aria-hidden="true" />}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={`Opacity: ${Math.round(opacity * 100)}%`}>
                      <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className={slider} />
                    </Field>
                    <Field label={`Rotation: ${rotation}°`}>
                      <input type="range" min="0" max="360" step="15" value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} className={slider} />
                    </Field>
                  </div>
                  <Field label={`Font size: ${fontSize}`}>
                    <input type="range" min="20" max="150" step="10" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value))} className={slider} />
                  </Field>
                </OptionsPanel>

                <InfoNote icon={<Copyright className="h-4 w-4" aria-hidden="true" />}>
                  The watermark is stamped on every page of the PDF.
                </InfoNote>

                <div className="flex justify-center">
                  <PrimaryButton tone="cyan" icon={<Droplets className="h-5 w-5" />} onClick={apply} disabled={!text.trim()}>
                    Add watermark
                  </PrimaryButton>
                </div>
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
          title="Adding your watermark"
          tone="cyan"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your watermarked PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Watermark another PDF"
          onReset={startOver}
          copyLink
          tone="cyan"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={apply}
          onEdit={run.backToEdit}
          editLabel="Change options"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
