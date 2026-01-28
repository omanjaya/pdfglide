'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PenTool, Upload, FileText, X, Download, RefreshCw, AlertCircle, CheckCircle2, Copy, Loader2, Type, Image, Square, Minus, Highlighter, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PdfVisualEditor } from '@/components/pdf-editor/PdfVisualEditor';
import {
  editPdfCombined,
  EditOperation,
  TaskResponse,
} from '@/lib/api';
import {
  Annotation,
  TextAnnotation,
  ImageAnnotation,
  RectangleAnnotation,
  LineAnnotation,
  HighlightAnnotation,
  CommentAnnotation,
} from '@/types/pdf-editor';

type Status = 'idle' | 'editing' | 'processing' | 'completed' | 'error';

const features = [
  { icon: Type, label: 'Add Text', description: 'Insert text anywhere' },
  { icon: Image, label: 'Add Images', description: 'Place images on pages' },
  { icon: Square, label: 'Shapes', description: 'Draw rectangles' },
  { icon: Minus, label: 'Lines', description: 'Draw lines and arrows' },
  { icon: Highlighter, label: 'Highlight', description: 'Highlight content' },
  { icon: MessageCircle, label: 'Comments', description: 'Add sticky notes' },
];

const processingSteps = [
  'Preparing changes...',
  'Processing annotations...',
  'Applying edits...',
  'Rendering content...',
  'Finalizing PDF...',
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function VisualEditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'processing') {
      const interval = setInterval(() => {
        setProcessingStep((prev) => (prev + 1) % processingSteps.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setStatus('editing');
      setError(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const convertAnnotationsToOperations = useCallback(
    (annotations: Annotation[], imageFiles: File[]): EditOperation[] => {
      const operations: EditOperation[] = [];

      annotations.forEach((ann) => {
        switch (ann.type) {
          case 'text': {
            const textAnn = ann as TextAnnotation;
            operations.push({
              type: 'text',
              text: textAnn.text,
              page: textAnn.page,
              x: textAnn.x,
              y: textAnn.y,
              font_size: textAnn.fontSize,
              font_name: textAnn.fontName,
              color: textAnn.color,
              opacity: textAnn.opacity,
            });
            break;
          }

          case 'image': {
            const imgAnn = ann as ImageAnnotation;
            const imageIndex = imageFiles.findIndex(
              (f) => f === imgAnn.imageFile
            );
            if (imageIndex >= 0) {
              operations.push({
                type: 'image',
                image_index: imageIndex,
                page: imgAnn.page,
                x: imgAnn.x,
                y: imgAnn.y,
                width: imgAnn.width,
                height: imgAnn.height,
                opacity: imgAnn.opacity,
                rotation: imgAnn.rotation,
              });
            }
            break;
          }

          case 'rectangle': {
            const rectAnn = ann as RectangleAnnotation;
            operations.push({
              type: 'rectangle',
              page: rectAnn.page,
              x: rectAnn.x,
              y: rectAnn.y,
              width: rectAnn.width,
              height: rectAnn.height,
              stroke_color: rectAnn.strokeColor || undefined,
              fill_color: rectAnn.fillColor || undefined,
              stroke_width: rectAnn.strokeWidth,
              opacity: rectAnn.opacity,
            });
            break;
          }

          case 'line': {
            const lineAnn = ann as LineAnnotation;
            operations.push({
              type: 'line',
              page: lineAnn.page,
              x1: lineAnn.x,
              y1: lineAnn.y,
              x2: lineAnn.x2,
              y2: lineAnn.y2,
              color: lineAnn.color,
              width: lineAnn.width,
              opacity: lineAnn.opacity,
            });
            break;
          }

          case 'highlight': {
            const hlAnn = ann as HighlightAnnotation;
            operations.push({
              type: 'highlight',
              page: hlAnn.page,
              x: hlAnn.x,
              y: hlAnn.y,
              width: hlAnn.width,
              height: hlAnn.height,
              color: hlAnn.color,
              opacity: hlAnn.opacity,
            });
            break;
          }

          case 'comment': {
            const cmtAnn = ann as CommentAnnotation;
            operations.push({
              type: 'comment',
              page: cmtAnn.page,
              x: cmtAnn.x,
              y: cmtAnn.y,
              content: cmtAnn.content,
              author: cmtAnn.author,
              icon: cmtAnn.icon,
            });
            break;
          }
        }
      });

      return operations;
    },
    []
  );

  const handleSave = async (annotations: Annotation[], imageFiles: File[]) => {
    if (!file || annotations.length === 0) return;

    setStatus('processing');
    setProcessingStep(0);
    setError(null);

    try {
      const operations = convertAnnotationsToOperations(annotations, imageFiles);

      const response = await editPdfCombined(
        file,
        operations,
        imageFiles.length > 0 ? imageFiles : undefined
      );

      if (response.success) {
        setResult(response.data);
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

  const handleCancel = () => {
    setFile(null);
    setStatus('idle');
  };

  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    setResult(null);
    setError(null);
    setProcessingStep(0);
  };

  const copyToClipboard = async () => {
    if (result?.download_url) {
      await navigator.clipboard.writeText(result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-100">
      {/* Header - Only show when not editing */}
      {status !== 'editing' && (
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 text-white">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
              <PenTool className="h-10 w-10" />
            </div>
            <h1 className="mb-3 text-4xl font-bold">Visual PDF Editor</h1>
            <p className="text-lg text-indigo-100">
              Add text, images, shapes, and annotations to your PDF visually
            </p>
          </div>
        </div>
      )}

      <div className={status === 'editing' ? '' : 'mx-auto max-w-4xl px-4 py-8'}>
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <div className="space-y-6">
            <Card className="border-2 border-dashed border-indigo-200 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <div
                  className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div className="mb-4 inline-flex rounded-full bg-indigo-100 p-4">
                    <Upload className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-gray-800">
                    Drop your PDF here
                  </h3>
                  <p className="mb-4 text-gray-500">or click to browse</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-indigo-700 hover:to-blue-700 hover:shadow-xl"
                  >
                    Select PDF File
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Visual Editing Features</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div key={feature.label} className="flex items-start gap-3">
                        <div className="rounded-lg bg-indigo-100 p-2">
                          <Icon className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{feature.label}</p>
                          <p className="text-sm text-gray-500">{feature.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Editing State - Visual Editor */}
        {status === 'editing' && file && (
          <div className="h-screen">
            <PdfVisualEditor
              file={file}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-indigo-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Applying Edits...</h3>
              <p className="mb-6 text-gray-500">{processingSteps[processingStep]}</p>
              <div className="mx-auto flex max-w-md justify-center gap-2">
                {processingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-full rounded-full transition-all ${
                      index <= processingStep ? 'bg-indigo-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed State */}
        {status === 'completed' && result && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-8">
              <div className="mb-6 text-center">
                <div className="mb-4 inline-flex rounded-full bg-green-100 p-4">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Edits Applied!</h3>
                <p className="text-gray-500">Your annotations have been added to the PDF</p>
              </div>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-indigo-600" />
                    <div>
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                    <PenTool className="h-4 w-4" />
                    Edited
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={result.download_url}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 font-medium text-white shadow-lg transition-all hover:from-indigo-700 hover:to-blue-700"
                >
                  <Download className="h-5 w-5" />
                  Download PDF
                </a>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-all hover:bg-gray-50"
                >
                  {copied ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <button
                onClick={handleReset}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-gray-600 transition-all hover:bg-gray-100"
              >
                <RefreshCw className="h-5 w-5" />
                Edit Another PDF
              </button>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === 'error' && (
          <Card className="border-red-200 bg-white shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="mb-4 inline-flex rounded-full bg-red-100 p-4">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Processing Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => setStatus('editing')}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
                >
                  <RefreshCw className="h-5 w-5" />
                  Try Again
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Start Over
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
