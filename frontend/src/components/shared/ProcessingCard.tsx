'use client';

import { useEffect, useState } from 'react';
import { Check, FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatFileSize } from '@/lib/utils';
import { getTheme, ToolTone } from './toolThemes';

interface ProcessingCardProps {
  /**
   * 'uploading'  real percentage (useToolRun().uploadProgress) + bytes sent.
   * 'queued'     async tools: task accepted, waiting for a worker.
   * 'processing' the server is working: indeterminate bar (or `serverProgress` when the API reports one).
   */
  stage: 'uploading' | 'queued' | 'processing';
  /** 0-100, upload stage only. */
  progress?: number;
  /** Bytes sent / total for the upload stage (useToolRun().uploadLoaded / uploadTotal). Shown for files >= 1 MB. */
  loaded?: number;
  total?: number;
  /** Server-reported 0-100 progress (polling tools). Omit for single POST tools: never invent one. */
  serverProgress?: number;
  /** Files being processed; names and sizes stay visible. */
  files?: { name: string; size?: number }[];
  /** Convenience for a single file. */
  fileName?: string;
  fileSize?: number;
  /** Tool-specific verb phrase for the processing stage, e.g. "Compressing your PDF". */
  title?: string;
  /** Extra expectation text shown under the bar, e.g. "Scans are read page by page." */
  hint?: string;
  tone?: ToolTone;
  /** Shows Cancel when provided (wire `useToolRun().cancel`). */
  onCancel?: () => void;
}

const STEPS = ['Uploading', 'Processing', 'Done'] as const;

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The prominent in-progress state. Replaces the form while work runs (no double submit),
 * keeps file names visible, shows Uploading -> Processing -> Done steps, a real upload
 * percentage, an indeterminate bar for server work, elapsed time after 3 s, an honest
 * "keep this tab open" note after 10 s, and a Cancel button. No fake percentages or ETAs.
 */
export function ProcessingCard({
  stage,
  progress = 0,
  loaded,
  total,
  serverProgress,
  files,
  fileName,
  fileSize,
  title,
  hint,
  tone,
  onCancel,
}: ProcessingCardProps) {
  const theme = getTheme(tone);
  const uploading = stage === 'uploading';
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const list = files ?? (fileName ? [{ name: fileName, size: fileSize }] : []);

  // Elapsed seconds in the current stage. Visual only.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const heading = uploading ? 'Uploading your file' : stage === 'queued' ? 'Waiting for a free worker' : title || 'Processing your file';
  const stepIndex = uploading ? 0 : 1;
  const showBytes = uploading && total && total >= 1024 * 1024;
  const determinate = uploading || (stage === 'processing' && typeof serverProgress === 'number');
  const value = uploading ? pct : Math.round(serverProgress ?? 0);
  const statusText = uploading
    ? `Step 1 of 3: uploading, ${pct}% done`
    : `Step 2 of 3: ${heading}${typeof serverProgress === 'number' ? `, ${value}% done` : ''}`;

  return (
    <section aria-label="Progress" aria-busy="true" className="rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm sm:p-8">
      {/* Step indicator */}
      <ol className="mx-auto mb-6 flex max-w-sm items-center justify-between" aria-label="Steps">
        {STEPS.map((label, i) => {
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo';
          return (
            <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={state === 'current' ? 'step' : undefined}>
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                    state === 'done' && 'border-green-600 bg-green-600 text-white',
                    state === 'current' && cn(theme.border, theme.softStrong, theme.text),
                    state === 'todo' && 'border-gray-300 bg-white text-gray-500'
                  )}
                >
                  {state === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                </span>
                <span className={cn('text-xs', state === 'current' ? 'font-semibold text-gray-900' : 'text-gray-600')}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span aria-hidden="true" className={cn('mx-2 mb-5 h-0.5 flex-1', i < stepIndex ? 'bg-green-600' : 'bg-gray-200')} />
              )}
            </li>
          );
        })}
      </ol>

      <div aria-hidden="true" className={cn('mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full', theme.softStrong)}>
        <Loader2 className={cn('h-7 w-7 animate-spin motion-reduce:animate-none', theme.text)} />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
        {heading}
        {!uploading && '…'}
      </h2>

      {list.length > 0 && (
        <ul className="mx-auto mt-3 max-w-sm space-y-1.5 text-left">
          {list.slice(0, 4).map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <FileText className={cn('h-4 w-4 shrink-0', theme.text)} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-gray-900" title={f.name}>{f.name}</span>
              {f.size ? <span className="shrink-0 text-xs text-gray-600">{formatFileSize(f.size)}</span> : null}
            </li>
          ))}
          {list.length > 4 && <li className="px-3 text-xs text-gray-600">and {list.length - 4} more files</li>}
        </ul>
      )}

      <div
        role="progressbar"
        aria-label={heading}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? value : undefined}
        aria-valuetext={determinate ? `${value}%` : 'In progress'}
        className="mx-auto mt-5 h-3 w-full max-w-sm overflow-hidden rounded-full bg-gray-100"
      >
        {determinate ? (
          <div className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-200 motion-reduce:transition-none', theme.icon)} style={{ width: `${value}%` }} />
        ) : (
          <div className={cn('h-full w-full animate-pulse rounded-full bg-gradient-to-r motion-reduce:animate-none', theme.icon)} />
        )}
      </div>

      <p className="mt-2 text-sm text-gray-700" aria-hidden="true">
        {uploading ? (
          <>
            {pct}% uploaded
            {showBytes && loaded !== undefined && total ? ` · ${formatFileSize(loaded)} of ${formatFileSize(total)}` : ''}
          </>
        ) : determinate ? (
          `${value}% complete`
        ) : (
          'Working on it' + (elapsed >= 3 ? ` · ${mmss(elapsed)} elapsed` : '')
        )}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
      {!uploading && elapsed >= 10 && (
        <p className="mx-auto mt-3 max-w-sm rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Large or scanned files can take a minute. Please keep this tab open.
        </p>
      )}

      {/* Announced once per stage change, not every tick. */}
      <p role="status" aria-live="polite" className="sr-only">{uploading ? 'Step 1 of 3: uploading your file' : statusText}</p>

      {onCancel && (
        <Button type="button" variant="outline" size="touch" onClick={onCancel} className="mt-5">
          <X className="mr-2 h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
      )}
    </section>
  );
}
