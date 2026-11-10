'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatFileSize } from '@/lib/utils';

interface ErrorCardProps {
  /** The human message (from useToolRun().error / getErrorMessage). Shown as-is. */
  message: string;
  title?: string;
  /** The file(s) the user picked; shown so it's clear nothing was lost. */
  fileName?: string;
  fileSize?: number;
  /** Re-run with the same file and options. */
  onRetry?: () => void;
  /** Go back to the form (files and options kept) to change something. */
  onEdit?: () => void;
  editLabel?: string;
  /** Throw everything away and start over. */
  onReset?: () => void;
}

/** Failure card. role="alert", focus moves to it, offers Try again / change options / Start over. */
export function ErrorCard({
  message,
  title = "We couldn't finish that",
  fileName,
  fileSize,
  onRetry,
  onEdit,
  editLabel = 'Change file or options',
  onReset,
}: ErrorCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:p-8"
    >
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100"
        >
          <AlertCircle className="h-8 w-8 text-red-700" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mx-auto mt-2 max-w-md break-words text-sm text-gray-700 sm:text-base">{message}</p>
        {fileName && (
          <p className="mx-auto mt-3 max-w-full break-words text-xs text-gray-600" title={fileName}>
            Your file {`"${fileName}"`}
            {fileSize ? ` (${formatFileSize(fileSize)})` : ''} and settings are still here.
          </p>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {onRetry && (
          <Button type="button" size="lg" className="min-h-[48px]" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        )}
        {onEdit && (
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={onEdit}>
            <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
            {editLabel}
          </Button>
        )}
        {onReset && (
          <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}
