'use client';

import { useState } from 'react';
import { Eraser } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { api, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export default function RemoveBackgroundPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const response = await api.post('/image/remove-background', formData);

      if (response.data.success) {
        setResult(response.data.data);
        setStatus('completed');
      } else {
        setError(response.data.error || 'Processing failed');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Remove Background"
      description="Automatically remove image background using AI"
      icon={Eraser}
      color="bg-green-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{
              'image/jpeg': ['.jpg', '.jpeg'],
              'image/png': ['.png'],
              'image/webp': ['.webp'],
            }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />

          {files.length > 0 && (
            <div className="flex justify-center">
              <Button size="lg" onClick={handleProcess}>
                <Eraser className="mr-2 h-5 w-5" />
                Remove Background
              </Button>
            </div>
          )}

          <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Tips for best results:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Use images with clear subject-background separation</li>
              <li>Higher resolution images produce better results</li>
              <li>Output will be PNG with transparent background</li>
            </ul>
          </div>
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
