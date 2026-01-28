'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Crop,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  ArrowLeft,
  Maximize2,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cropPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PROCESSING_STEPS = [
  'Reading PDF pages...',
  'Calculating crop areas...',
  'Applying margins...',
  'Cropping pages...',
  'Generating cropped PDF...',
];

const PRESET_MARGINS = [
  { name: 'None', value: 0 },
  { name: 'Small', value: 20 },
  { name: 'Medium', value: 40 },
  { name: 'Large', value: 60 },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function CropPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [marginTop, setMarginTop] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [uniformMargin, setUniformMargin] = useState(true);
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

  const setAllMargins = (value: number) => {
    setMarginTop(value);
    setMarginRight(value);
    setMarginBottom(value);
    setMarginLeft(value);
  };

  const handleMarginChange = (side: 'top' | 'right' | 'bottom' | 'left', value: number) => {
    if (uniformMargin) {
      setAllMargins(value);
    } else {
      switch (side) {
        case 'top': setMarginTop(value); break;
        case 'right': setMarginRight(value); break;
        case 'bottom': setMarginBottom(value); break;
        case 'left': setMarginLeft(value); break;
      }
    }
  };

  const resetMargins = () => {
    setAllMargins(0);
  };

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
      const response = await cropPdf(file, marginTop, marginRight, marginBottom, marginLeft);
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
    setAllMargins(0);
    setStatus('idle');
    setResult(null);
    setError(null);
    setProcessingStep(0);
    setCopied(false);
    setUniformMargin(true);
  };

  const handleCopyLink = async () => {
    if (result?.download_url) {
      await navigator.clipboard.writeText(window.location.origin + result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Crop className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">Crop PDF</h1>
          <p className="text-center text-amber-100 max-w-2xl mx-auto">
            Remove margins and crop specific areas from your PDF pages
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
                    ? 'border-amber-500 bg-amber-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-amber-400 hover:bg-amber-50/50'
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
                  isDragging ? 'bg-amber-500 scale-110' : 'bg-gradient-to-br from-amber-500 to-orange-600'
                }`}>
                  <Crop className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragging ? 'Drop your PDF here' : 'Upload PDF to crop'}
                </h3>
                <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Upload className="h-4 w-4" />
                  <span>PDF files only • Max 100MB</span>
                </div>
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50">
                  <Maximize2 className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Remove Margins</p>
                    <p className="text-xs text-gray-500">Trim white space</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-50">
                  <Crop className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Custom Crop</p>
                    <p className="text-xs text-gray-500">Set precise margins</p>
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
                  {/* Visual Preview */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Crop Preview</h3>
                    <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl p-6">
                      {/* PDF Page Visual with Margins */}
                      <div className="relative mx-auto" style={{ width: '200px', height: '260px' }}>
                        {/* Original page outline */}
                        <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="h-16 w-16 text-gray-200" />
                          </div>
                        </div>

                        {/* Top margin indicator */}
                        {marginTop > 0 && (
                          <div
                            className="absolute left-0 right-0 top-0 bg-amber-500/20 border-b-2 border-amber-500"
                            style={{ height: `${Math.min(marginTop / 2, 50)}px` }}
                          >
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-amber-700 font-medium">
                              {marginTop}pt
                            </span>
                          </div>
                        )}

                        {/* Bottom margin indicator */}
                        {marginBottom > 0 && (
                          <div
                            className="absolute left-0 right-0 bottom-0 bg-amber-500/20 border-t-2 border-amber-500"
                            style={{ height: `${Math.min(marginBottom / 2, 50)}px` }}
                          >
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-amber-700 font-medium">
                              {marginBottom}pt
                            </span>
                          </div>
                        )}

                        {/* Left margin indicator */}
                        {marginLeft > 0 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-orange-500/20 border-r-2 border-orange-500"
                            style={{ width: `${Math.min(marginLeft / 2, 40)}px` }}
                          >
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-orange-700 font-medium rotate-90">
                              {marginLeft}pt
                            </span>
                          </div>
                        )}

                        {/* Right margin indicator */}
                        {marginRight > 0 && (
                          <div
                            className="absolute right-0 top-0 bottom-0 bg-orange-500/20 border-l-2 border-orange-500"
                            style={{ width: `${Math.min(marginRight / 2, 40)}px` }}
                          >
                            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-orange-700 font-medium -rotate-90">
                              {marginRight}pt
                            </span>
                          </div>
                        )}

                        {/* Crop indicator (dashed inner box) */}
                        <div
                          className="absolute border-2 border-dashed border-green-500 rounded bg-green-50/30"
                          style={{
                            top: `${Math.min(marginTop / 2, 50)}px`,
                            right: `${Math.min(marginRight / 2, 40)}px`,
                            bottom: `${Math.min(marginBottom / 2, 50)}px`,
                            left: `${Math.min(marginLeft / 2, 40)}px`,
                          }}
                        />
                      </div>

                      {/* File info */}
                      <div className="mt-6 text-center">
                        <button
                          onClick={handleReset}
                          className="absolute top-2 right-2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <X className="h-4 w-4 text-gray-500" />
                        </button>
                        <p className="font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Margin Controls */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Crop Margins</h3>
                      <button
                        onClick={resetMargins}
                        className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset
                      </button>
                    </div>

                    {/* Uniform Toggle */}
                    <div className="mb-4 p-3 rounded-xl bg-gray-50">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={uniformMargin}
                          onChange={(e) => setUniformMargin(e.target.checked)}
                          className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700">Apply same margin to all sides</span>
                      </label>
                    </div>

                    {/* Quick Presets */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Quick presets:</p>
                      <div className="flex gap-2">
                        {PRESET_MARGINS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => setAllMargins(preset.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              marginTop === preset.value && marginRight === preset.value &&
                              marginBottom === preset.value && marginLeft === preset.value
                                ? 'bg-amber-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Individual Margin Controls */}
                    <div className="space-y-4">
                      {/* Top */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <ArrowUp className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Top</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={marginTop}
                              onChange={(e) => handleMarginChange('top', parseInt(e.target.value))}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={marginTop}
                              onChange={(e) => handleMarginChange('top', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border rounded-lg text-center text-sm"
                            />
                            <span className="text-xs text-gray-400">pt</span>
                          </div>
                        </div>
                      </div>

                      {/* Right */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                          <ArrowRight className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Right</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={marginRight}
                              onChange={(e) => handleMarginChange('right', parseInt(e.target.value))}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={marginRight}
                              onChange={(e) => handleMarginChange('right', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border rounded-lg text-center text-sm"
                            />
                            <span className="text-xs text-gray-400">pt</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                          <ArrowDown className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Bottom</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={marginBottom}
                              onChange={(e) => handleMarginChange('bottom', parseInt(e.target.value))}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={marginBottom}
                              onChange={(e) => handleMarginChange('bottom', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border rounded-lg text-center text-sm"
                            />
                            <span className="text-xs text-gray-400">pt</span>
                          </div>
                        </div>
                      </div>

                      {/* Left */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                          <ArrowLeft className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500">Left</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="200"
                              value={marginLeft}
                              onChange={(e) => handleMarginChange('left', parseInt(e.target.value))}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                            />
                            <input
                              type="number"
                              min="0"
                              max="500"
                              value={marginLeft}
                              onChange={(e) => handleMarginChange('left', parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border rounded-lg text-center text-sm"
                            />
                            <span className="text-xs text-gray-400">pt</span>
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
                    className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                  >
                    <Crop className="h-5 w-5" />
                    Crop PDF
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
                <div className="absolute inset-0 rounded-full border-4 border-amber-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Crop className="h-10 w-10 text-amber-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-6">Cropping PDF...</h3>

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
                      <CheckCircle2 className="h-5 w-5 text-amber-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">PDF Cropped!</h3>
              <p className="text-amber-100 mt-1">Your PDF has been cropped successfully</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <Crop className="h-6 w-6 text-amber-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-amber-500" />
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
                Crop Another PDF
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
              <h3 className="text-2xl font-bold">Crop Failed</h3>
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
