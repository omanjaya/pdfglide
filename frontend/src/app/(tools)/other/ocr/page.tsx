'use client';

import { useState } from 'react';
import { ScanText, Copy, Check } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const languages = [
  { value: 'eng', label: 'English' },
  { value: 'ind', label: 'Indonesian' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
  { value: 'ara', label: 'Arabic' },
];

export default function OCRPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('eng');
  const [status, setStatus] = useState<Status>('idle');
  const [extractedText, setExtractedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);
    setExtractedText('');

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('language', language);

      const response = await api.post('/ocr/extract', formData);

      if (response.data.success) {
        setExtractedText(response.data.data.text);
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
    setLanguage('eng');
    setStatus('idle');
    setExtractedText('');
    setError(null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolLayout
      title="OCR - Extract Text"
      description="Extract text from images and scanned PDFs"
      icon={ScanText}
      color="bg-purple-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{
              'application/pdf': ['.pdf'],
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
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Document language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {languages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <ScanText className="mr-2 h-5 w-5" />
                  Extract Text
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {status === 'processing' && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="font-medium">Extracting text...</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This may take a moment depending on the file size
          </p>
        </div>
      )}

      {status === 'completed' && extractedText && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Extracted Text</h3>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <div className="max-h-96 overflow-auto rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm">{extractedText}</pre>
          </div>
          <Button variant="outline" onClick={handleReset}>
            Process another file
          </Button>
        </div>
      )}

      {status === 'error' && (
        <ProcessingStatus
          status="error"
          message={error || undefined}
          onRetry={handleProcess}
          onReset={handleReset}
        />
      )}
    </ToolLayout>
  );
}
