'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Archive, Upload, FileText, X, Download, RefreshCw, AlertCircle, CheckCircle2, Copy, Loader2, Shield, Clock, FileCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { pdfToPdfA, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type PdfaLevel = '1b' | '2b' | '3b';

const levelOptions: { value: PdfaLevel; label: string; description: string; features: string[] }[] = [
  {
    value: '1b',
    label: 'PDF/A-1b',
    description: 'Maximum compatibility',
    features: ['PDF 1.4 based', 'Widest support', 'Basic archival']
  },
  {
    value: '2b',
    label: 'PDF/A-2b',
    description: 'Modern standard',
    features: ['JPEG2000 support', 'Transparency', 'Better compression']
  },
  {
    value: '3b',
    label: 'PDF/A-3b',
    description: 'Most features',
    features: ['Embedded files', 'XML, CSV, CAD', 'Full flexibility']
  },
];

const processingSteps = [
  'Analyzing document...',
  'Validating structure...',
  'Converting fonts...',
  'Embedding resources...',
  'Generating PDF/A...',
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function PdfToPdfAPage() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<PdfaLevel>('2b');
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

    try {
      const response = await pdfToPdfA(file, level);
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
    setLevel('2b');
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-sky-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
            <Archive className="h-10 w-10" />
          </div>
          <h1 className="mb-3 text-4xl font-bold">PDF to PDF/A</h1>
          <p className="text-lg text-teal-100">
            Convert PDF to archival format for long-term preservation
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <Card className="border-2 border-dashed border-teal-200 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div
                className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-teal-200 hover:border-teal-400 hover:bg-teal-50/50'
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
                <div className="mb-4 inline-flex rounded-full bg-teal-100 p-4">
                  <Upload className="h-8 w-8 text-teal-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-800">
                  Drop your PDF here
                </h3>
                <p className="mb-4 text-gray-500">or click to browse</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow-xl"
                >
                  Select PDF File
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State - File loaded, select level */}
        {status === 'preview' && file && (
          <div className="space-y-6">
            {/* File Card */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-teal-100 p-3">
                      <FileText className="h-8 w-8 text-teal-600" />
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

            {/* PDF/A Level Selection */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">PDF/A Conformance Level</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {levelOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setLevel(option.value)}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        level === option.value
                          ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                          : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{option.label}</span>
                        {level === option.value && (
                          <CheckCircle2 className="h-5 w-5 text-teal-600" />
                        )}
                      </div>
                      <p className="mb-3 text-sm text-gray-500">{option.description}</p>
                      <ul className="space-y-1">
                        {option.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                            <div className="h-1 w-1 rounded-full bg-teal-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* About PDF/A */}
            <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Why PDF/A?</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-teal-100 p-2">
                      <Shield className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">ISO Standard</p>
                      <p className="text-sm text-gray-600">Internationally recognized format</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-teal-100 p-2">
                      <Clock className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Long-term</p>
                      <p className="text-sm text-gray-600">Readable for decades</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-teal-100 p-2">
                      <FileCheck className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Self-contained</p>
                      <p className="text-sm text-gray-600">All resources embedded</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Process Button */}
            <button
              onClick={handleProcess}
              className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow-xl"
            >
              <Archive className="mr-2 inline-block h-5 w-5" />
              Convert to PDF/A
            </button>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-teal-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Converting to PDF/A...</h3>
              <p className="mb-6 text-gray-500">{processingSteps[processingStep]}</p>
              <div className="mx-auto flex max-w-md justify-center gap-2">
                {processingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-full rounded-full transition-all ${
                      index <= processingStep ? 'bg-teal-500' : 'bg-gray-200'
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
                <p className="text-gray-500">Your PDF has been converted to PDF/A-{level} format</p>
              </div>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-teal-600" />
                    <div>
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700">
                    <Archive className="h-4 w-4" />
                    PDF/A-{level}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={result.download_url}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-3 font-medium text-white shadow-lg transition-all hover:from-teal-700 hover:to-cyan-700"
                >
                  <Download className="h-5 w-5" />
                  Download PDF/A
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 font-medium text-white hover:bg-teal-700"
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
