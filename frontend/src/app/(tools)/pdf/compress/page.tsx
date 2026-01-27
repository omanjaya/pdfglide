'use client';

import { useState } from 'react';
import { Minimize2, ChevronDown, ChevronUp, Settings, Target } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { compressPdf, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
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

const qualityOptions: { value: Quality; label: string; description: string; dpi: string }[] = [
  { value: 'extreme', label: 'Extreme', description: 'Smallest file size', dpi: '72 DPI' },
  { value: 'low', label: 'Low', description: 'Good for web/email', dpi: '150 DPI' },
  { value: 'medium', label: 'Medium', description: 'Balanced quality', dpi: '300 DPI' },
  { value: 'high', label: 'High', description: 'Best quality', dpi: '300 DPI' },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function CompressPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<CompressionMode>('quality');
  const [quality, setQuality] = useState<Quality>('medium');
  const [targetSize, setTargetSize] = useState<number>(500);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('KB');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compressImages, setCompressImages] = useState(true);
  const [customDpi, setCustomDpi] = useState<number | null>(null);
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [grayscale, setGrayscale] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [compressionStats, setCompressionStats] = useState<CompressionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getTargetSizeKb = (): number | null => {
    if (mode !== 'target') return null;
    return sizeUnit === 'MB' ? targetSize * 1024 : targetSize;
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);
    setCompressionStats(null);

    try {
      const response = await compressPdf(files[0], {
        quality,
        compress_images: compressImages,
        image_dpi: customDpi,
        remove_metadata: removeMetadata,
        grayscale,
        target_size_kb: getTargetSizeKb(),
      });
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
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setMode('quality');
    setQuality('medium');
    setTargetSize(500);
    setSizeUnit('KB');
    setShowAdvanced(false);
    setCompressImages(true);
    setCustomDpi(null);
    setRemoveMetadata(false);
    setGrayscale(false);
    setStatus('idle');
    setResult(null);
    setCompressionStats(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Compress PDF"
      description="Reduce PDF file size with advanced optimization"
      icon={Minimize2}
      color="bg-red-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />

          {files.length > 0 && (
            <>
              {/* Compression Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Compression Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('quality')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-left transition-colors',
                      mode === 'quality'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Minimize2 className="h-5 w-5" />
                    <div>
                      <div className="font-medium">Quality Preset</div>
                      <div className="text-xs text-muted-foreground">
                        Choose compression level
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('target')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-left transition-colors',
                      mode === 'target'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Target className="h-5 w-5" />
                    <div>
                      <div className="font-medium">Target Size</div>
                      <div className="text-xs text-muted-foreground">
                        Set desired file size
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quality Selection (Quality Mode) */}
              {mode === 'quality' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Compression Level</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {qualityOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setQuality(option.value)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          quality === option.value
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                        <div className="mt-1 text-xs text-primary/70">
                          {option.dpi}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Size Input (Target Mode) */}
              {mode === 'target' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                    <div className="mb-3 flex items-center gap-2 text-blue-700 dark:text-blue-400">
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
                        className="w-full flex-1 rounded-lg border px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex rounded-lg border">
                        <button
                          onClick={() => setSizeUnit('KB')}
                          className={cn(
                            'px-4 py-3 text-sm font-medium transition-colors',
                            sizeUnit === 'KB'
                              ? 'bg-primary text-white'
                              : 'hover:bg-muted'
                          )}
                        >
                          KB
                        </button>
                        <button
                          onClick={() => setSizeUnit('MB')}
                          className={cn(
                            'px-4 py-3 text-sm font-medium transition-colors',
                            sizeUnit === 'MB'
                              ? 'bg-primary text-white'
                              : 'hover:bg-muted'
                          )}
                        >
                          MB
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      System will automatically adjust compression to reach your target size.
                      {files[0] && (
                        <span className="block mt-1">
                          Current file: <strong>{formatFileSize(files[0].size)}</strong>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Advanced Options
                </div>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {/* Advanced Options Panel */}
              {showAdvanced && (
                <div className="space-y-4 rounded-lg border p-4">
                  {/* Compress Images */}
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={compressImages}
                      onChange={(e) => setCompressImages(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="text-sm font-medium">Compress Images</div>
                      <div className="text-xs text-muted-foreground">
                        Use Ghostscript for optimal image compression
                      </div>
                    </div>
                  </label>

                  {/* Custom DPI (only in quality mode) */}
                  {mode === 'quality' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Custom Image DPI (optional)</label>
                      <input
                        type="number"
                        min={72}
                        max={600}
                        placeholder="Leave empty to use quality preset"
                        value={customDpi || ''}
                        onChange={(e) => setCustomDpi(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="text-xs text-muted-foreground">
                        72-600 DPI. Lower = smaller file, lower image quality
                      </div>
                    </div>
                  )}

                  {/* Remove Metadata */}
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={removeMetadata}
                      onChange={(e) => setRemoveMetadata(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="text-sm font-medium">Remove Metadata</div>
                      <div className="text-xs text-muted-foreground">
                        Strip document info for additional size reduction
                      </div>
                    </div>
                  </label>

                  {/* Grayscale */}
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={grayscale}
                      onChange={(e) => setGrayscale(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <div className="text-sm font-medium">Convert to Grayscale</div>
                      <div className="text-xs text-muted-foreground">
                        Removes color for significant size reduction
                      </div>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  {mode === 'target' ? (
                    <>
                      <Target className="mr-2 h-5 w-5" />
                      Compress to {targetSize} {sizeUnit}
                    </>
                  ) : (
                    <>
                      <Minimize2 className="mr-2 h-5 w-5" />
                      Compress PDF
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Compression Statistics */}
      {status === 'completed' && compressionStats && (
        <div className={cn(
          "mb-6 rounded-lg border p-4",
          compressionStats.target_reached === false
            ? "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950"
            : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
        )}>
          <h3 className={cn(
            "mb-3 flex items-center gap-2 font-semibold",
            compressionStats.target_reached === false
              ? "text-yellow-700 dark:text-yellow-400"
              : "text-green-700 dark:text-green-400"
          )}>
            <Minimize2 className="h-5 w-5" />
            Compression Results
            {compressionStats.target_size_kb && (
              <span className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-xs",
                compressionStats.target_reached
                  ? "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200"
                  : "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
              )}>
                {compressionStats.target_reached ? 'Target Reached' : 'Target Not Reached'}
              </span>
            )}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
              <div className="text-xs text-muted-foreground">Original Size</div>
              <div className="text-lg font-bold">{formatFileSize(compressionStats.original_size)}</div>
            </div>
            <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
              <div className="text-xs text-muted-foreground">Compressed Size</div>
              <div className="text-lg font-bold text-green-600">{formatFileSize(compressionStats.compressed_size)}</div>
            </div>
            <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
              <div className="text-xs text-muted-foreground">Space Saved</div>
              <div className="text-lg font-bold text-blue-600">{formatFileSize(compressionStats.saved_bytes)}</div>
            </div>
            <div className="rounded-lg bg-white p-3 dark:bg-gray-900">
              <div className="text-xs text-muted-foreground">Reduction</div>
              <div className="text-lg font-bold text-purple-600">{compressionStats.compression_ratio}%</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Method: <span className="font-medium">{compressionStats.method}</span></span>
            {compressionStats.final_dpi && (
              <span>Final DPI: <span className="font-medium">{compressionStats.final_dpi}</span></span>
            )}
            {compressionStats.target_size_kb && (
              <span>Target: <span className="font-medium">{compressionStats.target_size_kb} KB</span></span>
            )}
          </div>
          {compressionStats.message && (
            <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
              {compressionStats.message}
            </p>
          )}
        </div>
      )}

      <ProcessingStatus
        status={status}
        message={error || undefined}
        fileName={result?.file_name}
        fileSize={result?.file_size}
        downloadUrl={result?.download_url}
        onRetry={handleProcess}
        onReset={handleReset}
      />
    </ToolLayout>
  );
}
