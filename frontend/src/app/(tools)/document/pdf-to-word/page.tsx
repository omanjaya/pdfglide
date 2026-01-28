'use client';

import { useState } from 'react';
import { FileText, Settings2, Sparkles } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
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

const OCR_ENGINES = [
  { value: 'tesseract', label: 'Tesseract', description: 'Fast & stable, good for most documents' },
  { value: 'openrouter', label: 'AI Vision (Qwen-VL)', description: 'Best accuracy for scanned docs' },
  { value: 'surya', label: 'Surya (Experimental)', description: 'Better accuracy, may be unstable' },
];

const QUALITY_OPTIONS = [
  { value: 'draft', label: 'Draft', description: 'Fastest, lower accuracy' },
  { value: 'standard', label: 'Standard', description: 'Balanced speed and accuracy' },
  { value: 'high', label: 'High', description: 'Best accuracy, slower' },
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

const DOCUMENT_TYPES = [
  { value: 'general', label: 'General', description: 'Default, works for most documents' },
  { value: 'academic', label: 'Academic', description: 'Research papers, journals, theses' },
  { value: 'form', label: 'Form', description: 'Forms, applications, questionnaires' },
  { value: 'invoice', label: 'Invoice', description: 'Invoices, receipts, bills' },
  { value: 'legal', label: 'Legal', description: 'Contracts, agreements' },
  { value: 'report', label: 'Report', description: 'Business reports, analysis' },
  { value: 'letter', label: 'Letter', description: 'Letters, correspondence' },
];

export default function PdfToWordPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  // Options
  const [ocrEngine, setOcrEngine] = useState<'tesseract' | 'surya' | 'openrouter'>('tesseract');
  const [quality, setQuality] = useState<'draft' | 'standard' | 'high'>('standard');
  const [lang, setLang] = useState('eng');
  const [documentType, setDocumentType] = useState<'general' | 'academic' | 'form' | 'invoice' | 'legal' | 'report' | 'letter'>('general');

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const options: PdfToWordOptions = {
        ocrEngine,
        quality,
        lang,
        preserveLayout: true,
        documentType: ocrEngine === 'openrouter' ? documentType : undefined,
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
      description="Convert PDF documents to editable Word format with OCR"
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
                    {/* OCR Engine */}
                    <div className="space-y-2">
                      <Label>OCR Engine</Label>
                      <Select
                        value={ocrEngine}
                        onValueChange={(v) => setOcrEngine(v as typeof ocrEngine)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OCR_ENGINES.map((engine) => (
                            <SelectItem key={engine.value} value={engine.value}>
                              <div className="flex items-center gap-2">
                                {engine.value === 'openrouter' && (
                                  <Sparkles className="h-3 w-3 text-yellow-500" />
                                )}
                                <span>{engine.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {OCR_ENGINES.find((e) => e.value === ocrEngine)?.description}
                      </p>
                    </div>

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

                    {/* Document Type - only for OpenRouter */}
                    {ocrEngine === 'openrouter' && (
                      <div className="space-y-2">
                        <Label>Document Type</Label>
                        <Select
                          value={documentType}
                          onValueChange={(v) => setDocumentType(v as typeof documentType)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((dt) => (
                              <SelectItem key={dt.value} value={dt.value}>
                                {dt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {DOCUMENT_TYPES.find((d) => d.value === documentType)?.description}
                        </p>
                      </div>
                    )}

                    {ocrEngine === 'openrouter' && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          <Sparkles className="inline h-3 w-3 mr-1" />
                          AI Vision uses Qwen-VL for best accuracy on scanned documents.
                          Requires OpenRouter API key configured on server.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

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
