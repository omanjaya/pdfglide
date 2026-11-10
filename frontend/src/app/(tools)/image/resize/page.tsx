'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2, Link2Off, Maximize2, Percent, Ruler, ScanLine } from 'lucide-react';
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
import { ImagePreview, IMAGE_ACCEPT, IMAGE_PASTE_HINT, IMAGE_TYPE_LABEL, bytes, useImageInfo, usePasteImage } from '@/components/image/imageTools';
import { useToolRun } from '@/hooks/useToolRun';
import { resizeImage, ImageTaskResponse, ResizeImageStats } from '@/lib/api';
import { cn } from '@/lib/utils';

type Result = ImageTaskResponse<ResizeImageStats>['data'];
type Mode = 'pixels' | 'percent';
type Fit = 'exact' | 'cover';

const MAX_SIDE = 10000;
const MAX_PIXELS = 100_000_000;
const WIDTH_PRESETS = [3840, 1920, 1280, 1080, 800];
const PERCENT_PRESETS = [25, 50, 75, 150, 200];

/** Python's round(): halves go to the even number (the server's rounding). */
function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/** Same arithmetic as the server (backend/app/processors/image/resizer.py compute_size). */
function computeSize(sw: number, sh: number, width: number | undefined, height: number | undefined, fit: 'contain' | Fit, pct: number | undefined, noUpscale: boolean): [number, number] {
  let w: number;
  let h: number;
  if (pct) {
    w = Math.max(1, pyRound((sw * pct) / 100));
    h = Math.max(1, pyRound((sh * pct) / 100));
  } else if (fit === 'contain') {
    if (width && height) {
      if (width * sh <= height * sw) [w, h] = [width, Math.max(1, pyRound((sh * width) / sw))];
      else [w, h] = [Math.max(1, pyRound((sw * height) / sh)), height];
    } else if (width) [w, h] = [width, Math.max(1, pyRound((sh * width) / sw))];
    else [w, h] = [Math.max(1, pyRound((sw * (height as number)) / sh)), height as number];
  } else {
    w = width || Math.max(1, pyRound((sw * (height as number)) / sh));
    h = height || Math.max(1, pyRound((sh * (width as number)) / sw));
  }
  if (noUpscale && (w > sw || h > sh)) {
    if (fit === 'contain' || pct) {
      const scale = Math.min(sw / w, sh / h, 1);
      [w, h] = [Math.max(1, pyRound(w * scale)), Math.max(1, pyRound(h * scale))];
    } else {
      [w, h] = [Math.min(w, sw), Math.min(h, sh)];
    }
  }
  return [w, h];
}

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 5);

export default function ResizeImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('pixels');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [anchor, setAnchor] = useState<'w' | 'h'>('w');
  const [locked, setLocked] = useState(true);
  const [fit, setFit] = useState<Fit>('exact');
  const [percent, setPercent] = useState('50');
  const [noUpscale, setNoUpscale] = useState(false);
  const [quality, setQuality] = useState(90);
  const run = useToolRun<Result>();
  const file = files[0];
  const info = useImageInfo(file);
  usePasteImage((f) => setFiles([f]), run.status === 'idle');

  const sw = info && !info.failed ? info.width : 0;
  const sh = info && !info.failed ? info.height : 0;

  // Start from the picture's own size.
  useEffect(() => {
    if (sw && sh) {
      setWidth(String(sw));
      setHeight(String(sh));
      setAnchor('w');
    }
  }, [sw, sh, info?.url]);

  const setW = (v: string) => {
    setWidth(v);
    setAnchor('w');
    if (locked && sw && Number(v) > 0) setHeight(String(Math.max(1, pyRound((sh * Number(v)) / sw))));
  };
  const setH = (v: string) => {
    setHeight(v);
    setAnchor('h');
    if (locked && sh && Number(v) > 0) setWidth(String(Math.max(1, pyRound((sw * Number(v)) / sh))));
  };
  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    if (next && sw) (anchor === 'w' ? setW : setH)(anchor === 'w' ? width : height);
  };

  const pct = Number(percent);
  const wN = Number(width);
  const hN = Number(height);

  // What the server will be asked for, and the size it will produce.
  const plan = useMemo(() => {
    if (!sw || !sh) return null;
    if (mode === 'percent') {
      if (!(pct >= 1 && pct <= 1000)) return { error: 'Enter a percentage between 1 and 1000.' };
      return { size: computeSize(sw, sh, undefined, undefined, 'contain', pct, noUpscale), pct, fit: 'contain' as const };
    }
    const okW = wN >= 1 && wN <= MAX_SIDE;
    const okH = hN >= 1 && hN <= MAX_SIDE;
    if (locked) {
      if (anchor === 'w' ? !okW : !okH) return { error: `Enter a ${anchor === 'w' ? 'width' : 'height'} from 1 to ${MAX_SIDE} px.` };
      const w = anchor === 'w' ? wN : undefined;
      const h = anchor === 'h' ? hN : undefined;
      return { size: computeSize(sw, sh, w, h, 'contain', undefined, noUpscale), w, h, fit: 'contain' as const };
    }
    if (!okW || !okH) return { error: `Width and height must each be from 1 to ${MAX_SIDE} px.` };
    return { size: computeSize(sw, sh, wN, hN, fit, undefined, noUpscale), w: wN, h: hN, fit };
  }, [sw, sh, mode, pct, wN, hN, locked, anchor, fit, noUpscale]);

  const size = plan && 'size' in plan ? plan.size : null;
  const planError = plan && 'error' in plan ? plan.error : null;
  const tooLarge = size ? size[0] * size[1] > MAX_PIXELS : false;
  const upscales = size ? size[0] > sw || size[1] > sh : false;
  const unchanged = size ? size[0] === sw && size[1] === sh : false;
  const canRun = !!file && !!size && !tooLarge && !unchanged;

  const resize = () => {
    if (!file || !plan || !('size' in plan)) return;
    const sendQuality = /jpeg|webp/.test(file.type) ? quality : undefined;
    run.run((req) =>
      resizeImage(file, plan.w, plan.h, plan.fit === 'contain', {
        ...req,
        fit: plan.fit,
        percentage: plan.pct,
        noUpscale,
        quality: sendQuality,
      })
    );
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setMode('pixels');
    setLocked(true);
    setFit('exact');
    setPercent('50');
    setNoUpscale(false);
    setQuality(90);
  };

  const meta = run.result?.metadata;
  const dims = (w?: number, h?: number) => (w && h ? `${w} × ${h} px` : '');

  return (
    <ToolLayout
      title="Resize Image"
      description="Change the size of a JPG, PNG, WebP or GIF by pixels or percentage."
      icon={Maximize2}
      tone="purple"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Resize an image">
          <FileUploader accept={IMAGE_ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="purple" typeLabel={IMAGE_TYPE_LABEL} title="Drag & drop an image here" hint={IMAGE_PASTE_HINT} />

          {!file && (
            <FeatureGrid
              tone="purple"
              items={[
                { icon: Ruler, label: 'Exact pixels', desc: 'See the new size before you start' },
                { icon: Percent, label: 'Or by percentage', desc: 'Half size, double size' },
                { icon: ScanLine, label: 'Keeps the shape', desc: 'Aspect ratio lock, upright photos' },
              ]}
            />
          )}

          {file && (
            <div className="mt-2 space-y-5">
              <ImagePreview file={file} info={info} />

              {info?.failed && <InfoNote>The size of this picture could not be read, so it cannot be resized. Please choose another image.</InfoNote>}
              {sw > 0 && (
                <>
                  <ChoiceGroup
                    label="Resize by"
                    tone="purple"
                    value={mode}
                    onChange={setMode}
                    columns={2}
                    options={[
                      { value: 'pixels', label: 'Pixels' },
                      { value: 'percent', label: 'Percentage' },
                    ]}
                  />

                  {mode === 'pixels' ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                        <Field label="Width (px)" error={plan && 'error' in plan && anchor === 'w' ? planError : null}>
                          <Input className="h-11" inputMode="numeric" autoComplete="off" value={width} onChange={(e) => setW(digits(e.target.value))} />
                        </Field>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-touch"
                          aria-pressed={locked}
                          aria-label={locked ? 'Aspect ratio locked. Press to unlock' : 'Aspect ratio unlocked. Press to lock'}
                          onClick={toggleLock}
                          className={cn('mb-0', locked && 'border-purple-500 bg-purple-50 text-purple-800')}
                        >
                          {locked ? <Link2 className="h-5 w-5" /> : <Link2Off className="h-5 w-5" />}
                        </Button>
                        <Field label="Height (px)" error={plan && 'error' in plan && anchor === 'h' ? planError : null}>
                          <Input className="h-11" inputMode="numeric" autoComplete="off" value={height} onChange={(e) => setH(digits(e.target.value))} />
                        </Field>
                      </div>
                      {!locked && (
                        <ChoiceGroup
                          label="When the shape changes"
                          tone="purple"
                          value={fit}
                          onChange={setFit}
                          columns={2}
                          options={[
                            { value: 'exact', label: 'Stretch', description: 'Squash to the new size' },
                            { value: 'cover', label: 'Crop to fill', description: 'Keep the centre' },
                          ]}
                        />
                      )}
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Width presets">
                        {WIDTH_PRESETS.map((p) => (
                          <Button key={p} type="button" variant="outline" size="touch" onClick={() => { setLocked(true); setW(String(p)); }}>
                            {p} px wide
                          </Button>
                        ))}
                        <Button type="button" variant="ghost" size="touch" onClick={() => { setLocked(true); setW(String(sw)); }}>
                          Original
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Field label="Percentage" error={planError} hint="100% keeps the size. 50% halves each side.">
                        <Input className="h-11 max-w-[8rem]" inputMode="decimal" autoComplete="off" value={percent} onChange={(e) => setPercent(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} />
                      </Field>
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Percentage presets">
                        {PERCENT_PRESETS.map((p) => (
                          <Button key={p} type="button" variant="outline" size="touch" onClick={() => setPercent(String(p))}>
                            {p}%
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl bg-purple-50 px-4 py-3 text-center" aria-live="polite">
                    <p className="text-xs text-purple-900">New size</p>
                    <p className="text-lg font-bold text-purple-900">{size ? `${size[0]} × ${size[1]} px` : 'Enter a size'}</p>
                    <p className="text-xs text-purple-900">Now {sw} × {sh} px</p>
                  </div>

                  {upscales && !tooLarge && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <div>
                        <p>This makes the picture larger than the original, so it will look softer. Enlarging cannot add detail.</p>
                        <label className="mt-1 flex min-h-[44px] cursor-pointer items-center gap-2 font-medium">
                          <input type="checkbox" checked={noUpscale} onChange={(e) => setNoUpscale(e.target.checked)} className="h-5 w-5 accent-purple-700" />
                          Do not enlarge
                        </label>
                      </div>
                    </div>
                  )}
                  {tooLarge && (
                    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      That is more than {MAX_PIXELS / 1e6} megapixels, which the server does not accept. Choose a smaller size.
                    </p>
                  )}
                  {unchanged && <InfoNote>This is the size the picture already has. Change the width, height or percentage.</InfoNote>}

                  {/jpeg|webp/.test(file.type) && (
                    <OptionsPanel collapsible title="More options">
                      <Field label={`Output quality: ${quality}`} hint="Higher is sharper and gives a larger file.">
                        <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} aria-valuetext={`Quality ${quality} out of 100`} className="h-11 w-full accent-purple-700" />
                      </Field>
                    </OptionsPanel>
                  )}
                </>
              )}

              <div className="flex justify-center">
                <PrimaryButton tone="purple" icon={<Maximize2 className="h-5 w-5" />} onClick={resize} disabled={!canRun}>
                  Resize image
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
          title="Resizing your image"
          tone="purple"
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
          resetLabel="Resize another image"
          onReset={startOver}
          tone="purple"
          stats={
            <>
              <StatTile label="Before" value={dims(meta?.original_width, meta?.original_height) || dims(sw, sh)} />
              <StatTile label="After" value={dims(meta?.width, meta?.height)} accent />
              <StatTile label="Original file" value={bytes(meta?.original_size ?? file?.size)} />
              <StatTile label="New file" value={bytes(meta?.output_size ?? run.result.file_size)} />
            </>
          }
        >
          <div className="space-y-1 text-center text-sm text-gray-700">
            {meta?.upscaled && <p>The picture was enlarged, so it may look softer than the original.</p>}
            {meta?.animation_dropped && <p>Only the first frame was kept: this format cannot hold the animation.</p>}
          </div>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={resize}
          onEdit={run.backToEdit}
          editLabel="Change size or image"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
