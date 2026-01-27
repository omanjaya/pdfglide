'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { htmlToPdf, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type PageSize = 'A4' | 'Letter' | 'Legal';
type Orientation = 'portrait' | 'landscape';

const pageSizeOptions: { value: PageSize; label: string }[] = [
  { value: 'A4', label: 'A4' },
  { value: 'Letter', label: 'Letter' },
  { value: 'Legal', label: 'Legal' },
];

const orientationOptions: { value: Orientation; label: string }[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

export default function HtmlToPdfPage() {
  const [url, setUrl] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidUrl = (urlString: string) => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const handleProcess = async () => {
    if (!url || !isValidUrl(url)) {
      setError('Please enter a valid URL');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const response = await htmlToPdf(url, { pageSize, orientation });
      if (response.success) {
        setResult(response.data);
        setStatus('completed');
      } else {
        setError(response.error || 'Processing failed');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setUrl('');
    setPageSize('A4');
    setOrientation('portrait');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="HTML to PDF"
      description="Convert any webpage or URL to a PDF document"
      icon={Globe}
      color="bg-cyan-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Website URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {url && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Page Size</label>
                  <div className="flex gap-2">
                    {pageSizeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setPageSize(option.value)}
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                          pageSize === option.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Orientation</label>
                  <div className="flex gap-2">
                    {orientationOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setOrientation(option.value)}
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                          orientation === option.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <Globe className="mr-2 h-5 w-5" />
                  Convert to PDF
                </Button>
              </div>
            </>
          )}

          {error && status === 'idle' && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
        </div>
      )}

      <ProcessingStatus
        status={status}
        message={error || undefined}
        fileName={result?.file_name}
        fileSize={result?.file_size}
        downloadUrl={result?.download_url}
        onRetry={handleProcess}
        onReset={handleReset}
      />
    </ToolLayout>
  );
}
