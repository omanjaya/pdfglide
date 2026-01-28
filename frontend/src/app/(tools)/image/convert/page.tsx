'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  Download,
  RefreshCw,
  Upload,
  Check,
  ImageIcon,
  X,
  ArrowRight,
  Loader2,
  Camera,
  Image as ImageFormatIcon,
  Globe,
  Film,
  LucideIcon
} from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { api, getDownloadUrl } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const FORMATS: { value: string; label: string; description: string; icon: LucideIcon; color: string }[] = [
  { value: 'jpg', label: 'JPG', description: 'Best for photos', icon: Camera, color: 'bg-blue-500' },
  { value: 'png', label: 'PNG', description: 'Best for graphics', icon: ImageFormatIcon, color: 'bg-green-500' },
  { value: 'webp', label: 'WebP', description: 'Modern web format', icon: Globe, color: 'bg-purple-500' },
  { value: 'gif', label: 'GIF', description: 'Animated images', icon: Film, color: 'bg-pink-500' },
];

const PROCESSING_STEPS = [
  { label: 'Reading image' },
  { label: 'Converting format' },
  { label: 'Optimizing' },
  { label: 'Saving' },
];

export default function ConvertImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [originalFormat, setOriginalFormat] = useState<string | null>(null);

  const [format, setFormat] = useState('jpg');
  const [quality, setQuality] = useState(90);
  const [processingStep, setProcessingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setOriginalPreview(url);
      setOriginalSize(files[0].size);
      setStatus('preview');

      // Detect format from file
      const ext = files[0].name.split('.').pop()?.toLowerCase() || '';
      setOriginalFormat(ext === 'jpeg' ? 'jpg' : ext);

      const img = new Image();
      img.onload = () => setImageDimensions({ width: img.width, height: img.height });
      img.src = url;

      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalPreview(null);
      setImageDimensions(null);
      setOriginalFormat(null);
      setStatus('idle');
    }
  }, [files]);

  useEffect(() => {
    if (status === 'processing') {
      setProcessingStep(0);
      let step = 0;
      const interval = setInterval(() => {
        step++;
        if (step < PROCESSING_STEPS.length) setProcessingStep(step);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [status]);

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
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (droppedFiles.length > 0) setFiles([droppedFiles[0]]);
  }, []);

  const handleProcess = async () => {
    if (files.length === 0) return;
    setStatus('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      formData.append('format', format);
      formData.append('quality', quality.toString());

      const response = await api.post('/image/convert', formData);

      if (response.data.success) {
        const data = response.data.data;
        setDownloadUrl(data.download_url);
        setFileName(data.file_name);
        setFileSize(data.file_size);
        setResultPreview(getDownloadUrl(data.download_url));
        setStatus('completed');
      } else {
        setError(response.data.error || 'Conversion failed');
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
    setOriginalFormat(null);
    setError(null);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = getDownloadUrl(downloadUrl);
      link.download = fileName || `converted.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <ToolLayout
      title="Convert Image"
      description="Convert images between JPG, PNG, WebP, and GIF"
      icon={ArrowRightLeft}
      color="bg-gradient-to-br from-cyan-500 to-blue-500"
    >
      {/* Upload State */}
      {status === 'idle' && (
        <div className="space-y-8">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12
              transition-all duration-300 ease-out
              ${isDragOver
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20 scale-[1.02]'
                : 'border-border hover:border-cyan-400 hover:bg-muted/50'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => e.target.files?.[0] && setFiles([e.target.files[0]])}
              className="hidden"
            />
            <div className="flex flex-col items-center text-center">
              <div className={`mb-4 rounded-full p-4 transition-all duration-300 ${isDragOver ? 'bg-cyan-500 text-white scale-110' : 'bg-muted'}`}>
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold">{isDragOver ? 'Drop your image here' : 'Upload an image'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Drag & drop or click to browse</p>
              <Button className="mt-6" variant="default">
                <ImageIcon className="mr-2 h-4 w-4" />
                Select Image
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {FORMATS.map((fmt) => {
              const FormatIcon = fmt.icon;
              return (
                <div key={fmt.value} className="flex flex-col items-center p-4 rounded-xl bg-muted/50 text-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${fmt.color} mb-2`}>
                    <FormatIcon className="h-5 w-5 text-white" />
                  </div>
                  <p className="font-medium">{fmt.label}</p>
                  <p className="text-xs text-muted-foreground">{fmt.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview State */}
      {status === 'preview' && originalPreview && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              <div className="relative bg-muted aspect-square lg:aspect-auto lg:min-h-[400px]">
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <img src={originalPreview} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
                </div>
                <div className="absolute top-4 left-4">
                  <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-sm font-medium uppercase">
                    {originalFormat}
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs">
                    {imageDimensions && `${imageDimensions.width} × ${imageDimensions.height}`}
                  </div>
                  <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white text-xs">
                    {files[0] && formatFileSize(files[0].size)}
                  </div>
                </div>
              </div>

              <CardContent className="p-6 space-y-6 bg-card">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate">{files[0]?.name}</h3>
                    <p className="text-sm text-muted-foreground">Select output format</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Format Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Convert to</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {FORMATS.map((fmt) => {
                      const FormatIcon = fmt.icon;
                      return (
                        <button
                          key={fmt.value}
                          onClick={() => setFormat(fmt.value)}
                          disabled={fmt.value === originalFormat}
                          className={`
                            p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98]
                            ${fmt.value === originalFormat ? 'opacity-40 cursor-not-allowed' : ''}
                            ${format === fmt.value && fmt.value !== originalFormat
                              ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30'
                              : 'border-border hover:border-muted-foreground/50'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${fmt.color}`}>
                              <FormatIcon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">{fmt.label}</p>
                              <p className="text-xs text-muted-foreground">{fmt.description}</p>
                            </div>
                          </div>
                          {fmt.value === originalFormat && (
                            <p className="text-xs text-muted-foreground mt-2">Current format</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quality Slider */}
                {(format === 'jpg' || format === 'webp') && (
                  <div className="p-3 rounded-lg bg-muted space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Quality</Label>
                      <span className="text-sm font-mono bg-background px-2 py-0.5 rounded">{quality}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                )}

                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={format === originalFormat}
                  className="w-full h-12 text-base bg-cyan-500 hover:bg-cyan-600"
                >
                  <ArrowRightLeft className="mr-2 h-5 w-5" />
                  Convert to {format.toUpperCase()}
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
            <div className="relative bg-muted aspect-square lg:aspect-auto lg:min-h-[400px]">
              {originalPreview && (
                <>
                  <img src={originalPreview} alt="Processing" className="absolute inset-0 w-full h-full object-contain p-4 blur-sm opacity-50" />
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                </>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="flex items-center justify-center gap-4 text-2xl font-bold">
                    <span className="uppercase">{originalFormat}</span>
                    <ArrowRight className="h-8 w-8 animate-pulse" />
                    <span className="uppercase">{format}</span>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-6 flex flex-col justify-center">
              <h3 className="text-xl font-semibold mb-6">Converting your image...</h3>
              <div className="space-y-4">
                {PROCESSING_STEPS.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                      ${index < processingStep ? 'bg-cyan-500 text-white' : index === processingStep ? 'bg-cyan-500/20 text-cyan-500 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                      {index < processingStep ? <Check className="h-4 w-4" /> : index === processingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">{index + 1}</span>}
                    </div>
                    <span className={`text-sm ${index <= processingStep ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Completed State */}
      {status === 'completed' && originalPreview && resultPreview && (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Original ({originalFormat?.toUpperCase()})</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={originalPreview} alt="Original" className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-2 text-sm">{originalSize && formatFileSize(originalSize)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Converted ({format.toUpperCase()})</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={resultPreview} alt="Converted" className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-2 text-sm text-cyan-500">{fileSize && formatFileSize(fileSize)}</p>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-center">
                <p className="text-sm text-muted-foreground">Successfully converted</p>
                <p className="text-lg font-bold text-cyan-500">{originalFormat?.toUpperCase()} → {format.toUpperCase()}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    <img src={resultPreview} alt="Result" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{fileName}</p>
                    <p className="text-sm text-muted-foreground">{fileSize && formatFileSize(fileSize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    New
                  </Button>
                  <Button onClick={handleDownload} className="bg-cyan-500 hover:bg-cyan-600">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <Card className="border-red-200 dark:border-red-900">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <X className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-red-600">{error}</h3>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={handleReset}>Try Again</Button>
              <Button onClick={handleProcess} className="bg-red-500 hover:bg-red-600">
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  );
}
