'use client';

import { useState } from 'react';
import { Unlock } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { unlockPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export default function UnlockPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await unlockPdf(files[0], password);
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
    setPassword('');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Unlock PDF"
      description="Remove password protection from PDF"
      icon={Unlock}
      color="bg-green-500"
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
                <label className="text-sm font-medium">PDF password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to unlock"
                  className="w-full rounded-md border px-3 py-2"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the password if the PDF is protected. Leave empty if not required.
                </p>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <Unlock className="mr-2 h-5 w-5" />
                  Unlock PDF
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
