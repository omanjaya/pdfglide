'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Edit3, Upload, FileText, X, Download, RefreshCw, AlertCircle, CheckCircle2, Copy, Loader2, Type, Image, MessageSquare, Move } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { addTextToPdf, addImageToPdf, addCommentToPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type EditMode = 'text' | 'image' | 'comment';

const editModes = [
  { value: 'text' as EditMode, label: 'Add Text', icon: Type, description: 'Insert text at any position' },
  { value: 'image' as EditMode, label: 'Add Image', icon: Image, description: 'Place images on pages' },
  { value: 'comment' as EditMode, label: 'Add Comment', icon: MessageSquare, description: 'Annotate with notes' },
];

const processingSteps = [
  'Analyzing document...',
  'Preparing changes...',
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

export default function PdfEditorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('text');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Text options
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(12);
  const [page, setPage] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);

  // Comment options
  const [commentContent, setCommentContent] = useState('');
  const [author, setAuthor] = useState('');

  // Image options
  const [imageWidth, setImageWidth] = useState<number | undefined>();
  const [imageHeight, setImageHeight] = useState<number | undefined>();

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
      setStatus('preview');
      setError(null);
    }
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setImageFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

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

  const handleProcess = async () => {
    if (!file) return;

    setStatus('processing');
    setProcessingStep(0);
    setError(null);

    try {
      let response: TaskResponse;

      switch (editMode) {
        case 'text':
          if (!text.trim()) {
            setError('Please enter text to add');
            setStatus('error');
            return;
          }
          response = await addTextToPdf(file, text, page, x, y, { fontSize });
          break;
        case 'image':
          if (!imageFile) {
            setError('Please select an image to add');
            setStatus('error');
            return;
          }
          response = await addImageToPdf(file, imageFile, page, x, y, {
            width: imageWidth,
            height: imageHeight,
          });
          break;
        case 'comment':
          if (!commentContent.trim()) {
            setError('Please enter comment content');
            setStatus('error');
            return;
          }
          response = await addCommentToPdf(
            file,
            page,
            x,
            y,
            commentContent,
            author || undefined
          );
          break;
        default:
          setError('Invalid edit mode');
          setStatus('error');
          return;
      }

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

  const handleReset = () => {
    setFile(null);
    setImageFile(null);
    setImagePreview(null);
    setEditMode('text');
    setText('');
    setFontSize(12);
    setPage(1);
    setX(50);
    setY(50);
    setCommentContent('');
    setAuthor('');
    setImageWidth(undefined);
    setImageHeight(undefined);
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
            <Edit3 className="h-10 w-10" />
          </div>
          <h1 className="mb-3 text-4xl font-bold">PDF Editor</h1>
          <p className="text-lg text-purple-100">
            Add text, images, and comments to your PDF documents
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <Card className="border-2 border-dashed border-purple-200 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div
                className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  isDragging
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50/50'
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
                <div className="mb-4 inline-flex rounded-full bg-purple-100 p-4">
                  <Upload className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-800">
                  Drop your PDF here
                </h3>
                <p className="mb-4 text-gray-500">or click to browse</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-purple-700 hover:to-fuchsia-700 hover:shadow-xl"
                >
                  Select PDF File
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State - File loaded, configure edit */}
        {status === 'preview' && file && (
          <div className="space-y-6">
            {/* File Card */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-purple-100 p-3">
                      <FileText className="h-8 w-8 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Edit Mode Selection */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Edit Type</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {editModes.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setEditMode(mode.value)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          editMode === mode.value
                            ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${editMode === mode.value ? 'text-purple-600' : 'text-gray-400'}`} />
                          <span className="font-medium">{mode.label}</span>
                        </div>
                        <p className="text-sm text-gray-500">{mode.description}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Position Settings */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Move className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Position</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Page</label>
                    <input
                      type="number"
                      min={1}
                      value={page}
                      onChange={(e) => setPage(parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">X Position</label>
                    <input
                      type="number"
                      min={0}
                      value={x}
                      onChange={(e) => setX(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Y Position</label>
                    <input
                      type="number"
                      min={0}
                      value={y}
                      onChange={(e) => setY(parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Text Mode Options */}
            {editMode === 'text' && (
              <Card className="bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-gray-900">Text Content</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Text</label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter text to add..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Font Size: <span className="text-purple-600">{fontSize}px</span>
                      </label>
                      <input
                        type="range"
                        min={8}
                        max={72}
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="w-full accent-purple-600"
                      />
                      <div className="mt-1 flex justify-between text-xs text-gray-400">
                        <span>8px</span>
                        <span>72px</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Image Mode Options */}
            {editMode === 'image' && (
              <Card className="bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-gray-900">Image Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Select Image</label>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      {imagePreview ? (
                        <div className="relative rounded-lg border border-gray-200 p-4">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="mx-auto max-h-32 rounded"
                          />
                          <button
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            className="absolute right-2 top-2 rounded-full bg-gray-100 p-1 hover:bg-gray-200"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => imageInputRef.current?.click()}
                          className="w-full rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-purple-400 hover:bg-purple-50"
                        >
                          <Image className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                          <span className="text-sm text-gray-500">Click to select an image</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Width (optional)</label>
                        <input
                          type="number"
                          min={1}
                          value={imageWidth || ''}
                          onChange={(e) => setImageWidth(e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="Auto"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Height (optional)</label>
                        <input
                          type="number"
                          min={1}
                          value={imageHeight || ''}
                          onChange={(e) => setImageHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="Auto"
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comment Mode Options */}
            {editMode === 'comment' && (
              <Card className="bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-gray-900">Comment Content</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Comment</label>
                      <textarea
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="Enter your comment..."
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Author (optional)</label>
                      <input
                        type="text"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        placeholder="Your name"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Process Button */}
            <button
              onClick={handleProcess}
              disabled={
                (editMode === 'text' && !text.trim()) ||
                (editMode === 'image' && !imageFile) ||
                (editMode === 'comment' && !commentContent.trim())
              }
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-purple-700 hover:to-fuchsia-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Edit3 className="mr-2 inline-block h-5 w-5" />
              Apply Edit
            </button>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-purple-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Editing PDF...</h3>
              <p className="mb-6 text-gray-500">{processingSteps[processingStep]}</p>
              <div className="mx-auto flex max-w-md justify-center gap-2">
                {processingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-full rounded-full transition-all ${
                      index <= processingStep ? 'bg-purple-500' : 'bg-gray-200'
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
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Edit Complete!</h3>
                <p className="text-gray-500">Your changes have been applied to the PDF</p>
              </div>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                    <Edit3 className="h-4 w-4" />
                    Edited
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={result.download_url}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 py-3 font-medium text-white shadow-lg transition-all hover:from-purple-700 hover:to-fuchsia-700"
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
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Edit Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={handleProcess}
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white hover:bg-purple-700"
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
