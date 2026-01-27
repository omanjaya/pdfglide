'use client';

import { useState } from 'react';
import { PenTool, Upload } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { signPdf, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export default function SignPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [x, setX] = useState(100);
  const [y, setY] = useState(100);
  const [width, setWidth] = useState<number | undefined>(150);
  const [height, setHeight] = useState<number | undefined>(50);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSignatureFile(file);
  };

  const handleProcess = async () => {
    if (files.length === 0 || !signatureFile) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await signPdf(files[0], signatureFile, page, x, y, width, height);
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
    setSignatureFile(null);
    setPage(1);
    setX(100);
    setY(100);
    setWidth(150);
    setHeight(50);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Sign PDF"
      description="Add your signature image to PDF documents"
      icon={PenTool}
      color="bg-violet-500"
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
                <label className="text-sm font-medium">Signature Image</label>
                <label
                  className={cn(
                    'flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors hover:bg-muted',
                    signatureFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  )}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureChange}
                    className="hidden"
                  />
                  <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
                  {signatureFile ? (
                    <span className="text-sm font-medium">{signatureFile.name}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Upload signature image (PNG, JPG)
                    </span>
                  )}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Page</label>
                  <input
                    type="number"
                    min={1}
                    value={page}
                    onChange={(e) => setPage(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">X Position</label>
                  <input
                    type="number"
                    min={0}
                    value={x}
                    onChange={(e) => setX(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Y Position</label>
                  <input
                    type="number"
                    min={0}
                    value={y}
                    onChange={(e) => setY(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Width</label>
                  <input
                    type="number"
                    min={1}
                    value={width || ''}
                    onChange={(e) => setWidth(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Height</label>
                  <input
                    type="number"
                    min={1}
                    value={height || ''}
                    onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Auto"
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess} disabled={!signatureFile}>
                  <PenTool className="mr-2 h-5 w-5" />
                  Sign PDF
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
