'use client';

import { useState } from 'react';
import { Presentation } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { pdfToPowerPoint, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type Quality = 'low' | 'medium' | 'high';

const qualityOptions: { value: Quality; dpi: number; label: string; description: string }[] = [
  { value: 'low', dpi: 72, label: 'Low', description: 'Smaller file, faster' },
  { value: 'medium', dpi: 150, label: 'Medium', description: 'Balanced quality' },
  { value: 'high', dpi: 300, label: 'High', description: 'Best quality' },
];

export default function PdfToPowerPointPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<Quality>('medium');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    const dpi = qualityOptions.find((o) => o.value === quality)?.dpi || 150;

    try {
      const response = await pdfToPowerPoint(files[0], dpi);
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
    setQuality('medium');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="PDF to PowerPoint"
      description="Convert PDF documents to editable PowerPoint presentations"
      icon={Presentation}
      color="bg-orange-500"
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
                <label className="text-sm font-medium">Image Quality</label>
                <div className="grid grid-cols-3 gap-2">
                  {qualityOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setQuality(option.value)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        quality === option.value
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

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <Presentation className="mr-2 h-5 w-5" />
                  Convert to PowerPoint
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
