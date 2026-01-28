'use client';

import { useState, useCallback, useRef } from 'react';
import {
  GitCompare,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  FileSearch,
  ArrowLeftRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { comparePdfs, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type OutputMode = 'visual' | 'text';

const PROCESSING_STEPS = [
  'Reading first PDF...',
  'Reading second PDF...',
  'Analyzing content...',
  'Finding differences...',
  'Generating comparison report...',
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ComparePdfPage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>('visual');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging1, setIsDragging1] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const handleFileSelect1 = useCallback((selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile1(selectedFile);
      if (file2) setStatus('preview');
    }
  }, [file2]);

  const handleFileSelect2 = useCallback((selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile2(selectedFile);
      if (file1) setStatus('preview');
    }
  }, [file1]);

  const handleDrop1 = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging1(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect1(droppedFile);
  }, [handleFileSelect1]);

  const handleDrop2 = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging2(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect2(droppedFile);
  }, [handleFileSelect2]);

  const handleProcess = async () => {
    if (!file1 || !file2) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) =>
        prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 900);

    try {
      const response = await comparePdfs(file1, file2, outputMode);
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
    setFile1(null);
    setFile2(null);
    setOutputMode('visual');
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

  const bothFilesSelected = file1 && file2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <GitCompare className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">Compare PDFs</h1>
          <p className="text-center text-blue-100 max-w-2xl mx-auto">
            Find differences between two PDF documents
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 -mt-6">
        {/* Idle/Upload State */}
        {(status === 'idle' || (status === 'preview' && !bothFilesSelected)) && (
          <Card className="max-w-4xl mx-auto shadow-xl border-0">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original PDF */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Original PDF
                  </label>
                  <div
                    onDrop={handleDrop1}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging1(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging1(false); }}
                    onClick={() => fileInput1Ref.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      isDragging1
                        ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                        : file1
                        ? 'border-blue-400 bg-blue-50/50'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                    }`}
                  >
                    <input
                      ref={fileInput1Ref}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect1(e.target.files[0])}
                      className="hidden"
                    />
                    {file1 ? (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-20 bg-white rounded-lg shadow flex items-center justify-center mb-3 border border-blue-200">
                          <FileText className="h-8 w-8 text-blue-500" />
                        </div>
                        <p className="font-medium text-gray-800 truncate max-w-full text-sm">
                          {file1.name}
                        </p>
                        <p className="text-xs text-gray-500">{formatFileSize(file1.size)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFile1(null); }}
                          className="mt-2 text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">Upload first PDF</p>
                        <p className="text-xs text-gray-400 mt-1">Drag & drop or click</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Modified PDF */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Modified PDF
                  </label>
                  <div
                    onDrop={handleDrop2}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging2(false); }}
                    onClick={() => fileInput2Ref.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      isDragging2
                        ? 'border-cyan-500 bg-cyan-50 scale-[1.02]'
                        : file2
                        ? 'border-cyan-400 bg-cyan-50/50'
                        : 'border-gray-200 hover:border-cyan-400 hover:bg-cyan-50/50'
                    }`}
                  >
                    <input
                      ref={fileInput2Ref}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => e.target.files?.[0] && handleFileSelect2(e.target.files[0])}
                      className="hidden"
                    />
                    {file2 ? (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-20 bg-white rounded-lg shadow flex items-center justify-center mb-3 border border-cyan-200">
                          <FileText className="h-8 w-8 text-cyan-500" />
                        </div>
                        <p className="font-medium text-gray-800 truncate max-w-full text-sm">
                          {file2.name}
                        </p>
                        <p className="text-xs text-gray-500">{formatFileSize(file2.size)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFile2(null); }}
                          className="mt-2 text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-cyan-400 mx-auto mb-3" />
                        <p className="text-gray-600 font-medium">Upload second PDF</p>
                        <p className="text-xs text-gray-400 mt-1">Drag & drop or click</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Compare Indicator */}
              <div className="flex justify-center my-6">
                <div className={`p-3 rounded-full ${bothFilesSelected ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <ArrowLeftRight className={`h-6 w-6 ${bothFilesSelected ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
              </div>

              {/* Output Mode Selection */}
              {bothFilesSelected && (
                <div className="space-y-4">
                  <label className="text-sm font-medium text-gray-700 block">
                    Comparison Mode
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setOutputMode('visual')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        outputMode === 'visual'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <Eye className={`h-5 w-5 ${outputMode === 'visual' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${outputMode === 'visual' ? 'text-blue-700' : 'text-gray-700'}`}>
                          Visual
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Side-by-side with highlighted differences
                      </p>
                    </button>
                    <button
                      onClick={() => setOutputMode('text')}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        outputMode === 'text'
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 hover:border-cyan-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <FileSearch className={`h-5 w-5 ${outputMode === 'text' ? 'text-cyan-600' : 'text-gray-400'}`} />
                        <span className={`font-medium ${outputMode === 'text' ? 'text-cyan-700' : 'text-gray-700'}`}>
                          Text
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Text-based diff report
                      </p>
                    </button>
                  </div>

                  {/* Action Button */}
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleProcess}
                      className="px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                    >
                      <GitCompare className="h-5 w-5" />
                      Compare PDFs
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="max-w-xl mx-auto shadow-xl border-0">
            <CardContent className="p-12 text-center">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <GitCompare className="h-10 w-10 text-blue-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Comparing PDFs...</h3>

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
                      <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">Comparison Complete!</h3>
              <p className="text-blue-100 mt-1">Differences have been identified</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <GitCompare className="h-6 w-6 text-blue-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download Report
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-blue-500" />
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
                Compare Other PDFs
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
              <h3 className="text-2xl font-bold">Comparison Failed</h3>
              <p className="text-red-100 mt-1">{error}</p>
            </div>
            <CardContent className="p-6">
              <div className="flex gap-3">
                <button
                  onClick={handleProcess}
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
