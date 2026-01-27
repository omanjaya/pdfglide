'use client';

import { useState, useCallback } from 'react';

interface UseFileUploadOptions {
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
}

interface UseFileUploadReturn {
  files: File[];
  addFiles: (newFiles: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}): UseFileUploadReturn {
  const { maxFiles = 20, maxSize = 100 * 1024 * 1024, acceptedTypes } = options;
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      setError(null);

      // Validate file count
      if (files.length + newFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Validate each file
      for (const file of newFiles) {
        // Check size
        if (file.size > maxSize) {
          setError(`File "${file.name}" exceeds maximum size of ${maxSize / 1024 / 1024}MB`);
          return;
        }

        // Check type
        if (acceptedTypes && acceptedTypes.length > 0) {
          const isAccepted = acceptedTypes.some(
            (type) => file.type === type || file.name.toLowerCase().endsWith(type.replace('*', ''))
          );
          if (!isAccepted) {
            setError(`File "${file.name}" has an unsupported format`);
            return;
          }
        }
      }

      setFiles((prev) => [...prev, ...newFiles]);
    },
    [files.length, maxFiles, maxSize, acceptedTypes]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    clearFiles,
    error,
    setError,
  };
}
