'use client';

import { useState } from 'react';
import { EyeOff, X, Plus } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { redactPdf, redactPdfPatterns, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
type RedactMode = 'terms' | 'patterns';

type PatternType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'custom';

const patternOptions: { value: PatternType; label: string; description: string }[] = [
  { value: 'email', label: 'Email Addresses', description: 'user@example.com' },
  { value: 'phone', label: 'Phone Numbers', description: '+1-234-567-8900' },
  { value: 'ssn', label: 'SSN', description: 'XXX-XX-XXXX' },
  { value: 'credit_card', label: 'Credit Cards', description: '1234-5678-9012-3456' },
];

export default function RedactPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<RedactMode>('terms');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<PatternType[]>([]);
  const [customPattern, setCustomPattern] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addSearchTerm = () => {
    if (termInput.trim() && !searchTerms.includes(termInput.trim())) {
      setSearchTerms([...searchTerms, termInput.trim()]);
      setTermInput('');
    }
  };

  const removeSearchTerm = (term: string) => {
    setSearchTerms(searchTerms.filter((t) => t !== term));
  };

  const togglePattern = (pattern: PatternType) => {
    if (selectedPatterns.includes(pattern)) {
      setSelectedPatterns(selectedPatterns.filter((p) => p !== pattern));
    } else {
      setSelectedPatterns([...selectedPatterns, pattern]);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      let response: TaskResponse;

      if (mode === 'terms') {
        if (searchTerms.length === 0) {
          setError('Please add at least one search term');
          setStatus('error');
          return;
        }
        response = await redactPdf(files[0], searchTerms);
      } else {
        if (selectedPatterns.length === 0 && !customPattern) {
          setError('Please select at least one pattern');
          setStatus('error');
          return;
        }
        response = await redactPdfPatterns(
          files[0],
          selectedPatterns,
          customPattern || undefined
        );
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
    setMode('terms');
    setSearchTerms([]);
    setTermInput('');
    setSelectedPatterns([]);
    setCustomPattern('');
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Redact PDF"
      description="Permanently remove sensitive information from PDF documents"
      icon={EyeOff}
      color="bg-gray-700"
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
                <label className="text-sm font-medium">Redaction Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode('terms')}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      mode === 'terms'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="font-medium">Search Terms</div>
                    <div className="text-xs text-muted-foreground">
                      Redact specific words or phrases
                    </div>
                  </button>
                  <button
                    onClick={() => setMode('patterns')}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      mode === 'patterns'
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="font-medium">Patterns</div>
                    <div className="text-xs text-muted-foreground">
                      Redact emails, phones, SSNs, etc.
                    </div>
                  </button>
                </div>
              </div>

              {mode === 'terms' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Search Terms to Redact</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={termInput}
                      onChange={(e) => setTermInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSearchTerm()}
                      placeholder="Enter text to redact..."
                      className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button onClick={addSearchTerm} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {searchTerms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {searchTerms.map((term) => (
                        <span
                          key={term}
                          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                        >
                          {term}
                          <button
                            onClick={() => removeSearchTerm(term)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode === 'patterns' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Patterns to Redact</label>
                  <div className="grid grid-cols-2 gap-2">
                    {patternOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => togglePattern(option.value)}
                        className={cn(
                          'rounded-lg border p-3 text-left transition-colors',
                          selectedPatterns.includes(option.value)
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Custom Regex (optional)</label>
                    <input
                      type="text"
                      value={customPattern}
                      onChange={(e) => setCustomPattern(e.target.value)}
                      placeholder="e.g., \d{3}-\d{2}-\d{4}"
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <Button size="lg" onClick={handleProcess}>
                  <EyeOff className="mr-2 h-5 w-5" />
                  Redact PDF
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
