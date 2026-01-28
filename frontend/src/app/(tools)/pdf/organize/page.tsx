'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Layers,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  Scissors,
  ArrowUpDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { organizePdf, deletePdfPages, extractPdfPages, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type Mode = 'reorder' | 'delete' | 'extract';

const PROCESSING_STEPS = [
  'Reading PDF document...',
  'Analyzing pages...',
  'Processing pages...',
  'Rebuilding structure...',
  'Generating new PDF...',
];

const MODE_OPTIONS = [
  {
    value: 'reorder' as Mode,
    label: 'Reorder',
    icon: ArrowUpDown,
    description: 'Rearrange page order',
    color: 'orange',
    placeholder: '3,1,2,4 (for a 4-page PDF)',
    help: 'Enter the new page order. You can repeat pages to duplicate them.',
  },
  {
    value: 'delete' as Mode,
    label: 'Delete',
    icon: Trash2,
    description: 'Remove specific pages',
    color: 'red',
    placeholder: '2,4,6',
    help: 'Enter the page numbers to remove from the PDF.',
  },
  {
    value: 'extract' as Mode,
    label: 'Extract',
    icon: Scissors,
    description: 'Extract specific pages',
    color: 'blue',
    placeholder: '1,3,5',
    help: 'Enter the page numbers to extract into a new PDF.',
  },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function OrganizePdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>('reorder');
  const [pageOrder, setPageOrder] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMode = MODE_OPTIONS.find((m) => m.value === mode)!;

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setStatus('preview');
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleProcess = async () => {
    if (!file || !pageOrder.trim()) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) =>
        prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 800);

    try {
      const pages = pageOrder.split(',').map((p) => parseInt(p.trim()));

      let response: TaskResponse;
      if (mode === 'reorder') {
        response = await organizePdf(file, pages);
      } else if (mode === 'delete') {
        response = await deletePdfPages(file, pages);
      } else {
        response = await extractPdfPages(file, pages);
      }

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
    setMode('reorder');
    setPageOrder('');
    setStatus('idle');
    setResult(null);
    setError(null);
    setProcessingStep(0);
    setCopied(false);
  };

  const handleCopyLink = async () => {
    if (result?.download_url) {
      await navigator.clipboard.writeText(window.location.origin + result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getButtonLabel = () => {
    switch (mode) {
      case 'reorder': return 'Reorder Pages';
      case 'delete': return 'Delete Pages';
      case 'extract': return 'Extract Pages';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Layers className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">Organize PDF</h1>
          <p className="text-center text-orange-100 max-w-2xl mx-auto">
            Reorder, delete, or extract pages from your PDF document
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 -mt-6">
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <Card className="max-w-2xl mx-auto shadow-xl border-0">
            <CardContent className="p-8">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragging
                    ? 'border-orange-500 bg-orange-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-orange-400 hover:bg-orange-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
                  isDragging ? 'bg-orange-500 scale-110' : 'bg-gradient-to-br from-orange-500 to-amber-500'
                }`}>
                  <Layers className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragging ? 'Drop your PDF here' : 'Upload PDF'}
                </h3>
                <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Upload className="h-4 w-4" />
                  <span>PDF files only • Max 100MB</span>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-3 gap-3 mt-8">
                <div className="flex flex-col items-center p-4 rounded-xl bg-orange-50 text-center">
                  <ArrowUpDown className="h-6 w-6 text-orange-600 mb-2" />
                  <p className="font-medium text-gray-800 text-sm">Reorder</p>
                  <p className="text-xs text-gray-500">Rearrange pages</p>
                </div>
                <div className="flex flex-col items-center p-4 rounded-xl bg-red-50 text-center">
                  <Trash2 className="h-6 w-6 text-red-600 mb-2" />
                  <p className="font-medium text-gray-800 text-sm">Delete</p>
                  <p className="text-xs text-gray-500">Remove pages</p>
                </div>
                <div className="flex flex-col items-center p-4 rounded-xl bg-blue-50 text-center">
                  <Scissors className="h-6 w-6 text-blue-600 mb-2" />
                  <p className="font-medium text-gray-800 text-sm">Extract</p>
                  <p className="text-xs text-gray-500">Get specific pages</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State */}
        {status === 'preview' && file && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-xl border-0">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* File Preview */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">PDF File</h3>
                    <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl p-6 relative">
                      <button
                        onClick={handleReset}
                        className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                      <div className="flex flex-col items-center">
                        <div className="w-24 h-32 bg-white rounded-lg shadow-md flex items-center justify-center mb-4">
                          <FileText className="h-12 w-12 text-orange-500" />
                        </div>
                        <p className="font-medium text-gray-800 text-center truncate max-w-full">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Mode Selection & Input */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Operation</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {MODE_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          return (
                            <button
                              key={option.value}
                              onClick={() => setMode(option.value)}
                              className={`p-3 rounded-xl border-2 text-center transition-all ${
                                mode === option.value
                                  ? `border-${option.color}-500 bg-${option.color}-50`
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className={`h-5 w-5 mx-auto mb-1 ${
                                mode === option.value
                                  ? `text-${option.color}-600`
                                  : 'text-gray-400'
                              }`} />
                              <p className={`text-sm font-medium ${
                                mode === option.value
                                  ? `text-${option.color}-700`
                                  : 'text-gray-600'
                              }`}>
                                {option.label}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Page Numbers Input */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">
                        Page Numbers
                      </label>
                      <input
                        type="text"
                        value={pageOrder}
                        onChange={(e) => setPageOrder(e.target.value)}
                        placeholder={currentMode.placeholder}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-2">{currentMode.help}</p>
                    </div>

                    {/* Example Box */}
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-sm text-gray-600">
                        <strong>Example:</strong>{' '}
                        {mode === 'reorder' && 'Enter "3,1,2,4" to move page 3 to the first position'}
                        {mode === 'delete' && 'Enter "2,4" to remove pages 2 and 4 from the PDF'}
                        {mode === 'extract' && 'Enter "1,3,5" to create a new PDF with only those pages'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleProcess}
                    disabled={!pageOrder.trim()}
                    className={`px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3 ${
                      !pageOrder.trim() ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <currentMode.icon className="h-5 w-5" />
                    {getButtonLabel()}
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="max-w-xl mx-auto shadow-xl border-0">
            <CardContent className="p-12 text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-orange-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-orange-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <currentMode.icon className="h-10 w-10 text-orange-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">
                {mode === 'reorder' && 'Reordering Pages...'}
                {mode === 'delete' && 'Deleting Pages...'}
                {mode === 'extract' && 'Extracting Pages...'}
              </h3>

              {/* Processing Steps */}
              <div className="space-y-3 text-left max-w-xs mx-auto">
                {PROCESSING_STEPS.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 transition-all duration-300 ${
                      index <= processingStep ? 'opacity-100' : 'opacity-30'
                    }`}
                  >
                    {index < processingStep ? (
                      <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin flex-shrink-0" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${
                      index <= processingStep ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed State */}
        {status === 'completed' && result && (
          <Card className="max-w-xl mx-auto shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">
                {mode === 'reorder' && 'Pages Reordered!'}
                {mode === 'delete' && 'Pages Deleted!'}
                {mode === 'extract' && 'Pages Extracted!'}
              </h3>
              <p className="text-orange-100 mt-1">Your PDF is ready to download</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <Layers className="h-6 w-6 text-orange-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-orange-500" />
                  ) : (
                    <Copy className="h-5 w-5 text-gray-500" />
                  )}
                </button>
              </div>

              <button
                onClick={handleReset}
                className="w-full mt-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Organize Another PDF
              </button>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === 'error' && (
          <Card className="max-w-xl mx-auto shadow-xl border-0 overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-rose-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">Processing Failed</h3>
              <p className="text-red-100 mt-1">{error}</p>
            </div>
            <CardContent className="p-6">
              <div className="flex gap-3">
                <button
                  onClick={() => setStatus('preview')}
                  className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
