'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Droplets,
  Upload,
  X,
  Download,
  RotateCcw,
  Image as ImageIcon,
  Type,
  Palette,
  Move,
  RotateCw,
  Check,
  Loader2,
  Eye,
  Grid3X3,
  Copy,
  CheckCircle2,
  AlertCircle,
  Camera,
  FileText,
  Building2
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { addImageWatermark, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

interface ImageDimensions {
  width: number;
  height: number;
}

const POSITIONS = [
  { value: 'top-left', label: 'Top Left', row: 0, col: 0 },
  { value: 'top-center', label: 'Top Center', row: 0, col: 1 },
  { value: 'top-right', label: 'Top Right', row: 0, col: 2 },
  { value: 'center-left', label: 'Center Left', row: 1, col: 0 },
  { value: 'center', label: 'Center', row: 1, col: 1 },
  { value: 'center-right', label: 'Center Right', row: 1, col: 2 },
  { value: 'bottom-left', label: 'Bottom Left', row: 2, col: 0 },
  { value: 'bottom-center', label: 'Bottom Center', row: 2, col: 1 },
  { value: 'bottom-right', label: 'Bottom Right', row: 2, col: 2 },
];

const COLOR_OPTIONS = [
  { value: 'white', label: 'White', hex: '#FFFFFF', textClass: 'text-gray-800' },
  { value: 'black', label: 'Black', hex: '#000000', textClass: 'text-white' },
  { value: 'red', label: 'Red', hex: '#EF4444', textClass: 'text-white' },
  { value: 'blue', label: 'Blue', hex: '#3B82F6', textClass: 'text-white' },
  { value: 'green', label: 'Green', hex: '#22C55E', textClass: 'text-white' },
  { value: 'yellow', label: 'Yellow', hex: '#EAB308', textClass: 'text-gray-800' },
  { value: 'purple', label: 'Purple', hex: '#A855F7', textClass: 'text-white' },
  { value: 'gray', label: 'Gray', hex: '#6B7280', textClass: 'text-white' },
];

const FONT_SIZES = [
  { value: 20, label: 'Small' },
  { value: 40, label: 'Medium' },
  { value: 60, label: 'Large' },
  { value: 80, label: 'X-Large' },
  { value: 100, label: 'XX-Large' },
];

const PROCESSING_STEPS = [
  { id: 1, label: 'Reading image', icon: ImageIcon },
  { id: 2, label: 'Creating watermark', icon: Type },
  { id: 3, label: 'Applying watermark', icon: Droplets },
  { id: 4, label: 'Finalizing', icon: Check },
];

export default function ImageWatermarkPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [text, setText] = useState<string>('WATERMARK');
  const [position, setPosition] = useState<string>('center');
  const [opacity, setOpacity] = useState<number>(0.5);
  const [fontSize, setFontSize] = useState<number>(40);
  const [color, setColor] = useState<string>('white');
  const [rotation, setRotation] = useState<number>(0);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);

      const img = new window.Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = url;

      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

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
    if (droppedFile && droppedFile.type.startsWith('image/')) {
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
      const response = await addImageWatermark(file, text, {
        position,
        opacity,
        fontSize,
        color,
        rotation,
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
    setPreview(null);
    setImageDimensions(null);
    setText('WATERMARK');
    setPosition('center');
    setOpacity(0.5);
    setFontSize(40);
    setColor('white');
    setRotation(0);
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

  const getPositionStyle = () => {
    const positionMap: Record<string, { top?: string; left?: string; right?: string; bottom?: string; transform?: string }> = {
      'top-left': { top: '10%', left: '10%' },
      'top-center': { top: '10%', left: '50%', transform: `translateX(-50%) rotate(${rotation}deg)` },
      'top-right': { top: '10%', right: '10%' },
      'center-left': { top: '50%', left: '10%', transform: `translateY(-50%) rotate(${rotation}deg)` },
      'center': { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${rotation}deg)` },
      'center-right': { top: '50%', right: '10%', transform: `translateY(-50%) rotate(${rotation}deg)` },
      'bottom-left': { bottom: '10%', left: '10%' },
      'bottom-center': { bottom: '10%', left: '50%', transform: `translateX(-50%) rotate(${rotation}deg)` },
      'bottom-right': { bottom: '10%', right: '10%' },
    };

    const baseStyle = positionMap[position] || positionMap['center'];
    if (!baseStyle.transform) {
      baseStyle.transform = `rotate(${rotation}deg)`;
    }
    return baseStyle;
  };

  const selectedColor = COLOR_OPTIONS.find(c => c.value === color);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
            <Droplets className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Image Watermark</h1>
          <p className="mt-2 text-gray-600">Add custom text watermark to protect your images</p>
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
                  ? 'border-teal-500 bg-teal-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-teal-400 hover:bg-teal-50/50'
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-teal-200 scale-110' : 'bg-teal-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-teal-600' : 'text-teal-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your image here' : 'Drag & drop an image'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
              <p className="mt-4 text-xs text-gray-400">Supports: JPG, PNG, WebP</p>
            </div>

            {/* Use Cases */}
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { icon: Camera, label: 'Photography' },
                { icon: Palette, label: 'Artwork' },
                { icon: FileText, label: 'Documents' },
                { icon: Building2, label: 'Business' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                      <Icon className="h-5 w-5 text-teal-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-600">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - Options */}
        {status === 'preview' && preview && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Image Preview with Watermark */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <Eye className="h-5 w-5 text-teal-500" />
                  Preview
                </h3>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative overflow-hidden rounded-xl bg-[url('/grid-pattern.svg')] bg-gray-100">
                <img
                  src={preview}
                  alt="Preview"
                  className="h-auto w-full max-h-[400px] object-contain"
                />
                {/* Watermark Preview Overlay */}
                {text && (
                  <div
                    className="pointer-events-none absolute whitespace-nowrap font-bold"
                    style={{
                      ...getPositionStyle(),
                      fontSize: `${Math.min(fontSize / 3, 24)}px`,
                      color: selectedColor?.hex || '#FFFFFF',
                      opacity: opacity,
                      textShadow: color === 'white' ? '1px 1px 2px rgba(0,0,0,0.5)' : '1px 1px 2px rgba(255,255,255,0.5)',
                    }}
                  >
                    {text}
                  </div>
                )}
              </div>

              {imageDimensions && (
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                  <span>{file?.name}</span>
                  <span>{imageDimensions.width} x {imageDimensions.height}</span>
                </div>
              )}
            </Card>

            {/* Options */}
            <Card className="p-6">
              <h3 className="mb-6 flex items-center gap-2 font-semibold text-gray-900">
                <Droplets className="h-5 w-5 text-teal-500" />
                Watermark Options
              </h3>

              <div className="space-y-6">
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
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                {/* Position Grid */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Grid3X3 className="h-4 w-4" />
                    Position
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {POSITIONS.map((pos) => (
                      <button
                        key={pos.value}
                        onClick={() => setPosition(pos.value)}
                        className={`rounded-lg border-2 p-3 text-xs font-medium transition-all ${
                          position === pos.value
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-200 hover:border-teal-300 hover:bg-teal-50/50'
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
                            ? 'border-teal-500 ring-2 ring-teal-500/30'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {color === c.value && (
                          <Check className={`h-5 w-5 ${c.textClass}`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Type className="h-4 w-4" />
                    Font Size
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FONT_SIZES.map((size) => (
                      <button
                        key={size.value}
                        onClick={() => setFontSize(size.value)}
                        className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                          fontSize === size.value
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-200 hover:border-teal-300'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity Slider */}
                <div>
                  <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Opacity
                    </span>
                    <span className="text-teal-600">{Math.round(opacity * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-teal-500"
                  />
                </div>

                {/* Rotation Slider */}
                <div>
                  <label className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-2">
                      <RotateCw className="h-4 w-4" />
                      Rotation
                    </span>
                    <span className="text-teal-600">{rotation}°</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="15"
                    value={rotation}
                    onChange={(e) => setRotation(parseInt(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-teal-500"
                  />
                </div>

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!text.trim()}
                  className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
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
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-cyan-100">
                <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Adding Watermark</h3>
              <p className="mb-8 text-gray-500">Please wait while we process your image</p>

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
                        isActive ? 'bg-teal-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-teal-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
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
                        isActive ? 'text-teal-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
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
              <p className="mb-6 text-gray-500">Your image has been watermarked successfully</p>

              {/* Result Info */}
              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100">
                      <ImageIcon className="h-6 w-6 text-teal-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="rounded-full bg-teal-100 px-3 py-1 text-sm font-medium text-teal-700">
                    {text}
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
                  <Button className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700">
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
                Process another image
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Processing Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600">
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
