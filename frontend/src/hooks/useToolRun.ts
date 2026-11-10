'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage, isRequestCancelled, RequestConfig } from '@/lib/api';

export type RunStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface RunResponse<D> {
  success: boolean;
  data: D;
  error?: string | null;
}

/**
 * State machine for one tool run: idle -> uploading -> processing -> done | error.
 * (The "selected" state is simply `idle` with files chosen: the page owns files/options,
 * so they survive errors and cancels and Try again re-sends the same thing.)
 *
 * `run` hands your API call an AbortSignal and an onUploadProgress callback; pass both on
 * as the last argument of the api helper (every helper in lib/api.ts accepts it):
 *
 *   const run = useToolRun<TaskResponse['data']>();
 *   const convert = () => run.run((req) => wordToPdf(files[0], req));
 *
 * - `uploadProgress` is 0-100 while the request body is being sent (single upload),
 *   `status` flips to 'processing' once the upload is complete.
 * - `cancel()` aborts the request and returns to idle with files/options untouched.
 * - `error` is already a human sentence (see getErrorMessage in lib/api.ts).
 * - `announcement` goes to <ToolLayout status={...}> for screen readers.
 */
export function useToolRun<D = unknown>() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bytes, setBytes] = useState({ loaded: 0, total: 0 });
  const [result, setResult] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const runId = useRef(0);

  useEffect(() => () => controller.current?.abort(), []);

  const run = useCallback(async (call: (req: RequestConfig) => Promise<RunResponse<D>>) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const id = ++runId.current;

    setStatus('uploading');
    setUploadProgress(0);
    setBytes({ loaded: 0, total: 0 });
    setError(null);
    setResult(null);

    try {
      const response = await call({
        signal: ctrl.signal,
        onUploadProgress: (e) => {
          if (id !== runId.current) return;
          const total = e.total || 0;
          const pct = total ? Math.min(100, Math.round((e.loaded / total) * 100)) : 0;
          setUploadProgress(pct);
          setBytes({ loaded: e.loaded, total });
          if (total && e.loaded >= total) setStatus('processing');
        },
      });
      if (id !== runId.current) return null;
      if (response.success) {
        setResult(response.data);
        setStatus('done');
        return response.data;
      }
      setError(response.error || 'Processing failed. Please try again.');
      setStatus('error');
      return null;
    } catch (err) {
      if (id !== runId.current) return null;
      if (isRequestCancelled(err)) {
        setStatus('idle');
        return null;
      }
      setError(getErrorMessage(err));
      setStatus('error');
      return null;
    }
  }, []);

  const cancel = useCallback(() => {
    runId.current++;
    controller.current?.abort();
    setStatus('idle');
    setUploadProgress(0);
  }, []);

  /** Back to the form with files/options intact (e.g. "Change options" on an error). */
  const backToEdit = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  /** Full reset. Also clear your own files/options in the page's handleReset. */
  const reset = useCallback(() => {
    runId.current++;
    controller.current?.abort();
    setStatus('idle');
    setUploadProgress(0);
    setResult(null);
    setError(null);
  }, []);

  const announcement =
    status === 'uploading'
      ? `Uploading your file, ${uploadProgress}% done.`
      : status === 'processing'
        ? 'Upload complete. Processing your file.'
        : status === 'done'
          ? 'Done. Your file is ready to download.'
          : status === 'error'
            ? `Failed. ${error ?? ''}`
            : '';

  return {
    status,
    isBusy: status === 'uploading' || status === 'processing',
    uploadProgress,
    /** Bytes sent / total during upload (pass to ProcessingCard `loaded` / `total`). */
    uploadLoaded: bytes.loaded,
    uploadTotal: bytes.total,
    result,
    error,
    announcement,
    run,
    cancel,
    backToEdit,
    reset,
  };
}
