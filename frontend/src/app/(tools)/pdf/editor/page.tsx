'use client';

import { useState } from 'react';
import { Edit3, Type, Image, MessageSquare } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { addTextToPdf, addImageToPdf, addCommentToPdf, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type EditMode = 'text' | 'image' | 'comment';

export default function PdfEditorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('text');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
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
          response = await addTextToPdf(files[0], text, page, x, y, { fontSize });
          break;
        case 'image':
          if (!imageFile) {
            setError('Please select an image to add');
            setStatus('error');
            return;
          }
          response = await addImageToPdf(files[0], imageFile, page, x, y, {
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
            files[0],
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
    setFiles([]);
    setImageFile(null);
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
  };

  return (
    <ToolLayout
      title="PDF Editor"
      description="Add text, images, and comments to your PDF documents"
      icon={Edit3}
      color="bg-purple-500"
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Edit Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setEditMode('text')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 transition-colors',
                      editMode === 'text'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Type className="h-5 w-5" />
                    <span className="font-medium">Add Text</span>
                  </button>
                  <button
                    onClick={() => setEditMode('image')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 transition-colors',
                      editMode === 'image'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Image className="h-5 w-5" />
                    <span className="font-medium">Add Image</span>
                  </button>
                  <button
                    onClick={() => setEditMode('comment')}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 transition-colors',
                      editMode === 'comment'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">Add Comment</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Page Number</label>
                  <input
                    type="number"
                    min={1}
                    value={page}
                    onChange={(e) => setPage(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">X Position</label>
                  <input
                    type="number"
                    min={0}
                    value={x}
                    onChange={(e) => setX(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Y Position</label>
                  <input
                    type="number"
                    min={0}
                    value={y}
                    onChange={(e) => setY(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {editMode === 'text' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Text</label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Enter text to add..."
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Font Size: {fontSize}px</label>
                    <input
                      type="range"
                      min={8}
                      max={72}
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {editMode === 'image' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    {imageFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {imageFile.name}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Width (optional)</label>
                      <input
                        type="number"
                        min={1}
                        value={imageWidth || ''}
                        onChange={(e) =>
                          setImageWidth(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        placeholder="Auto"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Height (optional)</label>
                      <input
                        type="number"
                        min={1}
                        value={imageHeight || ''}
                        onChange={(e) =>
                          setImageHeight(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        placeholder="Auto"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {editMode === 'comment' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Comment</label>
                    <textarea
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      placeholder="Enter your comment..."
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Author (optional)</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <Edit3 className="mr-2 h-5 w-5" />
                  Apply Edit
                </Button>
              </div>
            </>
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
