'use client';

import { useEffect, useState } from 'react';
import { ArrowRightLeft, FileImage, Layers, Palette } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard, StatTile } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { ImagePreview, IMAGE_ACCEPT, IMAGE_PASTE_HINT, IMAGE_TYPE_LABEL, bytes, useHasTransparency, useImageInfo, usePasteImage } from '@/components/image/imageTools';
import { useToolRun } from '@/hooks/useToolRun';
import { convertImage, ImageTaskResponse, ConvertImageStats } from '@/lib/api';

type Result = ImageTaskResponse<ConvertImageStats>['data'];
type Target = 'jpg' | 'png' | 'webp' | 'gif';
type Bg = 'white' | 'black' | 'custom';

const TARGETS: { value: Target; label: string; description: string }[] = [
  { value: 'jpg', label: 'JPG', description: 'Photos, small files' },
  { value: 'png', label: 'PNG', description: 'Sharp, transparency' },
  { value: 'webp', label: 'WebP', description: 'Small, modern' },
  { value: 'gif', label: 'GIF', description: '256 colours' },
];
const SOURCE_NAMES: Record<string, string> = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF' };
const DEFAULT_TARGET: Record<string, Target> = { 'image/jpeg': 'png', 'image/png': 'jpg', 'image/webp': 'jpg', 'image/gif': 'png' };

export default function ConvertImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<Target>('png');
  const [quality, setQuality] = useState(90);
  const [bg, setBg] = useState<Bg>('white');
  const [custom, setCustom] = useState('#ffffff');
  const run = useToolRun<Result>();
  const file = files[0];
  const info = useImageInfo(file);
  const transparent = useHasTransparency(file, info);
  usePasteImage((f) => setFiles([f]), run.status === 'idle');

  useEffect(() => {
    if (file) setTarget(DEFAULT_TARGET[file.type] ?? 'png');
  }, [file]);

  const source = file ? SOURCE_NAMES[file.type] : undefined;
  const sameFormat = source?.toLowerCase() === target;
  const showBackground = target === 'jpg' && transparent === true;
  const showQuality = target === 'jpg' || target === 'webp';
  const bgHex = bg === 'white' ? '#FFFFFF' : bg === 'black' ? '#000000' : custom;

  const convert = () => {
    if (file) run.run((req) => convertImage(file, target, quality, { ...req, background: showBackground ? bgHex : undefined }));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setQuality(90);
    setBg('white');
    setCustom('#ffffff');
  };

  const meta = run.result?.metadata;

  return (
    <ToolLayout
      title="Convert Image"
      description="Convert images between JPG, PNG, WebP and GIF."
      icon={ArrowRightLeft}
      tone="cyan"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert an image">
          <FileUploader accept={IMAGE_ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="cyan" typeLabel={IMAGE_TYPE_LABEL} title="Drag & drop an image here" hint={IMAGE_PASTE_HINT} />

          {!file && (
            <FeatureGrid
              tone="cyan"
              items={[
                { icon: FileImage, label: 'Four formats', desc: 'JPG, PNG, WebP, GIF' },
                { icon: Layers, label: 'Transparency', desc: 'Kept, or filled with a colour for JPG' },
                { icon: Palette, label: 'Colours kept', desc: 'Colour profile and upright photos' },
              ]}
            />
          )}

          {file && (
            <div className="mt-2 space-y-5">
              <ImagePreview file={file} info={info} />

              <ChoiceGroup label={source ? `Convert ${source} to` : 'Convert to'} tone="cyan" value={target} onChange={setTarget} options={TARGETS} columns={4} />

              {sameFormat && <InfoNote>The picture is already {source}. Pick a different format to convert it.</InfoNote>}
              {file.type === 'image/gif' && target !== 'gif' && target !== 'webp' && (
                <InfoNote>If this GIF is animated, only its first frame is kept: PNG and JPG cannot move. Choose WebP or GIF to keep the animation.</InfoNote>
              )}
              {target === 'gif' && <InfoNote>GIF uses at most 256 colours, so photos can look grainy.</InfoNote>}

              {showBackground && (
                <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                  <ChoiceGroup
                    label="Fill transparent areas with"
                    tone="cyan"
                    value={bg}
                    onChange={setBg}
                    columns={3}
                    options={[
                      { value: 'white', label: 'White' },
                      { value: 'black', label: 'Black' },
                      { value: 'custom', label: 'Custom' },
                    ]}
                    hint="JPG cannot be see-through, so transparent parts need a colour."
                  />
                  {bg === 'custom' && (
                    <Field label="Colour">
                      <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-11 w-24 cursor-pointer rounded-md border border-gray-300 bg-white p-1" />
                    </Field>
                  )}
                </div>
              )}

              {showQuality && (
                <OptionsPanel collapsible title="More options">
                  <Field label={`Quality: ${quality}`} hint={target === 'webp' ? 'Higher is sharper. 100 is lossless.' : 'Higher is sharper and gives a larger file.'}>
                    <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} aria-valuetext={`Quality ${quality} out of 100`} className="h-11 w-full accent-cyan-700" />
                  </Field>
                </OptionsPanel>
              )}

              <div className="flex justify-center">
                <PrimaryButton tone="cyan" icon={<ArrowRightLeft className="h-5 w-5" />} onClick={convert} disabled={sameFormat}>
                  Convert to {TARGETS.find((t) => t.value === target)?.label}
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
          title={`Converting to ${TARGETS.find((t) => t.value === target)?.label}`}
          tone="cyan"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your image is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download image"
          resetLabel="Convert another image"
          onReset={startOver}
          tone="cyan"
          stats={
            <>
              <StatTile label="From" value={(meta?.source_format ?? source ?? '').toUpperCase()} />
              <StatTile label="To" value={(meta?.target_format ?? target).toUpperCase()} accent />
              <StatTile label="Original file" value={bytes(meta?.original_size ?? file?.size)} />
              <StatTile label="New file" value={bytes(meta?.output_size ?? run.result.file_size)} />
            </>
          }
        >
          <div className="space-y-1 text-center text-sm text-gray-700">
            {meta?.flattened_transparency && <p>Transparent areas were filled with a solid colour because this format cannot be see-through.</p>}
            {meta?.animation_dropped && <p>Only the first frame was kept: this format cannot hold the animation.</p>}
          </div>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Change format or image"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
