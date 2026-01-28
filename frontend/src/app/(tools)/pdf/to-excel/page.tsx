'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Table,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  FileSpreadsheet,
  Rows,
  Grid3X3
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { pdfToExcel, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PROCESSING_STEPS = [
  'Reading PDF document...',
  'Detecting tables...',
  'Extracting cell data...',
  'Formatting columns...',
  'Generating Excel file...',
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function PdfToExcelPage() {
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
    }, 900);

    try {
      const response = await pdfToExcel(file);
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Table className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">PDF to Excel</h1>
          <p className="text-center text-emerald-100 max-w-2xl mx-auto">
            Extract tables from PDF and convert to Excel spreadsheet
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
                    ? 'border-emerald-500 bg-emerald-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50'
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
                  isDragging ? 'bg-emerald-500 scale-110' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                }`}>
                  <FileSpreadsheet className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragging ? 'Drop your PDF here' : 'Upload PDF with tables'}
                </h3>
                <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Upload className="h-4 w-4" />
                  <span>PDF files only • Max 100MB</span>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50">
                  <Grid3X3 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Table Detection</p>
                    <p className="text-xs text-gray-500">Auto-detect tables</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-teal-50">
                  <Rows className="h-5 w-5 text-teal-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Data Extraction</p>
                    <p className="text-xs text-gray-500">Preserve structure</p>
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
                        <div className="w-24 h-32 bg-white rounded-lg shadow-md flex items-center justify-center mb-4 relative">
                          <FileText className="h-12 w-12 text-emerald-500" />
                        </div>
                        <p className="font-medium text-gray-800 text-center truncate max-w-full">
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Output Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Output Format</h3>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">Excel Spreadsheet</p>
                          <p className="text-sm text-gray-500">.xlsx format</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Best results when:</p>
                        <ul className="space-y-1.5">
                          <li className="flex items-start gap-2 text-sm text-gray-600">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            PDF contains tables with clear borders
                          </li>
                          <li className="flex items-start gap-2 text-sm text-gray-600">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            Text is selectable (not scanned images)
                          </li>
                          <li className="flex items-start gap-2 text-sm text-gray-600">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            Tables have consistent formatting
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleProcess}
                    className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                  >
                    <Table className="h-5 w-5" />
                    Convert to Excel
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
                <div className="absolute inset-0 rounded-full border-4 border-emerald-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Table className="h-10 w-10 text-emerald-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Converting to Excel...</h3>

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
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">Excel Ready!</h3>
              <p className="text-emerald-100 mt-1">Tables extracted successfully</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <Table className="h-6 w-6 text-emerald-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download Excel
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-emerald-500" />
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
