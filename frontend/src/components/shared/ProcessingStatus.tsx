'use client';

import { CheckCircle2, Loader2, XCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { formatFileSize } from '@/lib/utils';
import { getDownloadUrl } from '@/lib/api';

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
}

export function ProcessingStatus({
  status,
  progress = 0,
  message,
  fileName,
  fileSize,
  downloadUrl,
  onRetry,
  onReset,
}: ProcessingStatusProps) {
  if (status === 'idle') return null;

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-6">
      {status === 'uploading' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
            <span className="text-sm sm:text-base font-medium">Uploading...</span>
          </div>
          <Progress value={progress} />
          <p className="text-xs sm:text-sm text-muted-foreground">{progress}% complete</p>
        </div>
      )}

      {status === 'processing' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
            <span className="text-sm sm:text-base font-medium">Processing...</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {message || 'Please wait while we process your file'}
          </p>
        </div>
      )}

      {status === 'completed' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
            <span className="text-sm sm:text-base font-medium">Processing complete!</span>
          </div>
          {fileName && (
            <div className="rounded-lg bg-muted p-3 sm:p-4">
              <p className="text-sm sm:text-base font-medium truncate">{fileName}</p>
              {fileSize && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {formatFileSize(fileSize)}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col xs:flex-row gap-2">
            {downloadUrl && (
              <Button asChild className="w-full xs:w-auto">
                <a href={getDownloadUrl(downloadUrl)} download>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
            {onReset && (
              <Button variant="outline" onClick={onReset} className="w-full xs:w-auto">
                <span className="hidden sm:inline">Process another file</span>
                <span className="sm:hidden">New file</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
            <span className="text-sm sm:text-base font-medium">Processing failed</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {message || 'An error occurred while processing your file'}
          </p>
          <div className="flex flex-col xs:flex-row gap-2">
            {onRetry && (
              <Button onClick={onRetry} className="w-full xs:w-auto">Try again</Button>
            )}
            {onReset && (
              <Button variant="outline" onClick={onReset} className="w-full xs:w-auto">
                Start over
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
