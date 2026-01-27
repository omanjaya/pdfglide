'use client';

import { useState } from 'react';
import { Layers, Trash2, Copy } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { organizePdf, deletePdfPages, extractPdfPages, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type Mode = 'reorder' | 'delete' | 'extract';

export default function OrganizePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('reorder');
  const [pageOrder, setPageOrder] = useState<string>('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0 || !pageOrder.trim()) return;

    setStatus('processing');
    setError(null);

    try {
      const pages = pageOrder.split(',').map((p) => parseInt(p.trim()));

      let response: TaskResponse;
      if (mode === 'reorder') {
        response = await organizePdf(files[0], pages);
      } else if (mode === 'delete') {
        response = await deletePdfPages(files[0], pages);
      } else {
        response = await extractPdfPages(files[0], pages);
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
    setMode('reorder');
    setPageOrder('');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const modeOptions = [
    { value: 'reorder', label: 'Reorder', icon: Layers, description: 'Rearrange page order' },
    { value: 'delete', label: 'Delete', icon: Trash2, description: 'Remove specific pages' },
    { value: 'extract', label: 'Extract', icon: Copy, description: 'Extract specific pages' },
  ];

  const getPlaceholder = () => {
    switch (mode) {
      case 'reorder':
        return 'New order: 3,1,2,4 (for a 4-page PDF)';
      case 'delete':
        return 'Pages to delete: 2,4,6';
      case 'extract':
        return 'Pages to extract: 1,3,5';
    }
  };

  const getHelpText = () => {
    switch (mode) {
      case 'reorder':
        return 'Enter the new page order. You can repeat pages to duplicate them.';
      case 'delete':
        return 'Enter the page numbers to remove from the PDF.';
      case 'extract':
        return 'Enter the page numbers to extract into a new PDF.';
    }
  };

  return (
    <ToolLayout
      title="Organize PDF"
      description="Reorder, delete, or extract pages from your PDF"
      icon={Layers}
      color="bg-orange-500"
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
                <label className="text-sm font-medium">Operation</label>
                <div className="grid grid-cols-3 gap-2">
                  {modeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setMode(option.value as Mode)}
                      className={cn(
                        'rounded-lg border p-3 text-left transition-colors',
                        mode === option.value
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Page numbers</label>
                <input
                  type="text"
                  value={pageOrder}
                  onChange={(e) => setPageOrder(e.target.value)}
                  placeholder={getPlaceholder()}
                  className="w-full rounded-md border px-3 py-2"
                />
                <p className="text-xs text-muted-foreground">{getHelpText()}</p>
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!pageOrder.trim()}
                >
                  <Layers className="mr-2 h-5 w-5" />
                  {mode === 'reorder' && 'Reorder Pages'}
                  {mode === 'delete' && 'Delete Pages'}
                  {mode === 'extract' && 'Extract Pages'}
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
