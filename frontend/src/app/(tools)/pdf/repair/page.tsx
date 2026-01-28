'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Wrench,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  FileWarning,
  Database,
  FileCode,
  Shield,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { repairPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PROCESSING_STEPS = [
  'Analyzing PDF structure...',
  'Scanning for errors...',
  'Rebuilding cross-references...',
  'Removing invalid objects...',
  'Generating repaired PDF...',
];

const REPAIR_FEATURES = [
  {
    icon: FileCode,
    title: 'Structure Fix',
    description: 'Fixes corrupted PDF structure',
    color: 'rose',
  },
  {
    icon: Database,
    title: 'XRef Rebuild',
    description: 'Rebuilds cross-reference tables',
    color: 'pink',
  },
  {
    icon: Shield,
    title: 'Invalid Objects',
    description: 'Removes broken objects',
    color: 'red',
  },
  {
    icon: Sparkles,
    title: 'Data Recovery',
    description: 'Recovers readable content',
    color: 'orange',
  },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function RepairPdfPage() {
  const [file, setFile] = useState<File | null>(null);
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
    }, 1000);

    try {
      const response = await repairPdf(file);
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
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Wrench className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">Repair PDF</h1>
          <p className="text-center text-rose-100 max-w-2xl mx-auto">
            Fix corrupted or damaged PDF files and recover your data
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
                    ? 'border-rose-500 bg-rose-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-rose-400 hover:bg-rose-50/50'
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
                  isDragging ? 'bg-rose-500 scale-110' : 'bg-gradient-to-br from-rose-500 to-pink-600'
                }`}>
                  <FileWarning className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragging ? 'Drop your damaged PDF here' : 'Upload damaged PDF'}
                </h3>
                <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Upload className="h-4 w-4" />
                  <span>PDF files only • Max 100MB</span>
                </div>
              </div>

              {/* Repair Features Grid */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                {REPAIR_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className={`flex items-start gap-3 p-4 rounded-xl bg-${feature.color}-50`}
                    >
                      <Icon className={`h-5 w-5 text-${feature.color}-600 mt-0.5`} />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{feature.title}</p>
                        <p className="text-xs text-gray-500">{feature.description}</p>
                      </div>
                    </div>
                  );
                })}
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
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Damaged PDF</h3>
                    <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl p-6 relative">
                      <button
                        onClick={handleReset}
                        className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <X className="h-4 w-4 text-gray-500" />
                      </button>
                      <div className="flex flex-col items-center">
                        <div className="w-24 h-32 bg-white rounded-lg shadow-md flex items-center justify-center mb-4 relative">
                          <FileText className="h-12 w-12 text-rose-500" />
                          <div className="absolute -top-2 -right-2 p-1.5 bg-amber-500 rounded-full">
                            <AlertTriangle className="h-3 w-3 text-white" />
                          </div>
                        </div>
                        <p className="font-medium text-gray-800 text-center truncate max-w-full">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800 text-sm">Ready to Repair</p>
                          <p className="text-xs text-amber-600 mt-1">
                            Click the button below to start the repair process
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Repair Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Repair Process</h3>
                    <div className="space-y-4">
                      {/* What will be repaired */}
                      <div className="p-4 rounded-xl bg-gray-50">
                        <p className="text-sm font-medium text-gray-700 mb-3">This tool will:</p>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                              <FileCode className="h-3 w-3 text-rose-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-700 font-medium">Fix Structure</p>
                              <p className="text-xs text-gray-500">Repair corrupted PDF headers and structure</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
                              <Database className="h-3 w-3 text-pink-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-700 font-medium">Rebuild XRef</p>
                              <p className="text-xs text-gray-500">Reconstruct cross-reference tables</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                              <Shield className="h-3 w-3 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-700 font-medium">Remove Invalid</p>
                              <p className="text-xs text-gray-500">Remove broken or corrupted objects</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                              <Sparkles className="h-3 w-3 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-sm text-gray-700 font-medium">Recover Data</p>
                              <p className="text-xs text-gray-500">Extract and preserve readable content</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Warning Note */}
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-800 text-sm">Note</p>
                            <p className="text-xs text-blue-600 mt-1">
                              Recovery success depends on the extent of damage. Severely corrupted files may not be fully recoverable.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleProcess}
                    className="px-8 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-semibold hover:from-rose-700 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                  >
                    <Wrench className="h-5 w-5" />
                    Repair PDF
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
                <div className="absolute inset-0 rounded-full border-4 border-rose-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wrench className="h-10 w-10 text-rose-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Repairing PDF...</h3>

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
                      <CheckCircle2 className="h-5 w-5 text-rose-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">PDF Repaired!</h3>
              <p className="text-rose-100 mt-1">Your PDF has been successfully recovered</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-semibold hover:from-rose-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-rose-500" />
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
                Repair Another PDF
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
              <h3 className="text-2xl font-bold">Repair Failed</h3>
              <p className="text-red-100 mt-1">{error}</p>
            </div>
            <CardContent className="p-6">
              <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 text-sm">Repair Tips</p>
                    <ul className="text-xs text-amber-600 mt-1 list-disc ml-4 space-y-1">
                      <li>Make sure the file is a valid PDF (even if corrupted)</li>
                      <li>Try uploading the file again</li>
                      <li>The file may be too severely damaged to repair</li>
                    </ul>
                  </div>
                </div>
              </div>
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
