'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Eraser,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Palette,
  FileType,
  Upload,
  Sparkles,
  Shield,
  Clock,
  Check,
  Copy,
  Columns,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
  User,
  Package,
  ShoppingBag,
  PawPrint,
  ImageIcon,
  X,
  ArrowRight,
  Loader2,
  Image as ImageFormatIcon,
  Camera,
  Globe,
  LucideIcon
} from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { api, getDownloadUrl } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type ViewMode = 'slider' | 'side-by-side';

const BG_COLORS = [
  { value: '', label: 'Transparent', color: 'transparent' },
  { value: 'white', label: 'White', color: '#ffffff' },
  { value: 'black', label: 'Black', color: '#000000' },
  { value: '#f3f4f6', label: 'Light Gray', color: '#f3f4f6' },
  { value: '#1f2937', label: 'Dark Gray', color: '#1f2937' },
  { value: '#3b82f6', label: 'Blue', color: '#3b82f6' },
  { value: '#22c55e', label: 'Green', color: '#22c55e' },
  { value: '#f97316', label: 'Orange', color: '#f97316' },
  { value: 'custom', label: 'Custom', color: 'custom' },
];

const OUTPUT_FORMATS: { value: string; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'png', label: 'PNG', description: 'Best for transparency', icon: ImageFormatIcon },
  { value: 'jpeg', label: 'JPEG', description: 'Smaller file size', icon: Camera },
  { value: 'webp', label: 'WebP', description: 'Modern & compact', icon: Globe },
];

const USE_CASES = [
  { icon: User, label: 'Portraits', color: 'bg-blue-500' },
  { icon: Package, label: 'Products', color: 'bg-purple-500' },
  { icon: ShoppingBag, label: 'E-commerce', color: 'bg-pink-500' },
  { icon: PawPrint, label: 'Pets', color: 'bg-orange-500' },
];

const PROCESSING_STEPS = [
  { label: 'Analyzing image', duration: 20 },
  { label: 'Detecting subject', duration: 40 },
  { label: 'Removing background', duration: 30 },
  { label: 'Finalizing', duration: 10 },
];

export default function RemoveBackgroundPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Preview URLs
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Options
  const [bgColor, setBgColor] = useState('');
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [outputFormat, setOutputFormat] = useState('png');
  const [quality, setQuality] = useState(90);

  // Comparison
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('slider');
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing animation
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);

  // Checkerboard pattern for transparent preview
  const checkerboardStyle = {
    backgroundImage: `
      linear-gradient(45deg, #ccc 25%, transparent 25%),
      linear-gradient(-45deg, #ccc 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #ccc 75%),
      linear-gradient(-45deg, transparent 75%, #ccc 75%)
    `,
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  };

  // Load image dimensions
  useEffect(() => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setOriginalPreview(url);
      setOriginalSize(files[0].size);
      setStatus('preview');

      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = url;

      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalPreview(null);
      setImageDimensions(null);
      setStatus('idle');
    }
  }, [files]);

  // Processing step animation
  useEffect(() => {
    if (status === 'processing') {
      setProcessingStep(0);
      let step = 0;
      const interval = setInterval(() => {
        step++;
        if (step < PROCESSING_STEPS.length) {
          setProcessingStep(step);
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );
    if (droppedFiles.length > 0) {
      setFiles([droppedFiles[0]]);
    }
  }, []);

  // Handle slider drag
  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);

      const finalBgColor = bgColor === 'custom' ? customColor : bgColor;
      if (finalBgColor) {
        formData.append('bg_color', finalBgColor);
      }

      formData.append('output_format', outputFormat);
      formData.append('quality', quality.toString());

      const response = await api.post('/image/remove-background', formData);

      if (response.data.success) {
        const data = response.data.data;
        setDownloadUrl(data.download_url);
        setFileName(data.file_name);
        setFileSize(data.file_size);

        const resultUrl = getDownloadUrl(data.download_url);
        setResultPreview(resultUrl);
        setSliderPosition(50);
        setZoom(1);
        setStatus('completed');
      } else {
        setError(response.data.error || 'Processing failed');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setStatus('idle');
    setOriginalPreview(null);
    setResultPreview(null);
    setDownloadUrl(null);
    setFileName(null);
    setFileSize(null);
    setOriginalSize(null);
    setImageDimensions(null);
    setError(null);
    setSliderPosition(50);
    setZoom(1);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = getDownloadUrl(downloadUrl);
      link.download = fileName || 'removed-bg.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopyLink = async () => {
    if (downloadUrl) {
      await navigator.clipboard.writeText(window.location.origin + getDownloadUrl(downloadUrl));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSizeReduction = () => {
    if (!originalSize || !fileSize) return null;
    const reduction = ((originalSize - fileSize) / originalSize) * 100;
    return reduction > 0 ? reduction.toFixed(0) : null;
  };

  return (
    <ToolLayout
      title="Remove Background"
      description="Instantly remove image backgrounds with smart edge detection"
      icon={Eraser}
      color="bg-gradient-to-br from-green-500 to-emerald-600"
    >
      {/* Upload State */}
      {status === 'idle' && (
        <div className="space-y-8">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12
              transition-all duration-300 ease-out
              ${isDragOver
                ? 'border-green-500 bg-green-50 dark:bg-green-950/20 scale-[1.02]'
                : 'border-border hover:border-green-400 hover:bg-muted/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => e.target.files?.[0] && setFiles([e.target.files[0]])}
              className="hidden"
            />

            <div className="flex flex-col items-center text-center">
              <div className={`
                mb-4 rounded-full p-4 transition-all duration-300
                ${isDragOver ? 'bg-green-500 text-white scale-110' : 'bg-muted'}
              `}>
                <Upload className="h-8 w-8" />
              </div>

              <h3 className="text-lg font-semibold">
                {isDragOver ? 'Drop your image here' : 'Upload an image'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag & drop or click to browse
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Supports JPG, PNG, WebP up to 10MB
              </p>

              <Button className="mt-6" variant="default">
                <ImageIcon className="mr-2 h-4 w-4" />
                Select Image
              </Button>
            </div>
          </div>

          {/* Use Cases */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-center text-muted-foreground">
              Perfect for
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {USE_CASES.map((useCase) => (
                <div
                  key={useCase.label}
                  className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm"
                >
                  <div className={`rounded-full p-1 ${useCase.color}`}>
                    <useCase.icon className="h-3 w-3 text-white" />
                  </div>
                  {useCase.label}
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Sparkles, title: 'Smart Detection', desc: 'Precise edge detection' },
              { icon: Palette, title: 'Custom Background', desc: 'Any color you want' },
              { icon: Download, title: 'Multiple Formats', desc: 'PNG, JPEG, WebP' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/50"
              >
                <feature.icon className="h-6 w-6 text-green-500 mb-2" />
                <p className="font-medium text-sm">{feature.title}</p>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview State */}
      {status === 'preview' && originalPreview && (
        <div className="space-y-6">
          {/* Main Preview Card */}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Image Preview */}
              <div className="relative bg-muted aspect-square lg:aspect-auto lg:min-h-[400px]">
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <img
                    src={originalPreview}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
                {/* Image Info Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs">
                    {imageDimensions && `${imageDimensions.width} × ${imageDimensions.height}`}
                  </div>
                  <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs">
                    {files[0] && formatFileSize(files[0].size)}
                  </div>
                </div>
              </div>

              {/* Options Panel */}
              <CardContent className="p-6 space-y-6 bg-card">
                {/* File Info */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate">{files[0]?.name}</h3>
                    <p className="text-sm text-muted-foreground">Ready to process</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Background Color */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Palette className="h-4 w-4" />
                    Background Color
                  </Label>
                  <div className="grid grid-cols-5 gap-2">
                    {BG_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setBgColor(color.value)}
                        className={`
                          relative aspect-square rounded-xl border-2 transition-all
                          hover:scale-105 active:scale-95
                          ${bgColor === color.value
                            ? 'border-green-500 ring-2 ring-green-500/20'
                            : 'border-border hover:border-muted-foreground/50'}
                        `}
                        title={color.label}
                      >
                        {color.color === 'transparent' ? (
                          <div className="w-full h-full rounded-lg" style={checkerboardStyle} />
                        ) : color.color === 'custom' ? (
                          <div
                            className="w-full h-full rounded-lg"
                            style={{ background: `conic-gradient(from 0deg, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899, #f97316)` }}
                          />
                        ) : (
                          <div
                            className="w-full h-full rounded-lg"
                            style={{ backgroundColor: color.color }}
                          />
                        )}
                        {bgColor === color.value && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Check className="h-4 w-4 text-green-500 drop-shadow-md" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Color Picker */}
                  {bgColor === 'custom' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                      />
                      <Input
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        placeholder="#RRGGBB"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Output Format */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <FileType className="h-4 w-4" />
                    Output Format
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {OUTPUT_FORMATS.map((fmt) => {
                      const FormatIcon = fmt.icon;
                      return (
                        <button
                          key={fmt.value}
                          onClick={() => setOutputFormat(fmt.value)}
                          className={`
                            p-3 rounded-xl border-2 text-center transition-all
                            hover:scale-[1.02] active:scale-[0.98]
                            ${outputFormat === fmt.value
                              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                              : 'border-border hover:border-muted-foreground/50'}
                          `}
                        >
                          <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${
                            outputFormat === fmt.value ? 'bg-green-100' : 'bg-muted'
                          }`}>
                            <FormatIcon className={`h-4 w-4 ${
                              outputFormat === fmt.value ? 'text-green-600' : 'text-muted-foreground'
                            }`} />
                          </div>
                          <p className="font-medium text-sm mt-1">{fmt.label}</p>
                        </button>
                      );
                    })}
                  </div>

                  {/* Quality slider */}
                  {(outputFormat === 'jpeg' || outputFormat === 'webp') && (
                    <div className="p-3 rounded-lg bg-muted space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Quality</Label>
                        <span className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                          {quality}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={quality}
                        onChange={(e) => setQuality(Number(e.target.value))}
                        className="w-full accent-green-500"
                      />
                    </div>
                  )}

                  {/* Transparency warning */}
                  {outputFormat !== 'png' && !bgColor && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                      JPEG/WebP will use white background
                    </p>
                  )}
                </div>

                {/* Security info */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <Shield className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Your data is secure
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Files automatically deleted after download or within 5 minutes
                    </p>
                  </div>
                </div>

                {/* Process Button */}
                <Button size="lg" onClick={handleProcess} className="w-full h-12 text-base">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Remove Background
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      )}

      {/* Processing State */}
      {status === 'processing' && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Original Image - Blurred */}
            <div className="relative bg-muted aspect-square lg:aspect-auto lg:min-h-[400px]">
              {originalPreview && (
                <>
                  <img
                    src={originalPreview}
                    alt="Processing"
                    className="absolute inset-0 w-full h-full object-contain p-4 blur-sm opacity-50"
                  />
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                </>
              )}
              {/* Processing Animation Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="relative inline-flex">
                    <div className="w-20 h-20 rounded-full border-4 border-white/20" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <Eraser className="absolute inset-0 m-auto h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Panel */}
            <CardContent className="p-6 flex flex-col justify-center">
              <h3 className="text-xl font-semibold mb-6">Processing your image...</h3>

              <div className="space-y-4">
                {PROCESSING_STEPS.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center transition-all
                      ${index < processingStep
                        ? 'bg-green-500 text-white'
                        : index === processingStep
                          ? 'bg-green-500/20 text-green-500 animate-pulse'
                          : 'bg-muted text-muted-foreground'}
                    `}>
                      {index < processingStep ? (
                        <Check className="h-4 w-4" />
                      ) : index === processingStep ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-xs">{index + 1}</span>
                      )}
                    </div>
                    <span className={`
                      text-sm transition-colors
                      ${index <= processingStep ? 'text-foreground' : 'text-muted-foreground'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                This usually takes 5-15 seconds depending on image size
              </p>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Completed State */}
      {status === 'completed' && originalPreview && resultPreview && (
        <div className="space-y-6">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={viewMode === 'slider' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('slider')}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Slider
            </Button>
            <Button
              variant={viewMode === 'side-by-side' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('side-by-side')}
            >
              <Columns className="h-4 w-4 mr-1" />
              Side by Side
            </Button>
          </div>

          {/* Comparison View */}
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              {viewMode === 'slider' ? (
                /* Slider View */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      <ChevronLeft className="h-4 w-4" />
                      Original
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                        disabled={zoom <= 0.5}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground w-12 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                        disabled={zoom >= 2}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                      Result
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>

                  <div
                    ref={containerRef}
                    className="relative w-full aspect-[4/3] rounded-xl overflow-hidden cursor-ew-resize select-none"
                    style={checkerboardStyle}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onMouseMove={handleMouseMove}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                  >
                    {/* Result Image */}
                    <img
                      src={resultPreview}
                      alt="Result"
                      className="absolute inset-0 w-full h-full object-contain transition-transform"
                      style={{ transform: `scale(${zoom})` }}
                      draggable={false}
                    />

                    {/* Original Image (Clipped) */}
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ width: `${sliderPosition}%` }}
                    >
                      <img
                        src={originalPreview}
                        alt="Original"
                        className="absolute inset-0 w-full h-full object-contain transition-transform"
                        style={{
                          width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%',
                          maxWidth: 'none',
                          transform: `scale(${zoom})`,
                        }}
                        draggable={false}
                      />
                    </div>

                    {/* Slider Handle */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.3)]"
                      style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                        <ChevronLeft className="h-4 w-4 text-gray-600 -mr-1" />
                        <ChevronRight className="h-4 w-4 text-gray-600 -ml-1" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* Side by Side View */
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center text-muted-foreground">Original</p>
                    <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                      <img
                        src={originalPreview}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center text-muted-foreground">Result</p>
                    <div className="aspect-square rounded-xl overflow-hidden" style={checkerboardStyle}>
                      <img
                        src={resultPreview}
                        alt="Result"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Download Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* File Info */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={checkerboardStyle}>
                    <img
                      src={resultPreview}
                      alt="Result"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{fileName}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{fileSize && formatFileSize(fileSize)}</span>
                      {getSizeReduction() && (
                        <span className="text-green-500 font-medium">
                          {Number(getSizeReduction()) > 0 ? '-' : '+'}{Math.abs(Number(getSizeReduction()))}% size
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copy link">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    New
                  </Button>
                  <Button onClick={handleDownload} className="bg-green-500 hover:bg-green-600">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Re-process option */}
          <div className="text-center">
            <button
              onClick={() => setStatus('preview')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Want different settings? <span className="text-green-500 hover:underline">Adjust options</span>
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <Card className="border-red-200 dark:border-red-900 overflow-hidden">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-red-600 dark:text-red-400">
                Processing Failed
              </h3>
              <p className="mt-2 text-muted-foreground max-w-md mx-auto">{error}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  Try Different Image
                </Button>
                <Button onClick={handleProcess} className="bg-red-500 hover:bg-red-600">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  );
}
