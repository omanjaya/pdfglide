'use client';

import { useState, useCallback } from 'react';
import {
  Minimize2,
  Upload,
  X,
  Download,
  RotateCcw,
  FileText,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Target,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingDown
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { compressPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type Quality = 'extreme' | 'low' | 'medium' | 'high';
type CompressionMode = 'quality' | 'target';
type SizeUnit = 'KB' | 'MB';

interface CompressionStats {
  original_size: number;
  compressed_size: number;
  saved_bytes: number;
  compression_ratio: number;
  method: string;
  target_size_kb?: number;
  target_reached?: boolean;
  final_dpi?: number;
  message?: string;
}

const QUALITY_OPTIONS = [
  { value: 'extreme' as Quality, label: 'Maximum', description: 'Smallest file', dpi: 72, color: 'from-red-500 to-orange-500' },
  { value: 'low' as Quality, label: 'High', description: 'Web/Email', dpi: 150, color: 'from-orange-500 to-yellow-500' },
  { value: 'medium' as Quality, label: 'Balanced', description: 'Good quality', dpi: 200, color: 'from-green-500 to-emerald-500' },
  { value: 'high' as Quality, label: 'Minimal', description: 'Best quality', dpi: 300, color: 'from-blue-500 to-indigo-500' },
];

const PROCESSING_STEPS = [
  { id: 1, label: 'Analyzing PDF', icon: FileText },
  { id: 2, label: 'Optimizing images', icon: Minimize2 },
  { id: 3, label: 'Compressing content', icon: TrendingDown },
  { id: 4, label: 'Finalizing', icon: Check },
];

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<CompressionMode>('quality');
  const [quality, setQuality] = useState<Quality>('medium');
  const [targetSize, setTargetSize] = useState<number>(500);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('KB');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compressImages, setCompressImages] = useState(true);
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [compressionStats, setCompressionStats] = useState<CompressionStats | null>(null);
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

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setStatus('preview');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('preview');
    }
  }, []);

  const getTargetSizeKb = (): number | null => {
    if (mode !== 'target') return null;
    return sizeUnit === 'MB' ? targetSize * 1024 : targetSize;
  };

  const handleProcess = async () => {
    if (!file) return;

    setStatus('processing');
    setError(null);
    setCompressionStats(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev < PROCESSING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 800);

    try {
      const response = await compressPdf(file, {
        quality,
        compress_images: compressImages,
        remove_metadata: removeMetadata,
        grayscale,
        target_size_kb: getTargetSizeKb(),
      });

      clearInterval(stepInterval);

      if (response.success) {
        setResult(response.data);
        if (response.data.metadata) {
          setCompressionStats(response.data.metadata as CompressionStats);
        }
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
    setMode('quality');
    setQuality('medium');
    setTargetSize(500);
    setSizeUnit('KB');
    setShowAdvanced(false);
    setCompressImages(true);
    setRemoveMetadata(false);
    setGrayscale(false);
    setStatus('idle');
    setResult(null);
    setCompressionStats(null);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <Minimize2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Compress PDF</h1>
          <p className="mt-2 text-gray-600">Reduce file size while maintaining quality</p>
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
                  ? 'border-green-500 bg-green-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-green-200 scale-110' : 'bg-green-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-green-600' : 'text-green-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
              <p className="mt-4 text-xs text-gray-400">Supports PDF files up to 100MB</p>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: TrendingDown, label: 'Up to 90%', desc: 'Size reduction' },
                { icon: Target, label: 'Target Size', desc: 'Set exact size' },
                { icon: Zap, label: 'Fast', desc: 'Quick processing' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <Icon className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - Options */}
        {status === 'preview' && file && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* File Preview */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <FileText className="h-5 w-5 text-green-500" />
                  Selected File
                </h3>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-green-50 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-green-100">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{file.name}</p>
                  <p className="text-lg font-bold text-green-600">{formatFileSize(file.size)}</p>
                </div>
              </div>

              {/* Compression Mode Toggle */}
              <div className="mt-6">
                <label className="mb-3 block text-sm font-medium text-gray-700">Compression Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('quality')}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all ${
                      mode === 'quality'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <Zap className="h-5 w-5" />
                    <span className="font-medium">Quality Preset</span>
                  </button>
                  <button
                    onClick={() => setMode('target')}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all ${
                      mode === 'target'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <Target className="h-5 w-5" />
                    <span className="font-medium">Target Size</span>
                  </button>
                </div>
              </div>
            </Card>

            {/* Options */}
            <Card className="p-6">
              <h3 className="mb-6 flex items-center gap-2 font-semibold text-gray-900">
                <Minimize2 className="h-5 w-5 text-green-500" />
                Compression Settings
              </h3>

              <div className="space-y-4">
                {/* Quality Mode Options */}
                {mode === 'quality' && (
                  <div className="grid grid-cols-2 gap-3">
                    {QUALITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setQuality(opt.value)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          quality === opt.value
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-gray-900">{opt.label}</span>
                          {quality === opt.value && <Check className="h-5 w-5 text-green-500" />}
                        </div>
                        <p className="text-sm text-gray-500">{opt.description}</p>
                        <div className="mt-2">
                          <span className={`inline-block rounded-full bg-gradient-to-r ${opt.color} px-2 py-0.5 text-xs text-white`}>
                            {opt.dpi} DPI
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Target Size Mode Options */}
                {mode === 'target' && (
                  <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
                    <div className="mb-3 flex items-center gap-2 text-green-700">
                      <Target className="h-5 w-5" />
                      <span className="font-medium">Target File Size</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={10}
                        max={sizeUnit === 'MB' ? 100 : 102400}
                        value={targetSize}
                        onChange={(e) => setTargetSize(parseInt(e.target.value) || 0)}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-xl font-bold focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      />
                      <div className="flex overflow-hidden rounded-lg border border-gray-300">
                        <button
                          onClick={() => setSizeUnit('KB')}
                          className={`px-4 py-3 text-sm font-medium transition-colors ${
                            sizeUnit === 'KB' ? 'bg-green-500 text-white' : 'hover:bg-gray-100'
                          }`}
                        >
                          KB
                        </button>
                        <button
                          onClick={() => setSizeUnit('MB')}
                          className={`px-4 py-3 text-sm font-medium transition-colors ${
                            sizeUnit === 'MB' ? 'bg-green-500 text-white' : 'hover:bg-gray-100'
                          }`}
                        >
                          MB
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Current: <strong>{formatFileSize(file.size)}</strong>
                    </p>
                  </div>
                )}

                {/* Advanced Options */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex w-full items-center justify-between rounded-xl border border-gray-200 p-3 transition-colors hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Settings className="h-4 w-4" />
                    Advanced Options
                  </span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showAdvanced && (
                  <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compressImages}
                        onChange={(e) => setCompressImages(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Compress Images</p>
                        <p className="text-xs text-gray-500">Optimize embedded images</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={removeMetadata}
                        onChange={(e) => setRemoveMetadata(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Remove Metadata</p>
                        <p className="text-xs text-gray-500">Strip document info</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={grayscale}
                        onChange={(e) => setGrayscale(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Convert to Grayscale</p>
                        <p className="text-xs text-gray-500">Remove color for smaller size</p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  <Minimize2 className="mr-2 h-5 w-5" />
                  {mode === 'target' ? `Compress to ${targetSize} ${sizeUnit}` : 'Compress PDF'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-100">
                <Loader2 className="h-10 w-10 animate-spin text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Compressing PDF</h3>
              <p className="mb-8 text-gray-500">Optimizing your document</p>

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
                        isActive ? 'bg-green-50' : isCompleted ? 'bg-emerald-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-green-500 text-white' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
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
                        isActive ? 'text-green-700' : isCompleted ? 'text-emerald-700' : 'text-gray-400'
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">PDF Compressed!</h3>

              {/* Compression Stats */}
              {compressionStats && (
                <div className="mb-6">
                  <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Original</p>
                      <p className="text-lg font-bold text-gray-700">{formatFileSize(compressionStats.original_size)}</p>
                    </div>
                    <div className="rounded-xl bg-green-50 p-3">
                      <p className="text-xs text-green-600">Compressed</p>
                      <p className="text-lg font-bold text-green-700">{formatFileSize(compressionStats.compressed_size)}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-xs text-blue-600">Saved</p>
                      <p className="text-lg font-bold text-blue-700">{formatFileSize(compressionStats.saved_bytes)}</p>
                    </div>
                    <div className="rounded-xl bg-purple-50 p-3">
                      <p className="text-xs text-purple-600">Reduction</p>
                      <p className="text-lg font-bold text-purple-700">{compressionStats.compression_ratio}%</p>
                    </div>
                  </div>

                  {compressionStats.target_size_kb && (
                    <div className={`rounded-lg p-3 text-sm ${
                      compressionStats.target_reached
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {compressionStats.target_reached
                        ? `Target of ${compressionStats.target_size_kb} KB reached!`
                        : `Could not reach target of ${compressionStats.target_size_kb} KB`}
                    </div>
                  )}
                </div>
              )}

              {/* Result Info */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-100">
                    <FileText className="h-7 w-7 text-green-600" />
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
                  <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
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
                Compress another PDF
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Compression Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600">
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
