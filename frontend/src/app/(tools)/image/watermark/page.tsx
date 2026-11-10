'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, ImagePlus, Languages, Move, Stamp, X } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard, StatTile } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PositionPicker } from '@/components/image/PositionPicker';
import { WatermarkPreview, WatermarkPosition, WatermarkSettings } from '@/components/image/WatermarkPreview';
import { IMAGE_ACCEPT, IMAGE_PASTE_HINT, IMAGE_TYPE_LABEL, MAX_MEGAPIXELS, bytes, useImageInfo, usePasteImage } from '@/components/image/imageTools';
import { useToolRun } from '@/hooks/useToolRun';
import { addImageWatermark, ImageTaskResponse, WatermarkImageStats } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';

type Result = ImageTaskResponse<WatermarkImageStats>['data'];
type Kind = 'text' | 'logo';

const MAX_LOGO_BYTES = 10 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const COLOR_PRESETS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Blue', value: '#2563eb' },
];
const ROTATIONS = [
  { label: 'Straight', value: 0 },
  { label: 'Diagonal up', value: 315 },
  { label: 'Diagonal down', value: 45 },
];

const DEFAULTS = {
  kind: 'text' as Kind,
  text: '',
  position: 'bottom-right' as WatermarkPosition,
  opacity: 0.4,
  fontSize: 40,
  color: '#ffffff',
  rotation: 0,
  imageScale: 20,
};

export default function WatermarkImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<Kind>(DEFAULTS.kind);
  const [text, setText] = useState(DEFAULTS.text);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [position, setPosition] = useState<WatermarkPosition>(DEFAULTS.position);
  const [opacity, setOpacity] = useState(DEFAULTS.opacity);
  const [fontSize, setFontSize] = useState(DEFAULTS.fontSize);
  const [color, setColor] = useState(DEFAULTS.color);
  const [rotation, setRotation] = useState(DEFAULTS.rotation);
  const [imageScale, setImageScale] = useState(DEFAULTS.imageScale);
  const logoInput = useRef<HTMLInputElement>(null);
  const run = useToolRun<Result>();
  const file = files[0];
  const info = useImageInfo(file);
  usePasteImage((f) => setFiles([f]), run.status === 'idle');

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!logo) {
      setLogoUrl(null);
      return;
    }
    const url = URL.createObjectURL(logo);
    setLogoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const pickLogo = (f: File | undefined) => {
    if (!f) return;
    if (!LOGO_TYPES.includes(f.type)) setLogoError('Please choose a PNG, JPG or WebP logo.');
    else if (f.size > MAX_LOGO_BYTES) setLogoError(`That logo is ${formatFileSize(f.size)}. The maximum is 10 MB.`);
    else {
      setLogoError(null);
      setLogo(f);
    }
  };

  const settings: WatermarkSettings = useMemo(
    () => ({ kind, text, logoUrl: kind === 'logo' ? logoUrl : null, position, opacity, fontSize, color, rotation, imageScale }),
    [kind, text, logoUrl, position, opacity, fontSize, color, rotation, imageScale]
  );

  const ready = !!file && (kind === 'text' ? text.trim().length > 0 : !!logo);
  const loaded = info && !info.failed;

  const apply = () => {
    if (!file || !ready) return;
    run.run((req) =>
      addImageWatermark(
        file,
        kind === 'text' ? text.trim() : '',
        { position, opacity, fontSize, color, rotation, image: kind === 'logo' ? logo ?? undefined : undefined, imageScale },
        req
      )
    );
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setKind(DEFAULTS.kind);
    setText(DEFAULTS.text);
    setLogo(null);
    setLogoError(null);
    setPosition(DEFAULTS.position);
    setOpacity(DEFAULTS.opacity);
    setFontSize(DEFAULTS.fontSize);
    setColor(DEFAULTS.color);
    setRotation(DEFAULTS.rotation);
    setImageScale(DEFAULTS.imageScale);
  };

  const meta = run.result?.metadata;

  return (
    <ToolLayout
      title="Add Watermark to Image"
      description="Stamp your name, text or logo on a photo. See the result before you start."
      icon={Stamp}
      tone="indigo"
      status={run.announcement}
      width="lg"
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Add a watermark to an image">
          <FileUploader accept={IMAGE_ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="indigo" typeLabel={IMAGE_TYPE_LABEL} title="Drag & drop an image here" hint={IMAGE_PASTE_HINT} />

          {!file && (
            <FeatureGrid
              tone="indigo"
              items={[
                { icon: Droplets, label: 'Text or logo', desc: 'Any colour, opacity and angle' },
                { icon: Move, label: '9 positions or tiled', desc: 'Corner stamp or full pattern' },
                { icon: Languages, label: 'Any language', desc: 'Thai, Chinese, Arabic, Hindi and more' },
              ]}
            />
          )}

          {file && (
            <div className="mt-2 space-y-5">
              <div className="mt-4">
                {loaded ? (
                  <figure>
                    <WatermarkPreview imageUrl={info.url} width={info.width} height={info.height} settings={settings} label="Preview of the watermark on your image" />
                    <figcaption className="mt-2 text-center text-xs text-gray-700">
                      Preview · {info.width} × {info.height} px · {formatFileSize(file.size)}
                    </figcaption>
                    {(info.width * info.height) / 1e6 > MAX_MEGAPIXELS && (
                      <p role="alert" className="mt-2 text-center text-xs text-amber-800">This picture is over {MAX_MEGAPIXELS} megapixels, which is more than the server accepts.</p>
                    )}
                  </figure>
                ) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-700">
                    {info?.failed ? 'This browser cannot preview this file, but you can still try adding the watermark.' : 'Loading preview...'}
                  </p>
                )}
              </div>

              <ChoiceGroup
                label="Watermark"
                tone="indigo"
                value={kind}
                onChange={setKind}
                columns={2}
                options={[
                  { value: 'text', label: 'Text' },
                  { value: 'logo', label: 'Logo image' },
                ]}
              />

              {kind === 'text' ? (
                <Field label="Watermark text" hint="Any language works, for example a name, a copyright line or DRAFT." required>
                  <Input className="h-11" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder="© Your name" />
                </Field>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">Logo</p>
                  <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose a logo image" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
                  {logo && logoUrl ? (
                    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="" className="h-12 w-12 rounded bg-white object-contain" />
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{logo.name}</span>
                      <Button type="button" variant="ghost" size="touch" onClick={() => logoInput.current?.click()}>Change</Button>
                      <Button type="button" variant="ghost" size="icon-touch" aria-label="Remove logo" onClick={() => setLogo(null)}><X className="h-5 w-5" /></Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="touch" onClick={() => logoInput.current?.click()}>
                      <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Choose logo (PNG, JPG or WebP, up to 10 MB)
                    </Button>
                  )}
                  {logoError && <p role="alert" className="text-sm text-red-700">{logoError}</p>}
                  <p className="text-xs text-gray-600">A PNG with a transparent background looks best.</p>
                </div>
              )}

              <PositionPicker value={position} onChange={setPosition} />

              <Field label={`Opacity: ${Math.round(opacity * 100)}%`}>
                <input type="range" min={10} max={100} step={5} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-valuetext={`${Math.round(opacity * 100)} percent`} className="h-11 w-full accent-indigo-600" />
              </Field>

              {kind === 'text' ? (
                <>
                  <Field label={`Text size: ${fontSize}`} hint="The same on small and large pictures: it scales with the image.">
                    <input type="range" min={10} max={200} step={1} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} aria-valuetext={`Size ${fontSize}`} className="h-11 w-full accent-indigo-600" />
                  </Field>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-gray-800">Colour</legend>
                    <div className="flex flex-wrap items-center gap-2">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          aria-label={c.label}
                          aria-pressed={color === c.value}
                          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${color === c.value ? 'border-indigo-600' : 'border-gray-300'}`}
                        >
                          <span className="h-7 w-7 rounded-full border border-gray-300" style={{ backgroundColor: c.value }} />
                        </button>
                      ))}
                      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom colour" className="h-11 w-14 cursor-pointer rounded-md border border-gray-300 bg-white p-1" />
                    </div>
                  </fieldset>
                </>
              ) : (
                <Field label={`Logo size: ${imageScale}% of the image width`}>
                  <input type="range" min={2} max={100} step={1} value={imageScale} onChange={(e) => setImageScale(Number(e.target.value))} aria-valuetext={`${imageScale} percent of the image width`} className="h-11 w-full accent-indigo-600" />
                </Field>
              )}

              <OptionsPanel collapsible title="Rotation">
                <Field label={`Angle: ${rotation}° clockwise`}>
                  <input type="range" min={0} max={360} step={5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} aria-valuetext={`${rotation} degrees clockwise`} className="h-11 w-full accent-indigo-600" />
                </Field>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Rotation presets">
                  {ROTATIONS.map((r) => (
                    <Button key={r.value} type="button" variant="outline" size="touch" aria-pressed={rotation === r.value} onClick={() => setRotation(r.value)}>
                      {r.label}
                    </Button>
                  ))}
                </div>
              </OptionsPanel>

              <InfoNote>The preview is drawn the way the server will draw it. Colours and the upright orientation are kept; animated GIFs become a still PNG, and animated WebP stays animated.</InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="indigo" icon={<Stamp className="h-5 w-5" />} onClick={apply} disabled={!ready}>
                  Add watermark
                </PrimaryButton>
              </div>
              {!ready && <p className="text-center text-xs text-gray-600">{kind === 'text' ? 'Enter the watermark text to continue.' : 'Choose a logo to continue.'}</p>}
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
          tone="indigo"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your watermarked image is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download image"
          resetLabel="Watermark another image"
          onReset={startOver}
          tone="indigo"
          stats={
            <>
              <StatTile label="Watermark" value={meta?.watermark_type === 'image' ? 'Logo' : 'Text'} />
              <StatTile label="Position" value={(meta?.position ?? position).replace('-', ' ')} />
              <StatTile label="Original file" value={bytes(meta?.original_size ?? file?.size)} />
              <StatTile label="New file" value={bytes(meta?.output_size ?? run.result.file_size)} accent />
            </>
          }
        >
          {meta?.animation_dropped && <p className="text-center text-sm text-gray-700">Only the first frame was kept: the result is a still image.</p>}
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={apply}
          onEdit={run.backToEdit}
          editLabel="Change watermark or image"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
