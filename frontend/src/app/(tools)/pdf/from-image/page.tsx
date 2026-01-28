'use client';

import { useState, useCallback, useRef } from 'react';
import {
  ImageIcon,
  Upload,
  FileText,
  X,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  GripVertical,
  Trash2,
  Image,
  Layers
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { imageToPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PROCESSING_STEPS = [
  'Reading images...',
  'Processing image data...',
  'Creating PDF pages...',
  'Optimizing output...',
  'Generating PDF...',
];

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ImageToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidImageType = (file: File) => {
    return Object.keys(ACCEPTED_TYPES).includes(file.type);
  };

  const handleFilesSelect = useCallback((selectedFiles: File[]) => {
    const validFiles = selectedFiles.filter(isValidImageType);
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles].slice(0, 20));

      // Create previews
      validFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => [...prev, e.target?.result as string].slice(0, 20));
        };
        reader.readAsDataURL(file);
      });

      setStatus('preview');
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFilesSelect(droppedFiles);
  }, [handleFilesSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setStatus('idle');
    }
  };

  const moveFile = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= files.length) return;

    const newFiles = [...files];
    const newPreviews = [...previews];

    const [fileToMove] = newFiles.splice(fromIndex, 1);
    const [previewToMove] = newPreviews.splice(fromIndex, 1);

    newFiles.splice(toIndex, 0, fileToMove);
    newPreviews.splice(toIndex, 0, previewToMove);

    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep((prev) =>
        prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev
      );
    }, 800);

    try {
      const response = await imageToPdf(files);
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
    setFiles([]);
    setPreviews([]);
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

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-fuchsia-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <ImageIcon className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-center mb-2">Image to PDF</h1>
          <p className="text-center text-pink-100 max-w-2xl mx-auto">
            Convert multiple images into a single PDF document
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
                    ? 'border-pink-500 bg-pink-50 scale-[1.02]'
                    : 'border-gray-200 hover:border-pink-400 hover:bg-pink-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  multiple
                  onChange={(e) => e.target.files && handleFilesSelect(Array.from(e.target.files))}
                  className="hidden"
                />
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
                  isDragging ? 'bg-pink-500 scale-110' : 'bg-gradient-to-br from-pink-500 to-fuchsia-600'
                }`}>
                  <Image className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragging ? 'Drop your images here' : 'Upload images'}
                </h3>
                <p className="text-gray-500 mb-4">Drag & drop or click to select</p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Upload className="h-4 w-4" />
                  <span>JPG, PNG, WebP, GIF • Max 20 images</span>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-pink-50">
                  <Layers className="h-5 w-5 text-pink-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Multiple Images</p>
                    <p className="text-xs text-gray-500">Up to 20 images</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-fuchsia-50">
                  <GripVertical className="h-5 w-5 text-fuchsia-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-800 text-sm">Reorder Pages</p>
                    <p className="text-xs text-gray-500">Drag to arrange</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State */}
        {status === 'preview' && files.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <Card className="shadow-xl border-0">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {files.length} Image{files.length > 1 ? 's' : ''} Selected
                    </h3>
                    <p className="text-sm text-gray-500">
                      Total size: {formatFileSize(totalSize)} • Each image becomes a page
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-pink-600 border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors text-sm font-medium"
                  >
                    Add More
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif"
                    multiple
                    onChange={(e) => e.target.files && handleFilesSelect(Array.from(e.target.files))}
                    className="hidden"
                  />
                </div>

                {/* Image Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="relative group bg-gray-50 rounded-xl overflow-hidden aspect-[3/4] border-2 border-gray-100 hover:border-pink-300 transition-colors"
                    >
                      {/* Page number badge */}
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-pink-500 text-white text-xs font-medium rounded-full">
                        {index + 1}
                      </div>

                      {/* Image preview */}
                      {previews[index] && (
                        <img
                          src={previews[index]}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {/* Move buttons */}
                        <button
                          onClick={() => moveFile(index, index - 1)}
                          disabled={index === 0}
                          className={`p-2 rounded-lg bg-white/90 ${
                            index === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'
                          }`}
                        >
                          <span className="text-lg">←</span>
                        </button>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveFile(index, index + 1)}
                          disabled={index === files.length - 1}
                          className={`p-2 rounded-lg bg-white/90 ${
                            index === files.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'
                          }`}
                        >
                          <span className="text-lg">→</span>
                        </button>
                      </div>

                      {/* File name */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-white text-xs truncate">{file.name}</p>
                        <p className="text-white/70 text-xs">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleProcess}
                    className="px-8 py-4 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white rounded-xl font-semibold hover:from-pink-700 hover:to-fuchsia-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-3"
                  >
                    <FileText className="h-5 w-5" />
                    Convert to PDF
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
                <div className="absolute inset-0 rounded-full border-4 border-pink-100"></div>
                <div className="absolute inset-0 rounded-full border-4 border-pink-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-pink-500" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Converting Images...</h3>
              <p className="text-gray-500 mb-6">Processing {files.length} image{files.length > 1 ? 's' : ''}</p>

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
                      <CheckCircle2 className="h-5 w-5 text-pink-500 flex-shrink-0" />
                    ) : index === processingStep ? (
                      <div className="h-5 w-5 rounded-full border-2 border-pink-500 border-t-transparent animate-spin flex-shrink-0" />
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
            <div className="bg-gradient-to-r from-pink-500 to-fuchsia-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold">PDF Created!</h3>
              <p className="text-pink-100 mt-1">{files.length} images converted to PDF</p>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-6 w-6 text-pink-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                  <Layers className="h-6 w-6 text-pink-500" />
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={result.download_url}
                  download
                  className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white rounded-xl font-semibold hover:from-pink-700 hover:to-fuchsia-700 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="h-5 w-5" />
                  Download
                </a>
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-pink-500" />
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
                Convert More Images
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
              <h3 className="text-2xl font-bold">Conversion Failed</h3>
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
