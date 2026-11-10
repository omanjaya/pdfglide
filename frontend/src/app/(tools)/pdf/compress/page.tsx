'use client';

import { useState } from 'react';
import { Minimize2, Target, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard, StatTile } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { compressPdf, TaskResponse } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

type Quality = 'extreme' | 'low' | 'medium' | 'high';
type Mode = 'quality' | 'target';
type Unit = 'KB' | 'MB';

const QUALITY_OPTIONS: { value: Quality; label: string; description: string }[] = [
  { value: 'extreme', label: 'Maximum', description: 'Smallest file, 72 DPI' },
  { value: 'low', label: 'High', description: 'Web and email, 150 DPI' },
  { value: 'medium', label: 'Balanced', description: 'Good quality, 200 DPI' },
  { value: 'high', label: 'Minimal', description: 'Best quality, 300 DPI' },
];

const CHECKS = [
  { key: 'compressImages', label: 'Compress images', desc: 'Optimize embedded images' },
  { key: 'removeMetadata', label: 'Remove metadata', desc: 'Strip document info such as author and title' },
  { key: 'grayscale', label: 'Convert to grayscale', desc: 'Remove colour for a smaller file' },
] as const;

export default function CompressPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('quality');
  const [quality, setQuality] = useState<Quality>('medium');
  const [targetSize, setTargetSize] = useState(500);
  const [unit, setUnit] = useState<Unit>('KB');
  const [flags, setFlags] = useState({ compressImages: true, removeMetadata: false, grayscale: false });
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const targetKb = mode === 'target' ? (unit === 'MB' ? targetSize * 1024 : targetSize) : null;
  const targetInvalid = mode === 'target' && (!Number.isFinite(targetSize) || targetSize < (unit === 'MB' ? 1 : 10));

  const compress = () => {
    if (!file) return;
    run.run((req) =>
      compressPdf(
        file,
        {
          quality,
          compress_images: flags.compressImages,
          remove_metadata: flags.removeMetadata,
          grayscale: flags.grayscale,
          target_size_kb: targetKb,
        },
        req
      )
    );
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setMode('quality');
    setQuality('medium');
    setTargetSize(500);
    setUnit('KB');
    setFlags({ compressImages: true, removeMetadata: false, grayscale: false });
  };

  const m = run.result?.metadata as
    | { original_size?: number; compressed_size?: number; compression_ratio?: number; method?: string; target_size_kb?: number; target_reached?: boolean }
    | undefined;
  const hasStats = typeof m?.original_size === 'number' && typeof m?.compressed_size === 'number';
  const saved = hasStats ? m!.original_size! - m!.compressed_size! : 0;
  const smaller = hasStats && saved > 0;

  return (
    <ToolLayout
      title="Compress PDF"
      description="Reduce file size while maintaining quality"
      icon={Minimize2}
      tone="green"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Compress PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="green" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="green"
              items={[
                { icon: SlidersHorizontal, label: '4 quality levels', desc: 'From smallest to best' },
                { icon: Target, label: 'Target size', desc: 'Aim for a size in KB or MB' },
                { icon: ImageIcon, label: 'Image options', desc: 'Compress or go grayscale' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Compression settings" icon={Minimize2}>
                <ChoiceGroup<Mode>
                  label="Compression mode"
                  tone="green"
                  value={mode}
                  onChange={setMode}
                  columns={2}
                  options={[
                    { value: 'quality', label: 'Quality preset' },
                    { value: 'target', label: 'Target size' },
                  ]}
                />

                {mode === 'quality' ? (
                  <ChoiceGroup<Quality> label="Quality" tone="green" value={quality} onChange={setQuality} columns={2} options={QUALITY_OPTIONS} />
                ) : (
                  <div className="space-y-3">
                    <Field
                      label="Target file size"
                      hint={`Current size: ${formatFileSize(file.size)}. The result may be larger if the target cannot be reached.`}
                      error={targetInvalid ? `Enter at least ${unit === 'MB' ? '1 MB' : '10 KB'}.` : null}
                    >
                      <input
                        type="number"
                        inputMode="numeric"
                        min={unit === 'MB' ? 1 : 10}
                        max={unit === 'MB' ? 100 : 102400}
                        value={Number.isFinite(targetSize) ? targetSize : ''}
                        onChange={(e) => setTargetSize(parseInt(e.target.value) || 0)}
                        className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 text-lg font-semibold focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30"
                      />
                    </Field>
                    <ChoiceGroup<Unit>
                      label="Unit"
                      tone="green"
                      value={unit}
                      onChange={setUnit}
                      columns={2}
                      options={[
                        { value: 'KB', label: 'KB' },
                        { value: 'MB', label: 'MB' },
                      ]}
                    />
                  </div>
                )}
              </OptionsPanel>

              <OptionsPanel collapsible title="Advanced options" description="Images, metadata and colour">
                {CHECKS.map((c) => (
                  <label key={c.key} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={flags[c.key]}
                      onChange={(e) => setFlags((f) => ({ ...f, [c.key]: e.target.checked }))}
                      className="h-5 w-5 shrink-0 rounded border-gray-300 accent-green-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{c.label}</span>
                      <span className="block text-xs text-gray-600">{c.desc}</span>
                    </span>
                  </label>
                ))}
              </OptionsPanel>

              <InfoNote>Pages that are already well compressed may not get much smaller. If nothing can be saved, we tell you.</InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="green" icon={<Minimize2 className="h-5 w-5" />} onClick={compress} disabled={targetInvalid}>
                  {mode === 'target' ? `Compress to ${targetSize} ${unit}` : 'Compress PDF'}
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
          title="Compressing your PDF"
          hint="Large or image-heavy PDFs can take a minute or more."
          tone="green"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title={hasStats && !smaller ? 'Your PDF is ready, but it did not get smaller' : 'Your PDF is compressed'}
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Compress another PDF"
          onReset={startOver}
          copyLink
          tone="green"
          stats={
            hasStats ? (
              <>
                <StatTile label="Original" value={formatFileSize(m!.original_size!)} />
                <StatTile label={smaller ? 'Compressed' : 'Result'} value={formatFileSize(m!.compressed_size!)} accent={smaller} />
                {smaller && <StatTile label="Saved" value={formatFileSize(saved)} />}
                {smaller && typeof m?.compression_ratio === 'number' && <StatTile label="Smaller by" value={`${m.compression_ratio}%`} />}
              </>
            ) : undefined
          }
        >
          {hasStats && !smaller && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
              We could not make this PDF smaller with these settings; it is probably already well compressed. Try a lower quality level, or a target size.
            </p>
          )}
          {m?.target_size_kb ? (
            <p className={`mt-3 rounded-lg px-3 py-2 text-center text-sm ${m.target_reached ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
              {m.target_reached ? `Target of ${m.target_size_kb} KB reached.` : `Could not reach the target of ${m.target_size_kb} KB.`}
            </p>
          ) : null}
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={compress}
          onEdit={run.backToEdit}
          editLabel="Change settings"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
