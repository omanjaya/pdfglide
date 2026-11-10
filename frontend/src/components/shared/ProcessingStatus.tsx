'use client';

import { ProcessingCard } from './ProcessingCard';
import { ResultCard } from './ResultCard';
import { ErrorCard } from './ErrorCard';
import type { ToolTone } from './toolThemes';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface ProcessingStatusProps {
  status: Status;
  progress?: number;
  message?: string;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  onRetry?: () => void;
  onReset?: () => void;
  tone?: ToolTone;
}

/**
 * Legacy all-in-one status block, kept so existing pages keep working. It now renders the
 * shared ProcessingCard / ResultCard / ErrorCard. New code: use those directly with
 * `useToolRun` (see UI_GUIDELINES.md).
 */
export function ProcessingStatus({
  status,
  progress = 0,
  message,
  fileName,
  fileSize,
  downloadUrl,
  onRetry,
  onReset,
  tone,
}: ProcessingStatusProps) {
  if (status === 'idle') return null;
  if (status === 'uploading' || status === 'processing') {
    return (
      <ProcessingCard
        stage={status}
        progress={progress}
        hint={status === 'processing' ? message : undefined}
        tone={tone}
      />
    );
  }
  if (status === 'completed') {
    return (
      <ResultCard
        title="Your file is ready"
        fileName={fileName}
        fileSize={fileSize}
        downloadUrl={downloadUrl}
        onReset={onReset}
        tone={tone}
      />
    );
  }
  return (
    <ErrorCard
      message={message || 'Something went wrong while processing your file.'}
      onRetry={onRetry}
      onReset={onReset}
    />
  );
}
