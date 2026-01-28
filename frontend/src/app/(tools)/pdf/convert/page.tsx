'use client';

import { useState, useCallback, useRef } from 'react';
import {
  FileImage,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Image,
  Sparkles,
  Camera,
  LucideIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { api, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PROCESSING_STEPS = [
  'Reading PDF document...',
  'Rendering pages...',
  'Converting to images...',
  'Optimizing quality...',
  'Packaging files...',
];

const FORMAT_OPTIONS: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'jpg', label: 'JPG', description: 'Best compatibility', icon: Camera },
  { value: 'png', label: 'PNG', description: 'Lossless quality', icon: Image },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function PdfToImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('jpg');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!file) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) =>
        prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 800);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);

      const response = await api.post('/pdf/to-image', formData);
      clearInterval(stepInterval);

      if (response.data.success) {
        setResult(response.data.data);
        setStatus('completed');
      } else {
        setError(response.data.error || 'Processing failed');
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
    setFormat('jpg');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <FileImage className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">PDF to Image</h1>
          <p className="text-center text-red-100 max-w-2xl mx-auto">
            Convert PDF pages to high-quality JPG or PNG images
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
                    ? 'border-red-500 bg-red-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-red-400 hover:bg-red-50/50'
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
                  isDragging ? 'bg-red-500 scale-110' : 'bg-gradient-to-br from-red-500 to-orange-500'
                }`}>
                  <FileImage className="h-10 w-10 text-white" />
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
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50">
                  <Image className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">High Quality</p>
                    <p className="text-xs text-gray-500">300 DPI output</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50">
                  <Sparkles className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">All Pages</p>
                    <p className="text-xs text-gray-500">Convert every page</p>
                  </div>
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
                          <FileText className="h-12 w-12 text-red-500" />
                        </div>
                        <p className="font-medium text-gray-800 text-center truncate max-w-full">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Format Selection */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Output Format</h3>
                    <div className="space-y-3">
                      {FORMAT_OPTIONS.map((option) => {
                        const OptionIcon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => setFormat(option.value)}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                              format === option.value
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-200 hover:border-red-300'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                                format === option.value ? 'bg-red-100' : 'bg-gray-100'
                              }`}>
                                <OptionIcon className={`h-6 w-6 ${
                                  format === option.value ? 'text-red-600' : 'text-gray-500'
                                }`} />
                              </div>
                              <div className="flex-1">
                                <p className={`font-semibold ${
                                  format === option.value ? 'text-red-700' : 'text-gray-800'
                                }`}>
                                  {option.label}
                                </p>
                                <p className="text-sm text-gray-500">{option.description}</p>
                              </div>
                              {format === option.value && (
                                <CheckCircle2 className="h-5 w-5 text-red-500" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Info Box */}
                    <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
                      <p className="text-sm text-blue-700">
                        <strong>Note:</strong> Each page will be converted to a separate image.
                        Multiple images will be packaged as a ZIP file.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleProcess}
                    className="px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                  >
                    <FileImage className="h-5 w-5" />
                    Convert to {format.toUpperCase()}
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
                <div className="absolute inset-0 rounded-full border-4 border-red-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-red-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <FileImage className="h-10 w-10 text-red-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Converting to {format.toUpperCase()}...</h3>

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
                      <CheckCircle2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-red-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">Images Ready!</h3>
              <p className="text-red-100 mt-1">PDF converted to {format.toUpperCase()}</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <Image className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <FileImage className="h-6 w-6 text-red-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-red-500" />
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
                Convert Another PDF
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
              <h3 className="text-2xl font-bold">Conversion Failed</h3>
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
