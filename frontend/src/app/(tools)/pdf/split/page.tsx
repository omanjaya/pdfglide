'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Scissors,
  Upload,
  X,
  Download,
  RotateCcw,
  FileText,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileStack,
  Archive
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { splitPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type SplitMode = 'all' | 'range' | 'extract';

const PROCESSING_STEPS = [
  { id: 1, label: 'Reading PDF file', icon: FileText },
  { id: 2, label: 'Analyzing pages', icon: Layers },
  { id: 3, label: 'Splitting document', icon: Scissors },
  { id: 4, label: 'Creating output files', icon: FileStack },
];

const SPLIT_MODES = [
  {
    value: 'all' as SplitMode,
    label: 'Split All Pages',
    description: 'Create separate PDF for each page',
    icon: Layers,
  },
  {
    value: 'range' as SplitMode,
    label: 'Custom Range',
    description: 'Split by page ranges',
    icon: Scissors,
  },
  {
    value: 'extract' as SplitMode,
    label: 'Extract Pages',
    description: 'Extract specific pages only',
    icon: FileStack,
  },
];

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [pages, setPages] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setStatus('preview');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('preview');
    }
  }, []);

  const handleProcess = async () => {
    if (!file) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev < PROCESSING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 700);

    try {
      const pagesParam = splitMode === 'all' ? 'all' : pages;
      const response = await splitPdf(file, pagesParam);

      clearInterval(stepInterval);

      if (response.success) {
        setResult(response.data);
        setStatus('completed');
      } else {
        setError(response.error || 'Processing failed');
        setStatus('error');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setSplitMode('all');
    setPages('');
    setStatus('idle');
    setResult(null);
    setError(null);
    setProcessingStep(0);
  };

  const copyDownloadLink = async () => {
    if (result?.download_url) {
      await navigator.clipboard.writeText(result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const isValidInput = () => {
    if (splitMode === 'all') return true;
    return pages.trim().length > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Split PDF</h1>
          <p className="mt-2 text-gray-600">Separate PDF pages into multiple files</p>
        </div>

        {/* Idle - Upload */}
        {status === 'idle' && (
          <Card className="mx-auto max-w-2xl p-8">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-blue-200 scale-110' : 'bg-blue-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-blue-600' : 'text-blue-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
              <p className="mt-4 text-xs text-gray-400">Supports PDF files up to 100MB</p>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: Layers, label: 'Split All', desc: 'One page per file' },
                { icon: Scissors, label: 'Ranges', desc: 'Custom page ranges' },
                { icon: Archive, label: 'ZIP Output', desc: 'All files in one' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - Options */}
        {status === 'preview' && file && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* File Preview */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Selected File
                </h3>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-blue-50 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-blue-100">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>

              {/* Split Mode Visual */}
              <div className="mt-6">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <Scissors className="h-5 w-5 text-blue-500" />
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex h-10 w-8 items-center justify-center rounded bg-gray-100">
                        <FileText className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                    <span className="flex items-center text-gray-400">...</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Options */}
            <Card className="p-6">
              <h3 className="mb-6 flex items-center gap-2 font-semibold text-gray-900">
                <Scissors className="h-5 w-5 text-blue-500" />
                Split Options
              </h3>

              <div className="space-y-4">
                {/* Split Mode Selection */}
                <div className="space-y-2">
                  {SPLIT_MODES.map((mode) => {
                    const ModeIcon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setSplitMode(mode.value)}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                          splitMode === mode.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                          splitMode === mode.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <ModeIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${splitMode === mode.value ? 'text-blue-700' : 'text-gray-900'}`}>
                            {mode.label}
                          </p>
                          <p className="text-sm text-gray-500">{mode.description}</p>
                        </div>
                        {splitMode === mode.value && (
                          <Check className="h-5 w-5 text-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Page Range Input */}
                {(splitMode === 'range' || splitMode === 'extract') && (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {splitMode === 'range' ? 'Page Ranges' : 'Pages to Extract'}
                    </label>
                    <input
                      type="text"
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                      placeholder={splitMode === 'range' ? 'e.g., 1-3, 5, 7-10' : 'e.g., 1, 3, 5-7'}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {splitMode === 'range'
                        ? 'Each range creates a separate PDF. Use commas to separate ranges.'
                        : 'Specify individual pages or ranges to extract into a single PDF.'}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!isValidInput()}
                  className="mt-4 w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  <Scissors className="mr-2 h-5 w-5" />
                  {splitMode === 'all' ? 'Split All Pages' : 'Split PDF'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Splitting PDF</h3>
              <p className="mb-8 text-gray-500">Processing your document</p>

              {/* Processing Steps */}
              <div className="space-y-3">
                {PROCESSING_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === processingStep;
                  const isCompleted = index < processingStep;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                        isActive ? 'bg-blue-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-blue-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StepIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span className={`text-sm font-medium ${
                        isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Completed */}
        {status === 'completed' && result && (
          <Card className="mx-auto max-w-2xl p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">PDF Split Complete!</h3>
              <p className="mb-6 text-gray-500">Your files are ready for download</p>

              {/* Result Info */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100">
                    <FileStack className="h-7 w-7 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={copyDownloadLink}
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </>
                  )}
                </Button>
                <a href={result.download_url} download className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </a>
              </div>

              <button
                onClick={handleReset}
                className="mt-4 flex w-full items-center justify-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                Split another PDF
              </button>
            </div>
          </Card>
        )}

        {/* Error */}
        {status === 'error' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Split Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600">
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
