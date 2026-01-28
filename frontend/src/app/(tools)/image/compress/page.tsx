'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Minimize2,
  Download,
  RefreshCw,
  Upload,
  Sparkles,
  Check,
  ImageIcon,
  X,
  ArrowRight,
  Loader2,
  Gauge,
  FileImage,
  TrendingDown,
  Award,
  Scale,
  Archive,
  LucideIcon
} from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { api, getDownloadUrl } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const QUALITY_PRESETS: { value: number; label: string; description: string; icon: LucideIcon; recommended?: boolean }[] = [
  { value: 90, label: 'High', description: 'Best quality, larger file', icon: Award },
  { value: 75, label: 'Medium', description: 'Balanced quality & size', icon: Scale, recommended: true },
  { value: 50, label: 'Low', description: 'Smallest file, lower quality', icon: Archive },
];

const PROCESSING_STEPS = [
  { label: 'Analyzing image' },
  { label: 'Optimizing colors' },
  { label: 'Compressing data' },
  { label: 'Finalizing' },
];

export default function CompressImagePage() {
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

  const [quality, setQuality] = useState(75);
  const [processingStep, setProcessingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setOriginalPreview(url);
      setOriginalSize(files[0].size);
      setStatus('preview');

      const img = new Image();
      img.onload = () => setImageDimensions({ width: img.width, height: img.height });
      img.src = url;

      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalPreview(null);
      setImageDimensions(null);
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
      }, 800);
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
      formData.append('quality', quality.toString());

      const response = await api.post('/image/compress', formData);

      if (response.data.success) {
        const data = response.data.data;
        setDownloadUrl(data.download_url);
        setFileName(data.file_name);
        setFileSize(data.file_size);
        setResultPreview(getDownloadUrl(data.download_url));
        setStatus('completed');
      } else {
        setError(response.data.error || 'Compression failed');
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
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = getDownloadUrl(downloadUrl);
      link.download = fileName || 'compressed.jpg';
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

  const getSizeReduction = () => {
    if (!originalSize || !fileSize) return null;
    const reduction = ((originalSize - fileSize) / originalSize) * 100;
    return reduction.toFixed(0);
  };

  return (
    <ToolLayout
      title="Compress Image"
      description="Reduce image file size while maintaining quality"
      icon={Minimize2}
      color="bg-gradient-to-br from-orange-500 to-red-500"
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
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 scale-[1.02]'
                : 'border-border hover:border-orange-400 hover:bg-muted/50'}
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
              <div className={`mb-4 rounded-full p-4 transition-all duration-300 ${isDragOver ? 'bg-orange-500 text-white scale-110' : 'bg-muted'}`}>
                <Upload className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold">{isDragOver ? 'Drop your image here' : 'Upload an image'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Drag & drop or click to browse</p>
              <p className="mt-2 text-xs text-muted-foreground">Supports JPG, PNG, WebP up to 10MB</p>
              <Button className="mt-6" variant="default">
                <ImageIcon className="mr-2 h-4 w-4" />
                Select Image
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: TrendingDown, title: 'Up to 80% smaller', desc: 'Significant file reduction' },
              { icon: Sparkles, title: 'Smart compression', desc: 'Maintains visual quality' },
              { icon: FileImage, title: 'All formats', desc: 'JPG, PNG, WebP support' },
            ].map((f) => (
              <div key={f.title} className="flex flex-col items-center text-center p-4 rounded-xl bg-muted/50">
                <f.icon className="h-6 w-6 text-orange-500 mb-2" />
                <p className="font-medium text-sm">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
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
                    <p className="text-sm text-muted-foreground">Ready to compress</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Gauge className="h-4 w-4" />
                    Compression Level
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {QUALITY_PRESETS.map((preset) => {
                      const PresetIcon = preset.icon;
                      return (
                        <button
                          key={preset.value}
                          onClick={() => setQuality(preset.value)}
                          className={`
                            p-3 rounded-xl border-2 text-center transition-all hover:scale-[1.02] active:scale-[0.98]
                            ${quality === preset.value
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                              : 'border-border hover:border-muted-foreground/50'}
                          `}
                        >
                          <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${
                            quality === preset.value ? 'bg-orange-100' : 'bg-muted'
                          }`}>
                            <PresetIcon className={`h-4 w-4 ${
                              quality === preset.value ? 'text-orange-600' : 'text-muted-foreground'
                            }`} />
                          </div>
                          <p className="font-medium text-sm mt-1">{preset.label}</p>
                          {preset.recommended && (
                            <span className="text-[10px] text-orange-500 font-medium">Recommended</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

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
                      className="w-full accent-orange-500"
                    />
                  </div>
                </div>

                <Button size="lg" onClick={handleProcess} className="w-full h-12 text-base bg-orange-500 hover:bg-orange-600">
                  <Minimize2 className="mr-2 h-5 w-5" />
                  Compress Image
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
                  <div className="relative inline-flex">
                    <div className="w-20 h-20 rounded-full border-4 border-white/20" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-t-white border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <Minimize2 className="absolute inset-0 m-auto h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="p-6 flex flex-col justify-center">
              <h3 className="text-xl font-semibold mb-6">Compressing your image...</h3>
              <div className="space-y-4">
                {PROCESSING_STEPS.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                      ${index < processingStep ? 'bg-orange-500 text-white' : index === processingStep ? 'bg-orange-500/20 text-orange-500 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                      {index < processingStep ? <Check className="h-4 w-4" /> : index === processingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">{index + 1}</span>}
                    </div>
                    <span className={`text-sm transition-colors ${index <= processingStep ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
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
                  <p className="text-sm font-medium text-muted-foreground mb-2">Original</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={originalPreview} alt="Original" className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-2 text-lg font-semibold">{originalSize && formatFileSize(originalSize)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Compressed</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={resultPreview} alt="Compressed" className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-2 text-lg font-semibold text-orange-500">{fileSize && formatFileSize(fileSize)}</p>
                </div>
              </div>

              {getSizeReduction() && Number(getSizeReduction()) > 0 && (
                <div className="mt-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-center">
                  <p className="text-3xl font-bold text-orange-500">-{getSizeReduction()}%</p>
                  <p className="text-sm text-muted-foreground">File size reduced</p>
                </div>
              )}
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
                  <Button onClick={handleDownload} className="bg-orange-500 hover:bg-orange-600">
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
        <Card className="border-red-200 dark:border-red-900 overflow-hidden">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <X className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-red-600 dark:text-red-400">Compression Failed</h3>
              <p className="mt-2 text-muted-foreground max-w-md mx-auto">{error}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>Try Different Image</Button>
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
