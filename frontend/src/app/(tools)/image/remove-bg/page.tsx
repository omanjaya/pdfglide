'use client';

import { useState } from 'react';
import { Eraser, Layers, Timer, UserRound } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard, StatTile } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { BeforeAfter } from '@/components/image/BeforeAfter';
import { ImagePreview, IMAGE_ACCEPT, IMAGE_PASTE_HINT, IMAGE_TYPE_LABEL, bytes, useImageInfo, usePasteImage } from '@/components/image/imageTools';
import { useToolRun } from '@/hooks/useToolRun';
import { getDownloadUrl, removeBackground, ImageTaskResponse, RemoveBackgroundStats } from '@/lib/api';

type Result = ImageTaskResponse<RemoveBackgroundStats>['data'];
type Fill = 'transparent' | 'white' | 'black' | 'custom';
type Format = 'png' | 'webp' | 'jpeg';

const FILLS: { value: Fill; label: string }[] = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
  { value: 'custom', label: 'Colour' },
];
const FORMAT_LABEL: Record<Format, string> = { png: 'PNG', webp: 'WebP', jpeg: 'JPG' };

export default function RemoveBackgroundPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [fill, setFill] = useState<Fill>('transparent');
  const [custom, setCustom] = useState('#ffffff');
  const [format, setFormat] = useState<Format>('png');
  const [fast, setFast] = useState(false);
  const run = useToolRun<Result>();
  const file = files[0];
  const info = useImageInfo(file);
  usePasteImage((f) => setFiles([f]), run.status === 'idle');

  const solid = fill !== 'transparent';
  // JPG cannot be see-through; fall back to PNG if the user goes back to transparent.
  const outFormat: Format = !solid && format === 'jpeg' ? 'png' : format;
  const bgColor = fill === 'custom' ? custom : fill;

  const remove = () => {
    if (file) run.run((req) => removeBackground(file, { bgColor, outputFormat: outFormat, quality: 92, fastMode: fast }, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setFill('transparent');
    setCustom('#ffffff');
    setFormat('png');
    setFast(false);
  };

  const meta = run.result?.metadata;
  const resultUrl = run.result?.download_url ? getDownloadUrl(run.result.download_url) : null;
  const w = meta?.width ?? info?.width ?? 0;
  const h = meta?.height ?? info?.height ?? 0;

  return (
    <ToolLayout
      title="Remove Background"
      description="Cut out the person in a photo and get a transparent PNG at full resolution."
      icon={Eraser}
      tone="green"
      status={run.announcement}
      width="lg"
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Remove the background from an image">
          <FileUploader accept={IMAGE_ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="green" typeLabel={IMAGE_TYPE_LABEL} title="Drag & drop a photo here" hint={IMAGE_PASTE_HINT} />

          {!file && (
            <FeatureGrid
              tone="green"
              items={[
                { icon: UserRound, label: 'Made for people', desc: 'Best on portraits and people photos' },
                { icon: Layers, label: 'Full resolution', desc: 'Same pixel size, real transparency' },
                { icon: Timer, label: 'Takes a moment', desc: 'Usually 5 to 60 seconds' },
              ]}
            />
          )}

          {file && (
            <div className="mt-2 space-y-5">
              <ImagePreview file={file} info={info} />

              <InfoNote>
                This tool works best on photos of people. Results on products, objects or animals vary, and
                busy backgrounds or hair can leave rough edges.
              </InfoNote>

              <ChoiceGroup label="New background" tone="green" value={fill} onChange={setFill} options={FILLS} columns={4} />
              {fill === 'custom' && (
                <Field label="Background colour">
                  <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-11 w-24 cursor-pointer rounded-md border border-gray-300 bg-white p-1" />
                </Field>
              )}

              <OptionsPanel collapsible title="More options">
                <ChoiceGroup
                  label="Save as"
                  tone="green"
                  value={outFormat}
                  onChange={setFormat}
                  columns={3}
                  options={(['png', 'webp', ...(solid ? ['jpeg'] : [])] as Format[]).map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
                  hint={solid ? undefined : 'PNG and WebP keep the transparency. JPG is available with a solid colour.'}
                />
                <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-gray-800">
                  <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} className="mt-1 h-5 w-5 accent-green-700" />
                  <span>
                    Fast mode
                    <span className="block text-xs text-gray-600">Quicker, but hair and fine edges come out softer.</span>
                  </span>
                </label>
              </OptionsPanel>

              <div className="flex justify-center">
                <PrimaryButton tone="green" icon={<Eraser className="h-5 w-5" />} onClick={remove}>
                  Remove background
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
          title="Removing the background"
          hint="This takes between a few seconds and a minute. The first photo after a quiet period is the slowest, and larger photos take longer. Please keep this tab open."
          tone="green"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your background is removed"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download image"
          resetLabel="Try another photo"
          onReset={startOver}
          tone="green"
          stats={
            <>
              <StatTile label="Size" value={w && h ? `${w} × ${h} px` : ''} />
              <StatTile label="Background" value={meta?.has_transparency ? 'Transparent' : 'Solid colour'} accent />
              <StatTile label="Original file" value={bytes(meta?.original_size ?? file?.size)} />
              <StatTile label="New file" value={bytes(meta?.output_size ?? run.result.file_size)} />
            </>
          }
        >
          {info && !info.failed && resultUrl && <BeforeAfter beforeUrl={info.url} afterUrl={resultUrl} width={w || info.width} height={h || info.height} />}
          <p className="mt-3 text-center text-xs text-gray-600">
            Check hair and edges before you download. This tool is tuned for people; other subjects may need touch-ups.
          </p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={remove}
          onEdit={run.backToEdit}
          editLabel="Change photo or options"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
