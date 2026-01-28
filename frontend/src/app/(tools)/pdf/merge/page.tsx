'use client';

import { useState, useCallback } from 'react';
import {
  Combine,
  Upload,
  X,
  Download,
  RotateCcw,
  FileText,
  GripVertical,
  Plus,
  Trash2,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Shuffle,
  Zap
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { mergePdfs, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

interface FileItem {
  id: string;
  file: File;
}

const PROCESSING_STEPS = [
  { id: 1, label: 'Reading PDF files', icon: FileText },
  { id: 2, label: 'Analyzing pages', icon: FileText },
  { id: 3, label: 'Merging documents', icon: Combine },
  { id: 4, label: 'Finalizing', icon: Check },
];

export default function MergePdfPage() {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
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

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type === 'application/pdf'
    );

    if (droppedFiles.length > 0) {
      const newItems = droppedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file
      }));
      setFileItems(prev => [...prev, ...newItems]);
      if (fileItems.length === 0 && droppedFiles.length > 0) {
        setStatus('preview');
      }
    }
  }, [fileItems.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const newItems = selectedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file
      }));
      setFileItems(prev => [...prev, ...newItems]);
      setStatus('preview');
    }
    e.target.value = '';
  }, []);

  const addMoreFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const newItems = selectedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file
      }));
      setFileItems(prev => [...prev, ...newItems]);
    }
    e.target.value = '';
  }, []);

  const removeFile = useCallback((id: string) => {
    setFileItems(prev => {
      const newItems = prev.filter(item => item.id !== id);
      if (newItems.length === 0) {
        setStatus('idle');
      }
      return newItems;
    });
  }, []);

  const moveFile = useCallback((index: number, direction: 'up' | 'down') => {
    setFileItems(prev => {
      const newItems = [...prev];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newItems.length) return prev;
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      return newItems;
    });
  }, []);

  const handleProcess = async () => {
    if (fileItems.length < 2) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev < PROCESSING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 800);

    try {
      const files = fileItems.map(item => item.file);
      const response = await mergePdfs(files);

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
    setFileItems([]);
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

  const totalSize = fileItems.reduce((acc, item) => acc + item.file.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg">
            <Combine className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Merge PDF</h1>
          <p className="mt-2 text-gray-600">Combine multiple PDF files into a single document</p>
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
                  ? 'border-red-500 bg-red-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-red-400 hover:bg-red-50/50'
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-red-200 scale-110' : 'bg-red-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-red-600' : 'text-red-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF files here' : 'Drag & drop PDF files'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
              <p className="mt-4 text-xs text-gray-400">Select multiple PDF files to merge (max 20 files)</p>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: FileText, label: 'Multiple PDFs', desc: 'Up to 20 files' },
                { icon: Shuffle, label: 'Reorder', desc: 'Drag to arrange' },
                { icon: Zap, label: 'Fast', desc: 'Instant merge' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                      <Icon className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - File List */}
        {status === 'preview' && (
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                <FileText className="h-5 w-5 text-red-500" />
                {fileItems.length} PDF Files
                <span className="text-sm font-normal text-gray-500">
                  ({formatFileSize(totalSize)} total)
                </span>
              </h3>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={addMoreFiles}
                  className="hidden"
                />
                <span className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-200">
                  <Plus className="h-4 w-4" />
                  Add More
                </span>
              </label>
            </div>

            {/* File List */}
            <div className="mb-6 space-y-2">
              {fileItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-red-200 hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{item.file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(item.file.size)}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="mr-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      #{index + 1}
                    </span>
                    <button
                      onClick={() => moveFile(index, 'up')}
                      disabled={index === 0}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveFile(index, 'down')}
                      disabled={index === fileItems.length - 1}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFile(item.id)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Info & Action */}
            {fileItems.length < 2 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-4 text-center text-amber-700">
                Please add at least 2 PDF files to merge
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear All
              </Button>
              <Button
                onClick={handleProcess}
                disabled={fileItems.length < 2}
                className="flex-1 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700"
              >
                <Combine className="mr-2 h-4 w-4" />
                Merge {fileItems.length} PDFs
              </Button>
            </div>
          </Card>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-100 to-orange-100">
                <Loader2 className="h-10 w-10 animate-spin text-red-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Merging PDFs</h3>
              <p className="mb-8 text-gray-500">Combining {fileItems.length} files into one document</p>

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
                        isActive ? 'bg-red-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-red-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
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
                        isActive ? 'text-red-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">PDFs Merged!</h3>
              <p className="mb-6 text-gray-500">
                {fileItems.length} files combined successfully
              </p>

              {/* Result Info */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-100">
                    <FileText className="h-7 w-7 text-red-600" />
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
                  <Button className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700">
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
                Merge more PDFs
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Merge Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-red-500 to-orange-600">
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
