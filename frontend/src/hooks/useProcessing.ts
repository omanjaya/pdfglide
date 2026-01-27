'use client';

import { useState, useCallback } from 'react';
import { TaskResponse } from '@/lib/api';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface UseProcessingReturn {
  status: Status;
  progress: number;
  result: TaskResponse['data'] | null;
  error: string | null;
  setStatus: (status: Status) => void;
  setProgress: (progress: number) => void;
  setResult: (result: TaskResponse['data'] | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  processFile: <T>(
    apiCall: () => Promise<{ success: boolean; data: T; error?: string }>
  ) => Promise<T | null>;
}

export function useProcessing(): UseProcessingReturn {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  const processFile = useCallback(
    async <T>(
      apiCall: () => Promise<{ success: boolean; data: T; error?: string }>
    ): Promise<T | null> => {
      setStatus('processing');
      setError(null);
      setProgress(0);

      try {
        const response = await apiCall();

        if (response.success) {
          setResult(response.data as any);
          setStatus('completed');
          setProgress(100);
          return response.data;
        } else {
          setError(response.error || 'Processing failed');
          setStatus('error');
          return null;
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.detail || err.message || 'An error occurred';
        setError(errorMessage);
        setStatus('error');
        return null;
      }
    },
    []
  );

  return {
    status,
    progress,
    result,
    error,
    setStatus,
    setProgress,
    setResult,
    setError,
    reset,
    processFile,
  };
}
