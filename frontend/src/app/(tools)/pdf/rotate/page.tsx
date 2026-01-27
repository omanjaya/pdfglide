'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { rotatePdf, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const rotationOptions = [
  { value: 90, label: '90°', description: 'Rotate right' },
  { value: 180, label: '180°', description: 'Upside down' },
  { value: 270, label: '270°', description: 'Rotate left' },
];

export default function RotatePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [rotation, setRotation] = useState<number>(90);
  const [pages, setPages] = useState<string>('all');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await rotatePdf(files[0], rotation, pages);
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
    setRotation(90);
    setPages('all');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Rotate PDF"
      description="Rotate PDF pages by 90, 180, or 270 degrees"
      icon={RotateCw}
      color="bg-purple-500"
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Rotation angle</label>
                <div className="grid grid-cols-3 gap-2">
                  {rotationOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setRotation(option.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        rotation === option.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Pages to rotate</label>
                <input
                  type="text"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="all or 1,3,5"
                  className="w-full rounded-md border px-3 py-2"
                />
                <p className="text-xs text-muted-foreground">
                  Enter "all" or specific page numbers (e.g., 1,3,5)
                </p>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <RotateCw className="mr-2 h-5 w-5" />
                  Rotate PDF
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
