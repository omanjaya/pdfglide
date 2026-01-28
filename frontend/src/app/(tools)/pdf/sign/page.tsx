'use client';

import { useState, useCallback, useRef } from 'react';
import {
  PenTool,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ImageIcon,
  Move
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { signPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PROCESSING_STEPS = [
  'Reading PDF document...',
  'Loading signature image...',
  'Positioning signature...',
  'Applying signature...',
  'Generating signed PDF...',
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function SignPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [x, setX] = useState(100);
  const [y, setY] = useState(100);
  const [width, setWidth] = useState<number | undefined>(150);
  const [height, setHeight] = useState<number | undefined>(50);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingSig, setIsDraggingSig] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setStatus('preview');
      setError(null);
    }
  }, []);

  const handleSignatureSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type.startsWith('image/')) {
      setSignatureFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setSignaturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
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

  const handleSigDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSig(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleSignatureSelect(droppedFile);
    }
  }, [handleSignatureSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleProcess = async () => {
    if (!file || !signatureFile) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) =>
        prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 800);

    try {
      const response = await signPdf(file, signatureFile, page, x, y, width, height);
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
    setSignatureFile(null);
    setSignaturePreview(null);
    setPage(1);
    setX(100);
    setY(100);
    setWidth(150);
    setHeight(50);
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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <PenTool className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">Sign PDF</h1>
          <p className="text-center text-violet-100 max-w-2xl mx-auto">
            Add your signature image to PDF documents
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
                    ? 'border-violet-500 bg-violet-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-violet-400 hover:bg-violet-50/50'
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
                  isDragging ? 'bg-violet-500 scale-110' : 'bg-gradient-to-br from-violet-500 to-purple-600'
                }`}>
                  <PenTool className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragging ? 'Drop your PDF here' : 'Upload PDF to sign'}
                </h3>
                <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Upload className="h-4 w-4" />
                  <span>PDF files only • Max 100MB</span>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50">
                  <ImageIcon className="h-5 w-5 text-violet-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Image Signature</p>
                    <p className="text-xs text-gray-500">PNG, JPG supported</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-50">
                  <Move className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Custom Position</p>
                    <p className="text-xs text-gray-500">Place anywhere</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State */}
        {status === 'preview' && file && (
          <div className="max-w-5xl mx-auto">
            <Card className="shadow-xl border-0">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - PDF & Signature Upload */}
                  <div className="space-y-6">
                    {/* PDF File */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">PDF Document</h3>
                      <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl p-4 relative">
                        <button
                          onClick={handleReset}
                          className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-20 bg-white rounded-lg shadow flex items-center justify-center">
                            <FileText className="h-8 w-8 text-violet-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{file.name}</p>
                            <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signature Upload */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Signature Image</h3>
                      <div
                        onDrop={handleSigDrop}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingSig(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDraggingSig(false); }}
                        onClick={() => sigInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                          isDraggingSig
                            ? 'border-violet-500 bg-violet-50'
                            : signatureFile
                            ? 'border-violet-400 bg-violet-50/50'
                            : 'border-gray-200 hover:border-violet-400'
                        }`}
                      >
                        <input
                          ref={sigInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleSignatureSelect(e.target.files[0])}
                          className="hidden"
                        />
                        {signaturePreview ? (
                          <div className="flex flex-col items-center">
                            <img
                              src={signaturePreview}
                              alt="Signature"
                              className="max-h-20 object-contain mb-2"
                            />
                            <p className="text-sm text-gray-600">{signatureFile?.name}</p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSignatureFile(null);
                                setSignaturePreview(null);
                              }}
                              className="mt-2 text-xs text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="h-10 w-10 text-violet-400 mx-auto mb-2" />
                            <p className="text-gray-600 font-medium">Upload signature image</p>
                            <p className="text-xs text-gray-400 mt-1">PNG or JPG with transparent background</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Position Settings */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Position Settings</h3>
                    <div className="space-y-4">
                      {/* Page Number */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Page Number</label>
                        <input
                          type="number"
                          min={1}
                          value={page}
                          onChange={(e) => setPage(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Which page to place the signature</p>
                      </div>

                      {/* Position */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">X Position</label>
                          <input
                            type="number"
                            min={0}
                            value={x}
                            onChange={(e) => setX(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Y Position</label>
                          <input
                            type="number"
                            min={0}
                            value={y}
                            onChange={(e) => setY(parseInt(e.target.value) || 0)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Position from bottom-left corner in points</p>

                      {/* Size */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Width (optional)</label>
                          <input
                            type="number"
                            min={1}
                            value={width || ''}
                            onChange={(e) => setWidth(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Auto"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Height (optional)</label>
                          <input
                            type="number"
                            min={1}
                            value={height || ''}
                            onChange={(e) => setHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                            placeholder="Auto"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Leave empty for auto sizing</p>

                      {/* Preview Indicator */}
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-sm text-gray-600">
                          <strong>Preview:</strong> Signature will be placed at ({x}, {y}) on page {page}
                          {width && height && ` with size ${width}x${height}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleProcess}
                    disabled={!signatureFile}
                    className={`px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3 ${
                      !signatureFile ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <PenTool className="h-5 w-5" />
                    Sign PDF
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
                <div className="absolute inset-0 rounded-full border-4 border-violet-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <PenTool className="h-10 w-10 text-violet-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Signing PDF...</h3>

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
                      <CheckCircle2 className="h-5 w-5 text-violet-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">PDF Signed!</h3>
              <p className="text-violet-100 mt-1">Your signature has been added</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <PenTool className="h-6 w-6 text-violet-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-violet-500" />
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
                Sign Another PDF
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
              <h3 className="text-2xl font-bold">Signing Failed</h3>
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
