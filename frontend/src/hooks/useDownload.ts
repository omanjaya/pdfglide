'use client';

import { useCallback } from 'react';
import { getDownloadUrl } from '@/lib/api';

interface UseDownloadReturn {
  download: (downloadPath: string, fileName?: string) => void;
  getUrl: (downloadPath: string) => string;
}

export function useDownload(): UseDownloadReturn {
  const getUrl = useCallback((downloadPath: string) => {
    return getDownloadUrl(downloadPath);
  }, []);

  const download = useCallback((downloadPath: string, fileName?: string) => {
    const url = getDownloadUrl(downloadPath);
    const link = document.createElement('a');
    link.href = url;
    if (fileName) {
      link.download = fileName;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    download,
    getUrl,
  };
}
