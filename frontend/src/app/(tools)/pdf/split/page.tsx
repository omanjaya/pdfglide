'use client';

import { useState, useCallback, useMemo } from 'react';
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
  Archive,
  Eye,
  Keyboard,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { splitPdf, TaskResponse } from '@/lib/api';
import { PdfPageSelector } from '@/components/pdf/PdfPageSelector';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type SplitMode = 'all' | 'range' | 'extract';
type InputMode = 'visual' | 'manual';

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
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [inputMode, setInputMode] = useState<InputMode>('visual');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);

  // Convert selected pages Set to sorted page string
  const selectedPagesString = useMemo(() => {
    if (selectedPages.size === 0) return '';

    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);

    return ranges.join(', ');
  }, [selectedPages]);

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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        setFile(selectedFile);
        setStatus('preview');
      }
    },
    []
  );

  const handleProcess = async () => {
    if (!file) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) => {
        if (prev < PROCESSING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 700);

    try {
      let pagesParam: string;

      if (splitMode === 'all') {
        pagesParam = 'all';
      } else if (inputMode === 'visual') {
        pagesParam = selectedPagesString;
      } else {
        pagesParam = pages;
      }

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
      setError(
        err.response?.data?.detail || err.message || 'An error occurred'
      );
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setSplitMode('all');
    setPages('');
    setSelectedPages(new Set());
    setInputMode('visual');
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
    if (inputMode === 'visual') return selectedPages.size > 0;
    return pages.trim().length > 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-8">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Split PDF</h1>
          <p className="mt-2 text-gray-600">
            Separate PDF pages into multiple files
          </p>
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
              <div
                className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                  isDragging ? 'bg-blue-200 scale-110' : 'bg-blue-100'
                }`}
              >
                <Upload
                  className={`h-10 w-10 transition-colors ${
                    isDragging ? 'text-blue-600' : 'text-blue-500'
                  }`}
                />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
              <p className="mt-4 text-xs text-gray-400">
                Supports PDF files up to 100MB
              </p>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                {
                  icon: Eye,
                  label: 'Visual Picker',
                  desc: 'Click pages to select',
                },
                {
                  icon: Scissors,
                  label: 'Ranges',
                  desc: 'Custom page ranges',
                },
                {
                  icon: Archive,
                  label: 'ZIP Output',
                  desc: 'All files in one',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-50 p-4 text-center"
                  >
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-700">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - Options */}
        {status === 'preview' && file && (
          <div className="space-y-6">
            {/* Top Bar: File info + Split mode */}
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* File Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    Change File
                  </button>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              {/* Left: Page Selector or Text Input */}
              <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                    <Layers className="h-5 w-5 text-blue-500" />
                    {splitMode === 'all'
                      ? 'All Pages Preview'
                      : 'Select Pages'}
                  </h3>

                  {/* Input Mode Toggle (only for range/extract) */}
                  {splitMode !== 'all' && (
                    <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                      <button
                        onClick={() => setInputMode('visual')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          inputMode === 'visual'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Visual
                      </button>
                      <button
                        onClick={() => setInputMode('manual')}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                          inputMode === 'manual'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Keyboard className="h-3.5 w-3.5" />
                        Manual
                      </button>
                    </div>
                  )}
                </div>

                {/* Visual Page Selector */}
                {(splitMode === 'all' || inputMode === 'visual') && (
                  <PdfPageSelector
                    file={file}
                    selectedPages={selectedPages}
                    onSelectionChange={setSelectedPages}
                  />
                )}

                {/* Manual Text Input */}
                {splitMode !== 'all' && inputMode === 'manual' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {splitMode === 'range'
                        ? 'Page Ranges'
                        : 'Pages to Extract'}
                    </label>
                    <input
                      type="text"
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                      placeholder={
                        splitMode === 'range'
                          ? 'e.g., 1-3, 5, 7-10'
                          : 'e.g., 1, 3, 5-7'
                      }
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      {splitMode === 'range'
                        ? 'Each range creates a separate PDF. Use commas to separate ranges.'
                        : 'Specify individual pages or ranges to extract into a single PDF.'}
                    </p>
                  </div>
                )}

                {/* Selected Pages Summary (visual mode, non-all) */}
                {splitMode !== 'all' &&
                  inputMode === 'visual' &&
                  selectedPages.size > 0 && (
                    <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-800 dark:text-blue-300">
                          Selected pages:
                        </span>
                        <code className="rounded bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs font-mono text-blue-700 dark:text-blue-300">
                          {selectedPagesString}
                        </code>
                      </div>
                    </div>
                  )}
              </Card>

              {/* Right: Split Options */}
              <Card className="p-6 h-fit lg:sticky lg:top-24">
                <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                  <Scissors className="h-5 w-5 text-blue-500" />
                  Split Mode
                </h3>

                <div className="space-y-2">
                  {/* Split Mode Selection */}
                  {SPLIT_MODES.map((mode) => {
                    const ModeIcon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => {
                          setSplitMode(mode.value);
                          if (mode.value === 'all') {
                            setSelectedPages(new Set());
                          }
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                          splitMode === mode.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                            splitMode === mode.value
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          <ModeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium ${
                              splitMode === mode.value
                                ? 'text-blue-700'
                                : 'text-gray-900'
                            }`}
                          >
                            {mode.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {mode.description}
                          </p>
                        </div>
                        {splitMode === mode.value && (
                          <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Info */}
                {splitMode !== 'all' && inputMode === 'visual' && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {splitMode === 'range'
                        ? 'Selected pages will be grouped into ranges. Each consecutive range creates a separate PDF file.'
                        : 'Selected pages will be extracted into a single new PDF file.'}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!isValidInput()}
                  className="mt-6 w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  <Scissors className="mr-2 h-5 w-5" />
                  {splitMode === 'all'
                    ? 'Split All Pages'
                    : `Split ${
                        inputMode === 'visual'
                          ? selectedPages.size
                          : ''
                      } Pages`}
                </Button>
              </Card>
            </div>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Splitting PDF
              </h3>
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
                        isActive
                          ? 'bg-blue-50'
                          : isCompleted
                          ? 'bg-green-50'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          isActive
                            ? 'bg-blue-500 text-white'
                            : isCompleted
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StepIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          isActive
                            ? 'text-blue-700'
                            : isCompleted
                            ? 'text-green-700'
                            : 'text-gray-400'
                        }`}
                      >
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                PDF Split Complete!
              </h3>
              <p className="mb-6 text-gray-500">
                Your files are ready for download
              </p>

              {/* Result Info */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100">
                    <FileStack className="h-7 w-7 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">
                      {result.file_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(result.file_size || 0)}
                    </p>
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Split Failed
              </h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button
                  onClick={handleProcess}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600"
                >
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
