'use client';

import { useState } from 'react';
import { FileText, Settings2, Shield, Clock } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { pdfToWord, PdfToWordOptions, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const QUALITY_OPTIONS = [
  { value: 'draft', label: 'Draft', description: 'Fastest processing' },
  { value: 'standard', label: 'Standard', description: 'Balanced speed & quality' },
  { value: 'high', label: 'High', description: 'Best accuracy' },
];

const LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'ind', label: 'Indonesian' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'kor', label: 'Korean' },
  { value: 'ara', label: 'Arabic' },
  { value: 'deu', label: 'German' },
  { value: 'fra', label: 'French' },
  { value: 'spa', label: 'Spanish' },
];

export default function PdfToWordPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  // Options
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard');
  const [lang, setLang] = useState('eng');

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const options: PdfToWordOptions = {
        quality,
        lang,
      };
      const response = await pdfToWord(files[0], options);
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
      title="PDF to Word"
      description="Convert PDF documents to editable Word format"
      icon={FileText}
      color="bg-blue-500"
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
              {/* Options toggle */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOptions(!showOptions)}
                  className="text-muted-foreground"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  {showOptions ? 'Hide Options' : 'Show Options'}
                </Button>
              </div>

              {/* Options panel */}
              {showOptions && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {/* Quality */}
                    <div className="space-y-2">
                      <Label>Quality</Label>
                      <Select
                        value={quality}
                        onValueChange={(v) => setQuality(v as typeof quality)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUALITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {QUALITY_OPTIONS.find((o) => o.value === quality)?.description}
                      </p>
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                      <Label>Document Language</Label>
                      <Select value={lang} onValueChange={setLang}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>
                              {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                  <FileText className="mr-2 h-5 w-5" />
                  Convert to Word
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
