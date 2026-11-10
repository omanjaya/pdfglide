'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Download, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatFileSize } from '@/lib/utils';
import { getDownloadUrl } from '@/lib/api';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { getTheme, ToolTone } from './toolThemes';
import { RESULT_LIFETIME_SECONDS, RETENTION_EXPIRED, RETENTION_RESULT } from './toolCopy';

interface ResultCardProps {
  /** e.g. "Your PDF is ready". */
  title: string;
  /** Exactly the `file_name` the API returned. Display only: the download name comes from the server. */
  fileName?: string;
  fileSize?: number;
  /** The `download_url` path from the API (e.g. "/api/v1/download/..."). */
  downloadUrl?: string;
  /** Label of the main button (default "Download"). */
  downloadLabel?: string;
  /** Before/after stats tiles (see StatTile) or any extra summary content. */
  stats?: ReactNode;
  /** Extra content under the file row (notes, warnings, previews). */
  children?: ReactNode;
  /** "Start over" / "Process another file". */
  onReset?: () => void;
  resetLabel?: string;
  /** Extra buttons (Copy text, Download .txt...) shown with the main actions. */
  actions?: ReactNode;
  /** Override the retention sentence under the buttons; `null` hides it. */
  retentionNote?: string | null;
  /** Show a Copy link button (copies the full download URL). */
  copyLink?: boolean;
  /**
   * Seconds the download stays available, counted from when this card appears.
   * Defaults to the site-wide 2 minutes; `null` hides the countdown.
   */
  lifetimeSeconds?: number | null;
  tone?: ToolTone;
}

/** One before/after number, for the `stats` slot: <StatTile label="Original" value="2.4 MB" /> */
export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={cn('rounded-xl p-3 text-center', accent ? 'bg-green-50' : 'bg-gray-50')}>
      <p className={cn('text-xs', accent ? 'text-green-800' : 'text-gray-600')}>{label}</p>
      <p className={cn('text-base font-bold sm:text-lg', accent ? 'text-green-800' : 'text-gray-800')}>{value}</p>
    </div>
  );
}

function formatCountdown(seconds: number): string {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** Seconds left until `lifetimeSeconds` after mount; `null` when there is no countdown. */
function useCountdown(lifetimeSeconds: number | null, active: boolean): number | null {
  const [remaining, setRemaining] = useState<number | null>(active ? lifetimeSeconds : null);

  useEffect(() => {
    if (!active || lifetimeSeconds === null) {
      setRemaining(null);
      return;
    }
    // Wall-clock deadline, so a throttled background tab still shows the right time.
    const deadline = Date.now() + lifetimeSeconds * 1000;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [active, lifetimeSeconds]);

  return remaining;
}

/** Success card. Moves keyboard focus to its heading when it appears. */
export function ResultCard({
  title,
  fileName,
  fileSize,
  downloadUrl,
  downloadLabel = 'Download',
  stats,
  children,
  onReset,
  resetLabel = 'Process another file',
  copyLink = false,
  actions,
  retentionNote,
  lifetimeSeconds = RESULT_LIFETIME_SECONDS,
  tone,
}: ResultCardProps) {
  const theme = getTheme(tone);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { copy, copied, failed } = useCopyToClipboard();
  const href = downloadUrl ? getDownloadUrl(downloadUrl) : undefined;
  const remaining = useCountdown(lifetimeSeconds, Boolean(href));
  const expired = remaining === 0;
  const urgent = remaining !== null && remaining <= 30;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="result-title"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8"
    >
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
        >
          <CheckCircle2 className="h-8 w-8 text-green-700" />
        </div>
        <h2
          id="result-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-gray-900 focus:outline-none"
        >
          {title}
        </h2>
      </div>

      {remaining !== null && !expired && (
        <div
          className={cn(
            'mt-4 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium',
            urgent ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'
          )}
        >
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Download now. This file is deleted in{' '}
            <span role="timer" aria-live="off" className="font-bold tabular-nums">
              {formatCountdown(remaining)}
            </span>
          </p>
        </div>
      )}
      {expired && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm text-gray-800"
        >
          <Trash2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{RETENTION_EXPIRED}</p>
        </div>
      )}
      {/* Announce the deadline once and the last 30 seconds once; never every second. */}
      <p className="sr-only" aria-live="polite">
        {remaining === null || expired
          ? ''
          : urgent
            ? 'Less than 30 seconds left to download this file.'
            : 'This file is kept for 2 minutes. Download it now.'}
      </p>

      {stats && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{stats}</div>}

      {(fileName || fileSize) && (
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-gray-50 p-3 sm:p-4">
          <div
            aria-hidden="true"
            className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', theme.softStrong)}
          >
            <FileText className={cn('h-6 w-6', theme.text)} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="break-words text-sm font-medium text-gray-900 sm:text-base">{fileName}</p>
            {fileSize ? <p className="text-sm text-gray-600">{formatFileSize(fileSize)}</p> : null}
          </div>
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {href && !expired && (
          <Button
            asChild
            size="lg"
            className={cn('min-h-[48px] px-8 text-base font-semibold', theme.solid, theme.ring)}
          >
            <a href={href} download>
              <Download className="mr-2 h-5 w-5" aria-hidden="true" />
              {downloadLabel}
            </a>
          </Button>
        )}
        {href && copyLink && !expired && (
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={() => copy(href)}>
            {copied ? (
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {copied ? 'Link copied' : failed ? 'Copy failed' : 'Copy link'}
          </Button>
        )}
        {actions}
        {onReset && (
          <Button
            type="button"
            variant={expired ? 'default' : 'outline'}
            size="lg"
            className={cn('min-h-[48px]', expired && cn('px-8 text-base font-semibold', theme.solid, theme.ring))}
            onClick={onReset}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            {resetLabel}
          </Button>
        )}
      </div>

      {!expired && retentionNote !== null && (retentionNote || href) && (
        <p className="mt-4 text-center text-xs text-gray-600">{retentionNote ?? RETENTION_RESULT}</p>
      )}
    </section>
  );
}
