'use client';

import { useState } from 'react';
import { FileOutput, Shield, Clock } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { wordToPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export default function WordToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await wordToPdf(files[0]);
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
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Word to PDF"
      description="Convert Word documents to PDF format"
      icon={FileOutput}
      color="bg-blue-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
              'application/msword': ['.doc'],
            }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />

          {files.length > 0 && (
            <>
              {/* Security info */}
              <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Your data is secure
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        <Clock className="inline h-3 w-3 mr-1" />
                        Files automatically deleted after download or within 5 minutes
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <FileOutput className="mr-2 h-5 w-5" />
                  Convert to PDF
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
