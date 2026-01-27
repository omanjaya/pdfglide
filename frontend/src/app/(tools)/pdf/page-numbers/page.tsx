'use client';

import { useState } from 'react';
import { Hash } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { addPageNumbers, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const positionOptions = [
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
];

const formatOptions = [
  { value: '{n}', label: 'Simple (1, 2, 3...)' },
  { value: 'Page {n}', label: 'Page 1, Page 2...' },
  { value: '{n} of {total}', label: '1 of 10, 2 of 10...' },
  { value: 'Page {n} of {total}', label: 'Page 1 of 10...' },
];

export default function PageNumbersPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [position, setPosition] = useState<string>('bottom-center');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [formatTemplate, setFormatTemplate] = useState<string>('{n}');
  const [fontSize, setFontSize] = useState<number>(12);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await addPageNumbers(files[0], {
        position,
        startNumber,
        formatTemplate,
        fontSize,
      });
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
    setFiles([]);
    setPosition('bottom-center');
    setStartNumber(1);
    setFormatTemplate('{n}');
    setFontSize(12);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Add Page Numbers"
      description="Add page numbers to your PDF document"
      icon={Hash}
      color="bg-indigo-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />

          {files.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Position</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    {positionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <select
                    value={formatTemplate}
                    onChange={(e) => setFormatTemplate(e.target.value)}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    {formatOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Start number</label>
                  <input
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(parseInt(e.target.value))}
                    min="1"
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Font size</label>
                  <input
                    type="number"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    min="8"
                    max="48"
                    className="w-full rounded-md border px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <Hash className="mr-2 h-5 w-5" />
                  Add Page Numbers
                </Button>
              </div>
            </>
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
