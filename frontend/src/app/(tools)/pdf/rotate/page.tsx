'use client';

import { useState, useCallback } from 'react';
import {
  RotateCw,
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
  RotateCwSquare
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { rotatePdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const ROTATION_OPTIONS = [
  { value: 90, label: '90°', description: 'Rotate Right', icon: '↻' },
  { value: 180, label: '180°', description: 'Flip', icon: '↕' },
  { value: 270, label: '270°', description: 'Rotate Left', icon: '↺' },
];

const PAGE_OPTIONS = [
  { value: 'all', label: 'All Pages', description: 'Rotate every page' },
  { value: 'odd', label: 'Odd Pages', description: '1, 3, 5, 7...' },
  { value: 'even', label: 'Even Pages', description: '2, 4, 6, 8...' },
  { value: 'custom', label: 'Custom', description: 'Select specific pages' },
];

const PROCESSING_STEPS = [
  { id: 1, label: 'Reading PDF', icon: FileText },
  { id: 2, label: 'Rotating pages', icon: RotateCw },
  { id: 3, label: 'Rebuilding document', icon: FileText },
  { id: 4, label: 'Finalizing', icon: Check },
];

export default function RotatePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<number>(90);
  const [pageOption, setPageOption] = useState<string>('all');
  const [customPages, setCustomPages] = useState<string>('');
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
    }, 600);

    try {
      const pages = pageOption === 'custom' ? customPages : pageOption;
      const response = await rotatePdf(file, rotation, pages);

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
    setRotation(90);
    setPageOption('all');
    setCustomPages('');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg">
            <RotateCw className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Rotate PDF</h1>
          <p className="mt-2 text-gray-600">Rotate PDF pages to any angle</p>
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
                  ? 'border-purple-500 bg-purple-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-purple-200 scale-110' : 'bg-purple-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-purple-600' : 'text-purple-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {ROTATION_OPTIONS.map((opt) => (
                <div key={opt.value} className="rounded-xl bg-gray-50 p-4 text-center">
                  <span className="text-2xl">{opt.icon}</span>
                  <p className="mt-2 text-sm font-medium text-gray-700">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              ))}
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
                  <FileText className="h-5 w-5 text-purple-500" />
                  Selected File
                </h3>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-purple-50 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-purple-100">
                  <FileText className="h-8 w-8 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>

              {/* Rotation Preview Visual */}
              <div className="mt-6 flex items-center justify-center">
                <div className="relative">
                  <div className="h-24 w-20 rounded-lg border-2 border-gray-300 bg-white shadow-sm">
                    <div className="flex h-full items-center justify-center text-xs text-gray-400">PDF</div>
                  </div>
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                    <RotateCw className="h-6 w-6 text-purple-500" />
                  </div>
                  <div
                    className="absolute left-28 top-1/2 -translate-y-1/2 h-24 w-20 rounded-lg border-2 border-purple-400 bg-purple-50 shadow-sm transition-transform"
                    style={{ transform: `translateY(-50%) rotate(${rotation}deg)` }}
                  >
                    <div className="flex h-full items-center justify-center text-xs text-purple-600">PDF</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Options */}
            <Card className="p-6">
              <h3 className="mb-6 flex items-center gap-2 font-semibold text-gray-900">
                <RotateCwSquare className="h-5 w-5 text-purple-500" />
                Rotation Options
              </h3>

              <div className="space-y-6">
                {/* Rotation Angle */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">
                    Rotation Angle
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {ROTATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setRotation(opt.value)}
                        className={`rounded-xl border-2 p-4 text-center transition-all ${
                          rotation === opt.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <p className={`mt-1 text-lg font-bold ${
                          rotation === opt.value ? 'text-purple-700' : 'text-gray-900'
                        }`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Selection */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">
                    Pages to Rotate
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAGE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPageOption(opt.value)}
                        className={`rounded-lg border-2 p-3 text-left transition-all ${
                          pageOption === opt.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <p className={`font-medium ${
                          pageOption === opt.value ? 'text-purple-700' : 'text-gray-900'
                        }`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-500">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Pages Input */}
                {pageOption === 'custom' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Page Numbers
                    </label>
                    <input
                      type="text"
                      value={customPages}
                      onChange={(e) => setCustomPages(e.target.value)}
                      placeholder="e.g., 1, 3, 5-10"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter page numbers separated by commas, or ranges like 5-10
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={pageOption === 'custom' && !customPages.trim()}
                  className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
                >
                  <RotateCw className="mr-2 h-5 w-5" />
                  Rotate {rotation}°
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-violet-100">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Rotating PDF</h3>
              <p className="mb-8 text-gray-500">Applying {rotation}° rotation</p>

              <div className="space-y-3">
                {PROCESSING_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === processingStep;
                  const isCompleted = index < processingStep;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                        isActive ? 'bg-purple-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-purple-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
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
                        isActive ? 'text-purple-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">PDF Rotated!</h3>
              <p className="mb-6 text-gray-500">Pages rotated by {rotation}°</p>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100">
                    <FileText className="h-7 w-7 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={copyDownloadLink}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <a href={result.download_url} download className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700">
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
                Rotate another PDF
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Rotation Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-purple-500 to-violet-600">
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
