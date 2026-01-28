'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Presentation, Upload, FileText, X, Download, RefreshCw, AlertCircle, CheckCircle2, Copy, Loader2, Zap, Image, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { pdfToPowerPoint, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type Quality = 'low' | 'medium' | 'high';

const qualityOptions: { value: Quality; dpi: number; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'low', dpi: 72, label: 'Low', description: 'Smaller file, faster processing', icon: Zap },
  { value: 'medium', dpi: 150, label: 'Medium', description: 'Balanced quality and size', icon: Image },
  { value: 'high', dpi: 300, label: 'High', description: 'Best quality for printing', icon: Sparkles },
];

const processingSteps = [
  'Analyzing PDF structure...',
  'Extracting content...',
  'Rendering slides...',
  'Building presentation...',
  'Finalizing PPTX...',
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PdfToPowerPointPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState<Quality>('medium');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setProcessingStep((prev) => (prev + 1) % processingSteps.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status]);

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
    if (droppedFile) handleFileSelect(droppedFile);
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
    setProcessingStep(0);
    setError(null);

    const dpi = qualityOptions.find((o) => o.value === quality)?.dpi || 150;

    try {
      const response = await pdfToPowerPoint(file, dpi);
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
    setFile(null);
    setQuality('medium');
    setStatus('idle');
    setResult(null);
    setError(null);
    setProcessingStep(0);
  };

  const copyToClipboard = async () => {
    if (result?.download_url) {
      await navigator.clipboard.writeText(result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-amber-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
            <Presentation className="h-10 w-10" />
          </div>
          <h1 className="mb-3 text-4xl font-bold">PDF to PowerPoint</h1>
          <p className="text-lg text-orange-100">
            Convert PDF documents to editable PowerPoint presentations
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <Card className="border-2 border-dashed border-orange-200 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div
                className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  isDragging
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-orange-200 hover:border-orange-400 hover:bg-orange-50/50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <div className="mb-4 inline-flex rounded-full bg-orange-100 p-4">
                  <Upload className="h-8 w-8 text-orange-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-800">
                  Drop your PDF here
                </h3>
                <p className="mb-4 text-gray-500">or click to browse</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-orange-600 hover:to-red-600 hover:shadow-xl"
                >
                  Select PDF File
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State - File loaded, select quality */}
        {status === 'preview' && file && (
          <div className="space-y-6">
            {/* File Card */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-orange-100 p-3">
                      <FileText className="h-8 w-8 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Quality Selection */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Image Quality</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {qualityOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setQuality(option.value)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          quality === option.value
                            ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                            : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className={`rounded-lg p-2 ${quality === option.value ? 'bg-orange-200' : 'bg-gray-100'}`}>
                            <Icon className={`h-5 w-5 ${quality === option.value ? 'text-orange-700' : 'text-gray-500'}`} />
                          </div>
                          {quality === option.value && (
                            <CheckCircle2 className="h-5 w-5 text-orange-600" />
                          )}
                        </div>
                        <p className="font-semibold text-gray-900">{option.label}</p>
                        <p className="mt-1 text-sm text-gray-500">{option.description}</p>
                        <p className="mt-2 text-xs text-gray-400">{option.dpi} DPI</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Output Info */}
            <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-orange-100 p-3">
                    <Presentation className="h-8 w-8 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Output: PowerPoint (.pptx)</p>
                    <p className="text-sm text-gray-600">Each PDF page becomes a slide with the content as an image</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Process Button */}
            <button
              onClick={handleProcess}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-orange-600 hover:to-red-600 hover:shadow-xl"
            >
              <Presentation className="mr-2 inline-block h-5 w-5" />
              Convert to PowerPoint
            </button>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-orange-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-orange-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Converting to PowerPoint...</h3>
              <p className="mb-6 text-gray-500">{processingSteps[processingStep]}</p>
              <div className="mx-auto flex max-w-md justify-center gap-2">
                {processingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-full rounded-full transition-all ${
                      index <= processingStep ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed State */}
        {status === 'completed' && result && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-8">
              <div className="mb-6 text-center">
                <div className="mb-4 inline-flex rounded-full bg-green-100 p-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Conversion Complete!</h3>
                <p className="text-gray-500">Your PDF has been converted to PowerPoint</p>
              </div>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Presentation className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
                    <Presentation className="h-4 w-4" />
                    PPTX
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={result.download_url}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 py-3 font-medium text-white shadow-lg transition-all hover:from-orange-600 hover:to-red-600"
                >
                  <Download className="h-5 w-5" />
                  Download PowerPoint
                </a>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50"
                >
                  {copied ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <button
                onClick={handleReset}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-gray-600 transition-all hover:bg-gray-100"
              >
                <RefreshCw className="h-5 w-5" />
                Convert Another PDF
              </button>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === 'error' && (
          <Card className="border-red-200 bg-white shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="mb-4 inline-flex rounded-full bg-red-100 p-4">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Conversion Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={handleProcess}
                  className="flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700"
                >
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Start Over
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
