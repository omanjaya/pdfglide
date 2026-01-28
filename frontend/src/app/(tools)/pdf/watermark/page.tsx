'use client';

import { useState, useCallback } from 'react';
import {
  Droplets,
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
  Type,
  Palette,
  RotateCw,
  Eye,
  Lock,
  Copyright,
  Building2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { addWatermark, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const POSITIONS = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center-left', label: 'Center Left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

const COLOR_OPTIONS = [
  { value: 'gray', label: 'Gray', hex: '#6B7280' },
  { value: 'red', label: 'Red', hex: '#EF4444' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6' },
  { value: 'green', label: 'Green', hex: '#22C55E' },
  { value: 'black', label: 'Black', hex: '#000000' },
  { value: 'white', label: 'White', hex: '#FFFFFF' },
];

const PROCESSING_STEPS = [
  { id: 1, label: 'Reading PDF', icon: FileText },
  { id: 2, label: 'Creating watermark', icon: Type },
  { id: 3, label: 'Applying to pages', icon: Droplets },
  { id: 4, label: 'Finalizing', icon: Check },
];

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>('CONFIDENTIAL');
  const [position, setPosition] = useState<string>('center');
  const [opacity, setOpacity] = useState<number>(0.3);
  const [rotation, setRotation] = useState<number>(45);
  const [fontSize, setFontSize] = useState<number>(60);
  const [color, setColor] = useState<string>('gray');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
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

  const handleProcess = async () => {
    if (!file || !text.trim()) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev < PROCESSING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 600);

    try {
      const response = await addWatermark(file, text, {
        position,
        opacity,
        rotation,
        fontSize,
        color,
      });

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
    setText('CONFIDENTIAL');
    setPosition('center');
    setOpacity(0.3);
    setRotation(45);
    setFontSize(60);
    setColor('gray');
    setStatus('idle');
    setResult(null);
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

  const selectedColor = COLOR_OPTIONS.find(c => c.value === color);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-sky-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 shadow-lg">
            <Droplets className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PDF Watermark</h1>
          <p className="mt-2 text-gray-600">Add text watermark to protect your documents</p>
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
                  ? 'border-cyan-500 bg-cyan-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-cyan-400 hover:bg-cyan-50/50'
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-cyan-200 scale-110' : 'bg-cyan-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-cyan-600' : 'text-cyan-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
            </div>

            {/* Use Cases */}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { icon: Lock, label: 'Confidential' },
                { icon: FileText, label: 'Draft' },
                { icon: Copyright, label: 'Copyright' },
                { icon: Building2, label: 'Company' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
                      <Icon className="h-5 w-5 text-cyan-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-600">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - Options */}
        {status === 'preview' && file && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Preview with Watermark */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <Eye className="h-5 w-5 text-cyan-500" />
                  Preview
                </h3>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* PDF Preview with Watermark */}
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white border-2 border-gray-200">
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                  <div className="h-full w-full p-4">
                    <div className="h-full rounded border border-gray-300 bg-white shadow-sm relative overflow-hidden">
                      {/* Watermark Preview */}
                      {text && (
                        <div
                          className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            opacity: opacity,
                          }}
                        >
                          <span
                            className="whitespace-nowrap font-bold"
                            style={{
                              fontSize: `${Math.min(fontSize / 4, 24)}px`,
                              color: selectedColor?.hex || '#6B7280',
                            }}
                          >
                            {text}
                          </span>
                        </div>
                      )}
                      <div className="p-4 text-xs text-gray-400">
                        <div className="h-2 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-5/6 mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Info */}
              <div className="mt-4 flex items-center gap-3 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span className="truncate">{file.name}</span>
                <span className="text-gray-400">•</span>
                <span>{formatFileSize(file.size)}</span>
              </div>
            </Card>

            {/* Options */}
            <Card className="p-6">
              <h3 className="mb-6 flex items-center gap-2 font-semibold text-gray-900">
                <Droplets className="h-5 w-5 text-cyan-500" />
                Watermark Options
              </h3>

              <div className="space-y-5">
                {/* Text Input */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Type className="h-4 w-4" />
                    Watermark Text
                  </label>
                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter watermark text"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>

                {/* Position Grid */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Position</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.value}
                        onClick={() => setPosition(pos.value)}
                        className={`rounded-lg border-2 p-2 text-xs font-medium transition-all ${
                          position === pos.value
                            ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                            : 'border-gray-200 hover:border-cyan-300'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Palette className="h-4 w-4" />
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setColor(c.value)}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-all ${
                          color === c.value
                            ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {color === c.value && (
                          <Check className={`h-5 w-5 ${c.value === 'white' ? 'text-gray-800' : 'text-white'}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity & Rotation Sliders */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        Opacity
                      </span>
                      <span className="text-cyan-600">{Math.round(opacity * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                      <span className="flex items-center gap-1">
                        <RotateCw className="h-4 w-4" />
                        Rotation
                      </span>
                      <span className="text-cyan-600">{rotation}°</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={rotation}
                      onChange={(e) => setRotation(parseInt(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-500"
                    />
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                    <span>Font Size</span>
                    <span className="text-cyan-600">{fontSize}px</span>
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="150"
                    step="10"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-500"
                  />
                </div>

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!text.trim()}
                  className="w-full bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700"
                >
                  <Droplets className="mr-2 h-5 w-5" />
                  Add Watermark
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-sky-100">
                <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Adding Watermark</h3>
              <p className="mb-8 text-gray-500">Applying "{text}" to your PDF</p>

              <div className="space-y-3">
                {PROCESSING_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === processingStep;
                  const isCompleted = index < processingStep;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                        isActive ? 'bg-cyan-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-cyan-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
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
                        isActive ? 'text-cyan-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Watermark Added!</h3>
              <p className="mb-6 text-gray-500">Your PDF has been watermarked with "{text}"</p>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-100">
                    <FileText className="h-7 w-7 text-cyan-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={copyDownloadLink}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <a href={result.download_url} download className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700">
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
                Watermark another PDF
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Watermark Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-cyan-500 to-sky-600">
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
