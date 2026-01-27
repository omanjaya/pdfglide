'use client';

import { useState } from 'react';
import { GitCompare, Upload } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { comparePdfs, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type OutputMode = 'visual' | 'text';

export default function ComparePdfPage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>('visual');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile1(file);
  };

  const handleFile2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFile2(file);
  };

  const handleProcess = async () => {
    if (!file1 || !file2) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await comparePdfs(file1, file2, outputMode);
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
    setFile1(null);
    setFile2(null);
    setOutputMode('visual');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Compare PDFs"
      description="Find differences between two PDF documents"
      icon={GitCompare}
      color="bg-indigo-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Original PDF</label>
              <label
                className={cn(
                  'flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-muted',
                  file1 ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                )}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFile1Change}
                  className="hidden"
                />
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                {file1 ? (
                  <span className="text-sm font-medium">{file1.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Click to upload first PDF
                  </span>
                )}
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Modified PDF</label>
              <label
                className={cn(
                  'flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-muted',
                  file2 ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                )}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFile2Change}
                  className="hidden"
                />
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                {file2 ? (
                  <span className="text-sm font-medium">{file2.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Click to upload second PDF
                  </span>
                )}
              </label>
            </div>
          </div>

          {file1 && file2 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Comparison Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOutputMode('visual')}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      outputMode === 'visual'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="font-medium">Visual</div>
                    <div className="text-xs text-muted-foreground">
                      Side-by-side with highlighted differences
                    </div>
                  </button>
                  <button
                    onClick={() => setOutputMode('text')}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      outputMode === 'text'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="font-medium">Text</div>
                    <div className="text-xs text-muted-foreground">
                      Text-based diff report
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <GitCompare className="mr-2 h-5 w-5" />
                  Compare PDFs
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
