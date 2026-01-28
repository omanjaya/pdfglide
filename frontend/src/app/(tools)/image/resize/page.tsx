'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Maximize2,
  Download,
  RefreshCw,
  Upload,
  Check,
  ImageIcon,
  X,
  ArrowRight,
  Loader2,
  Link,
  Unlink,
  Smartphone,
  Monitor,
  Square,
  RectangleHorizontal,
} from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { api, getDownloadUrl } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const SIZE_PRESETS = [
  { label: 'Instagram', width: 1080, height: 1080, icon: Square },
  { label: 'Facebook', width: 1200, height: 630, icon: RectangleHorizontal },
  { label: 'Twitter', width: 1600, height: 900, icon: RectangleHorizontal },
  { label: 'HD', width: 1920, height: 1080, icon: Monitor },
  { label: '4K', width: 3840, height: 2160, icon: Monitor },
  { label: 'Mobile', width: 375, height: 812, icon: Smartphone },
];

const PROCESSING_STEPS = [
  { label: 'Loading image' },
  { label: 'Calculating dimensions' },
  { label: 'Resizing' },
  { label: 'Finalizing' },
];

export default function ResizeImagePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [resultPreview, setResultPreview] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [newDimensions, setNewDimensions] = useState<{ width: number; height: number } | null>(null);

  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [maintainRatio, setMaintainRatio] = useState(true);
  const [processingStep, setProcessingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      setOriginalPreview(url);
      setStatus('preview');

      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
        setWidth(img.width.toString());
        setHeight(img.height.toString());
      };
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
      }, 600);
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleWidthChange = (value: string) => {
    setWidth(value);
    if (maintainRatio && imageDimensions && value) {
      const ratio = imageDimensions.height / imageDimensions.width;
      setHeight(Math.round(Number(value) * ratio).toString());
    }
  };

  const handleHeightChange = (value: string) => {
    setHeight(value);
    if (maintainRatio && imageDimensions && value) {
      const ratio = imageDimensions.width / imageDimensions.height;
      setWidth(Math.round(Number(value) * ratio).toString());
    }
  };

  const applyPreset = (preset: typeof SIZE_PRESETS[0]) => {
    setWidth(preset.width.toString());
    setHeight(preset.height.toString());
    setMaintainRatio(false);
  };

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
    if (files.length === 0 || (!width && !height)) return;
    setStatus('processing');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', files[0]);
      if (width) formData.append('width', width);
      if (height) formData.append('height', height);
      formData.append('maintain_ratio', maintainRatio.toString());

      const response = await api.post('/image/resize', formData);

      if (response.data.success) {
        const data = response.data.data;
        setDownloadUrl(data.download_url);
        setFileName(data.file_name);
        setFileSize(data.file_size);
        setResultPreview(getDownloadUrl(data.download_url));
        setNewDimensions({ width: Number(width), height: Number(height) });
        setStatus('completed');
      } else {
        setError(response.data.error || 'Resize failed');
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
    setImageDimensions(null);
    setNewDimensions(null);
    setWidth('');
    setHeight('');
    setError(null);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = getDownloadUrl(downloadUrl);
      link.download = fileName || 'resized.jpg';
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
      title="Resize Image"
      description="Change image dimensions to any size you need"
      icon={Maximize2}
      color="bg-gradient-to-br from-purple-500 to-pink-500"
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
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 scale-[1.02]'
                : 'border-border hover:border-purple-400 hover:bg-muted/50'}
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
              <div className={`mb-4 rounded-full p-4 transition-all duration-300 ${isDragOver ? 'bg-purple-500 text-white scale-110' : 'bg-muted'}`}>
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

          <div className="space-y-3">
            <p className="text-sm font-medium text-center text-muted-foreground">Popular sizes</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SIZE_PRESETS.map((preset) => (
                <div key={preset.label} className="flex flex-col items-center p-3 rounded-xl bg-muted/50 text-center">
                  <preset.icon className="h-5 w-5 text-purple-500 mb-1" />
                  <p className="text-xs font-medium">{preset.label}</p>
                  <p className="text-[10px] text-muted-foreground">{preset.width}×{preset.height}</p>
                </div>
              ))}
            </div>
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
                    <p className="text-sm text-muted-foreground">Set new dimensions</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Dimension inputs */}
                <div className="space-y-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Width (px)</Label>
                      <Input
                        type="number"
                        value={width}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        min="1"
                        max="10000"
                        className="h-12 text-lg font-mono"
                      />
                    </div>
                    <button
                      onClick={() => setMaintainRatio(!maintainRatio)}
                      className={`h-12 w-12 rounded-lg border-2 flex items-center justify-center transition-all
                        ${maintainRatio ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-500' : 'border-border text-muted-foreground'}`}
                      title={maintainRatio ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
                    >
                      {maintainRatio ? <Link className="h-5 w-5" /> : <Unlink className="h-5 w-5" />}
                    </button>
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Height (px)</Label>
                      <Input
                        type="number"
                        value={height}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        min="1"
                        max="10000"
                        className="h-12 text-lg font-mono"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    {maintainRatio ? 'Aspect ratio will be maintained' : 'Free resize mode'}
                  </p>
                </div>

                {/* Presets */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick presets</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {SIZE_PRESETS.slice(0, 6).map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset)}
                        className="p-2 rounded-lg border text-xs hover:bg-muted transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button size="lg" onClick={handleProcess} disabled={!width && !height} className="w-full h-12 text-base bg-purple-500 hover:bg-purple-600">
                  <Maximize2 className="mr-2 h-5 w-5" />
                  Resize to {width}×{height}
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
                    <Maximize2 className="absolute inset-0 m-auto h-8 w-8" />
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-6 flex flex-col justify-center">
              <h3 className="text-xl font-semibold mb-6">Resizing your image...</h3>
              <div className="space-y-4">
                {PROCESSING_STEPS.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
                      ${index < processingStep ? 'bg-purple-500 text-white' : index === processingStep ? 'bg-purple-500/20 text-purple-500 animate-pulse' : 'bg-muted text-muted-foreground'}`}>
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
                  <p className="text-sm font-medium text-muted-foreground mb-2">Original</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={originalPreview} alt="Original" className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-2 font-mono text-sm">{imageDimensions?.width} × {imageDimensions?.height}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Resized</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={resultPreview} alt="Resized" className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-2 font-mono text-sm text-purple-500">{newDimensions?.width} × {newDimensions?.height}</p>
                </div>
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
                  <Button onClick={handleDownload} className="bg-purple-500 hover:bg-purple-600">
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
