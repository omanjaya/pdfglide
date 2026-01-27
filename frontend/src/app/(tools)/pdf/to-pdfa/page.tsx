'use client';

import { useState } from 'react';
import { Archive } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { pdfToPdfA, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type PdfaLevel = '1b' | '2b' | '3b';

const levelOptions: { value: PdfaLevel; label: string; description: string }[] = [
  { value: '1b', label: 'PDF/A-1b', description: 'Maximum compatibility, PDF 1.4 based' },
  { value: '2b', label: 'PDF/A-2b', description: 'Supports JPEG2000, transparency' },
  { value: '3b', label: 'PDF/A-3b', description: 'Allows embedded files' },
];

export default function PdfToPdfAPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [level, setLevel] = useState<PdfaLevel>('2b');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await pdfToPdfA(files[0], level);
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
    setLevel('2b');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="PDF to PDF/A"
      description="Convert PDF to archival format for long-term preservation"
      icon={Archive}
      color="bg-teal-500"
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
                <label className="text-sm font-medium">PDF/A Conformance Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {levelOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLevel(option.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        level === option.value
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

              <div className="rounded-lg bg-muted/50 p-4">
                <h4 className="mb-2 text-sm font-medium">About PDF/A</h4>
                <p className="text-xs text-muted-foreground">
                  PDF/A is an ISO-standardized version of PDF designed for long-term
                  digital preservation. It ensures that documents will display the same
                  way in the future, regardless of software or operating system changes.
                </p>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <Archive className="mr-2 h-5 w-5" />
                  Convert to PDF/A
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
