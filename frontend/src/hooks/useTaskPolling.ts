/**
 * Hook for polling async task status.
 * 
 * This hook manages the polling lifecycle for background processing tasks.
 * It automatically starts polling when a task is submitted and stops
 * when the task completes, fails, or is cancelled.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';

export type TaskStatus = 'idle' | 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TaskState {
  taskId: string | null;
  status: TaskStatus;
  progress: number;
  error: string | null;
  downloadUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  expiresAt: string | null;
  metadata?: Record<string, any>;
}

export interface UseTaskPollingOptions {
  /** Polling interval in milliseconds (default: 1000) */
  pollInterval?: number;
  /** Maximum polling duration in milliseconds (default: 600000 = 10 minutes) */
  maxPollDuration?: number;
  /** Callback when task completes successfully */
  onComplete?: (state: TaskState) => void;
  /** Callback when task fails */
  onError?: (error: string, state: TaskState) => void;
  /** Callback on each progress update */
  onProgress?: (progress: number, state: TaskState) => void;
}

export interface UseTaskPollingReturn {
  /** Current task state */
  state: TaskState;
  /** Start polling for a task */
  startPolling: (taskId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Reset state to initial values */
  reset: () => void;
  /** Whether polling is active */
  isPolling: boolean;
}

const initialState: TaskState = {
  taskId: null,
  status: 'idle',
  progress: 0,
  error: null,
  downloadUrl: null,
  fileName: null,
  fileSize: null,
  expiresAt: null,
};

export function useTaskPolling(options: UseTaskPollingOptions = {}): UseTaskPollingReturn {
  const {
    pollInterval = 1000,
    maxPollDuration = 600000, // 10 minutes
    onComplete,
    onError,
    onProgress,
  } = options;

  const [state, setState] = useState<TaskState>(initialState);
  const [isPolling, setIsPolling] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsPolling(false);
    startTimeRef.current = null;
  }, []);

  // Poll for task status
  const pollStatus = useCallback(async (taskId: string) => {
    // Check if we've exceeded max poll duration
    if (startTimeRef.current && Date.now() - startTimeRef.current > maxPollDuration) {
      cleanup();
      const errorState: TaskState = {
        ...state,
        status: 'failed',
        error: 'Polling timeout exceeded',
      };
      setState(errorState);
      onError?.('Polling timeout exceeded', errorState);
      return;
    }

    try {
      const response = await api.get(`/tasks/${taskId}/status`, {
        signal: abortControllerRef.current?.signal,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to get task status');
      }

      const data = response.data.data;
      
      const newState: TaskState = {
        taskId,
        status: data.status as TaskStatus,
        progress: data.progress ?? (data.status === 'completed' ? 100 : state.progress),
        error: data.error || null,
        downloadUrl: data.download_url || null,
        fileName: data.file_name || null,
        fileSize: data.file_size || null,
        expiresAt: data.expires_at || null,
        metadata: data.metadata,
      };

      setState(newState);

      // Handle progress callback
      if (newState.progress !== state.progress) {
        onProgress?.(newState.progress, newState);
      }

      // Handle completion
      if (data.status === 'completed') {
        cleanup();
        onComplete?.(newState);
        return;
      }

      // Handle failure
      if (data.status === 'failed' || data.status === 'cancelled') {
        cleanup();
        onError?.(data.error || 'Task failed', newState);
        return;
      }
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return;
      }

      console.error('Error polling task status:', error);
      
      // Don't stop polling on network errors, just log them
      // The task might still be processing on the server
    }
  }, [state, maxPollDuration, cleanup, onComplete, onError, onProgress]);

  // Start polling for a task
  const startPolling = useCallback((taskId: string) => {
    // Cleanup any existing polling
    cleanup();

    // Initialize state
    setState({
      ...initialState,
      taskId,
      status: 'pending',
    });

    // Set up abort controller
    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();
    setIsPolling(true);

    // Start polling
    pollStatus(taskId);
    pollIntervalRef.current = setInterval(() => {
      pollStatus(taskId);
    }, pollInterval);
  }, [cleanup, pollStatus, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Reset state
  const reset = useCallback(() => {
    cleanup();
    setState(initialState);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    startPolling,
    stopPolling,
    reset,
    isPolling,
  };
}

export default useTaskPolling;
