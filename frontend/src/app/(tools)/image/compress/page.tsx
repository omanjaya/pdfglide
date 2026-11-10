'use client';

import { useState } from 'react';
import { Minimize2, ScanEye, ShieldOff, TrendingDown } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard, StatTile } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { ImagePreview, IMAGE_ACCEPT, IMAGE_PASTE_HINT, IMAGE_TYPE_LABEL, bytes, useImageInfo, usePasteImage } from '@/components/image/imageTools';
import { useToolRun } from '@/hooks/useToolRun';
import { compressImage, ImageTaskResponse, CompressImageStats } from '@/lib/api';

type Result = ImageTaskResponse<CompressImageStats>['data'];

const LEVELS = [
  { value: 90, label: 'High quality', description: 'Larger file' },
  { value: 75, label: 'Balanced', description: 'Recommended' },
  { value: 50, label: 'Smallest file', description: 'Visible loss' },
];
const DEFAULT_QUALITY = 75;

export default function CompressImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [stripMetadata, setStripMetadata] = useState(true);
  const run = useToolRun<Result>();
  const file = files[0];
  const info = useImageInfo(file);
  usePasteImage((f) => setFiles([f]), run.status === 'idle');

  const compress = () => {
    if (file) run.run((req) => compressImage(file, quality, { ...req, stripMetadata }));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setQuality(DEFAULT_QUALITY);
    setStripMetadata(true);
  };

  const meta = run.result?.metadata;
  const before = meta?.original_size ?? file?.size;
  const after = meta?.compressed_size ?? meta?.output_size ?? run.result?.file_size;
  const kept = meta?.kept_original === true;
  const savedPct = Math.round(meta?.compression_ratio ?? 0);

  return (
    <ToolLayout
      title="Compress Image"
      description="Make JPG, PNG, WebP and GIF files smaller while keeping them looking good."
      icon={Minimize2}
      tone="orange"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Compress an image">
          <FileUploader accept={IMAGE_ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="orange" typeLabel={IMAGE_TYPE_LABEL} title="Drag & drop an image here" hint={IMAGE_PASTE_HINT} />

          {!file && (
            <FeatureGrid
              tone="orange"
              items={[
                { icon: TrendingDown, label: 'Smaller files', desc: 'Same format, same size in pixels' },
                { icon: ScanEye, label: 'Looks the same', desc: 'Colours and transparency kept' },
                { icon: ShieldOff, label: 'Privacy', desc: 'Camera and location data removed' },
              ]}
            />
          )}

          {file && (
            <div className="mt-2 space-y-5">
              <ImagePreview file={file} info={info} />

              <ChoiceGroup
                label="Compression level"
                tone="orange"
                value={LEVELS.some((l) => l.value === quality) ? quality : -1}
                onChange={setQuality}
                options={LEVELS}
                hint="Photos (JPG, WebP) shrink the most. For PNG, High quality is lossless; lower levels also reduce the number of colours."
              />

              <OptionsPanel collapsible title="More options">
                <Field label={`Quality: ${quality}`} hint="1 is smallest, 100 is best quality.">
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    aria-valuetext={`Quality ${quality} out of 100`}
                    className="h-11 w-full accent-orange-600"
                  />
                </Field>
                <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={stripMetadata}
                    onChange={(e) => setStripMetadata(e.target.checked)}
                    className="mt-1 h-5 w-5 accent-orange-600"
                  />
                  <span>
                    Remove camera and location data (EXIF)
                    <span className="block text-xs text-gray-600">Colours and the upright orientation are kept.</span>
                  </span>
                </label>
              </OptionsPanel>

              <InfoNote>Animated GIF and WebP stay animated, and transparency is preserved. If a file cannot be made smaller, you get the original back.</InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="orange" icon={<Minimize2 className="h-5 w-5" />} onClick={compress}>
                  Compress image
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
          title="Compressing your image"
          tone="orange"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title={kept ? 'Already well optimised' : 'Your image is ready'}
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download image"
          resetLabel="Compress another image"
          onReset={startOver}
          tone="orange"
          stats={
            <>
              <StatTile label="Before" value={bytes(before)} />
              <StatTile label="After" value={bytes(after)} accent={!kept} />
              <StatTile label={kept ? 'Result' : 'Saved'} value={kept ? 'No gain' : `${savedPct}% smaller`} accent={!kept} />
              {meta?.format && <StatTile label="Format" value={meta.format.toUpperCase()} />}
            </>
          }
        >
          <div className="space-y-1 text-center text-sm text-gray-700">
            {kept && <p>This image is already optimised, so there was nothing to gain. You can download it unchanged.</p>}
            {meta?.metadata_removed && meta.had_location_data && <p>Location data was removed from the image.</p>}
            {meta?.metadata_removed && !meta.had_location_data && <p>Camera data (EXIF) was removed.</p>}
            {meta?.animated && <p>The animation was kept.</p>}
          </div>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={compress}
          onEdit={run.backToEdit}
          editLabel="Choose a different image"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
