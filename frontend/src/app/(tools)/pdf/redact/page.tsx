'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { EyeOff, Upload, FileText, X, Plus, Download, RefreshCw, AlertCircle, CheckCircle2, Copy, Loader2, Mail, Phone, CreditCard, Hash, Code } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { redactPdf, redactPdfPatterns, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';
type RedactMode = 'terms' | 'patterns';
type PatternType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'custom';

const patternOptions: { value: PatternType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'email', label: 'Email Addresses', description: 'user@example.com', icon: Mail },
  { value: 'phone', label: 'Phone Numbers', description: '+1-234-567-8900', icon: Phone },
  { value: 'ssn', label: 'SSN', description: 'XXX-XX-XXXX', icon: Hash },
  { value: 'credit_card', label: 'Credit Cards', description: '1234-5678-9012-3456', icon: CreditCard },
];

const processingSteps = [
  'Analyzing document...',
  'Scanning for matches...',
  'Applying redactions...',
  'Removing sensitive data...',
  'Finalizing document...',
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function RedactPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RedactMode>('terms');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState('');
  const [selectedPatterns, setSelectedPatterns] = useState<PatternType[]>([]);
  const [customPattern, setCustomPattern] = useState('');
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
      setStatus('preview');
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
    if (!file) return;

    setStatus('processing');
    setProcessingStep(0);
    setError(null);

    try {
      let response: TaskResponse;

      if (mode === 'terms') {
        if (searchTerms.length === 0) {
          setError('Please add at least one search term');
          setStatus('error');
          return;
        }
        response = await redactPdf(file, searchTerms);
      } else {
        if (selectedPatterns.length === 0 && !customPattern) {
          setError('Please select at least one pattern');
          setStatus('error');
          return;
        }
        response = await redactPdfPatterns(
          file,
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
    setFile(null);
    setMode('terms');
    setSearchTerms([]);
    setTermInput('');
    setSelectedPatterns([]);
    setCustomPattern('');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-600 via-gray-600 to-zinc-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
            <EyeOff className="h-10 w-10" />
          </div>
          <h1 className="mb-3 text-4xl font-bold">Redact PDF</h1>
          <p className="text-lg text-slate-200">
            Permanently remove sensitive information from PDF documents
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <Card className="border-2 border-dashed border-slate-200 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div
                className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  isDragging
                    ? 'border-slate-500 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/50'
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
                <div className="mb-4 inline-flex rounded-full bg-slate-100 p-4">
                  <Upload className="h-8 w-8 text-slate-600" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-800">
                  Drop your PDF here
                </h3>
                <p className="mb-4 text-slate-500">or click to browse</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-gradient-to-r from-slate-600 to-gray-700 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-slate-700 hover:to-gray-800 hover:shadow-xl"
                >
                  Select PDF File
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview State - File loaded, configure options */}
        {status === 'preview' && file && (
          <div className="space-y-6">
            {/* File Card */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-slate-100 p-3">
                      <FileText className="h-8 w-8 text-slate-600" />
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

            {/* Redaction Mode */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <h3 className="mb-4 font-semibold text-gray-900">Redaction Mode</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => setMode('terms')}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      mode === 'terms'
                        ? 'border-slate-500 bg-slate-50 ring-2 ring-slate-200'
                        : 'border-gray-200 hover:border-slate-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <FileText className={`h-5 w-5 ${mode === 'terms' ? 'text-slate-600' : 'text-gray-400'}`} />
                      <span className="font-medium">Search Terms</span>
                    </div>
                    <p className="text-sm text-gray-500">Redact specific words or phrases</p>
                  </button>
                  <button
                    onClick={() => setMode('patterns')}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      mode === 'patterns'
                        ? 'border-slate-500 bg-slate-50 ring-2 ring-slate-200'
                        : 'border-gray-200 hover:border-slate-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Code className={`h-5 w-5 ${mode === 'patterns' ? 'text-slate-600' : 'text-gray-400'}`} />
                      <span className="font-medium">Patterns</span>
                    </div>
                    <p className="text-sm text-gray-500">Redact emails, phones, SSNs, etc.</p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Terms Mode Options */}
            {mode === 'terms' && (
              <Card className="bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-gray-900">Search Terms to Redact</h3>
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={termInput}
                      onChange={(e) => setTermInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSearchTerm()}
                      placeholder="Enter text to redact..."
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                    <button
                      onClick={addSearchTerm}
                      className="rounded-lg bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  {searchTerms.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {searchTerms.map((term) => (
                        <span
                          key={term}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                          <span className="max-w-[150px] truncate">{term}</span>
                          <button
                            onClick={() => removeSearchTerm(term)}
                            className="rounded-full p-0.5 hover:bg-slate-200"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Add terms that will be blacked out in the PDF</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Patterns Mode Options */}
            {mode === 'patterns' && (
              <Card className="bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-gray-900">Select Patterns to Redact</h3>
                  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {patternOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => togglePattern(option.value)}
                          className={`rounded-xl border-2 p-4 text-left transition-all ${
                            selectedPatterns.includes(option.value)
                              ? 'border-slate-500 bg-slate-50 ring-2 ring-slate-200'
                              : 'border-gray-200 hover:border-slate-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${selectedPatterns.includes(option.value) ? 'text-slate-600' : 'text-gray-400'}`} />
                            <span className="font-medium">{option.label}</span>
                          </div>
                          <p className="text-sm text-gray-500">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Custom Regex (optional)</label>
                    <input
                      type="text"
                      value={customPattern}
                      onChange={(e) => setCustomPattern(e.target.value)}
                      placeholder="e.g., \d{3}-\d{2}-\d{4}"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Warning */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Permanent Redaction</p>
                  <p className="text-sm text-amber-700">Redacted content cannot be recovered. The original text is permanently removed from the PDF.</p>
                </div>
              </div>
            </div>

            {/* Process Button */}
            <button
              onClick={handleProcess}
              disabled={(mode === 'terms' && searchTerms.length === 0) || (mode === 'patterns' && selectedPatterns.length === 0 && !customPattern)}
              className="w-full rounded-xl bg-gradient-to-r from-slate-600 to-gray-700 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-slate-700 hover:to-gray-800 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              <EyeOff className="mr-2 inline-block h-5 w-5" />
              Redact PDF
            </button>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-slate-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-slate-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Redacting PDF...</h3>
              <p className="mb-6 text-gray-500">{processingSteps[processingStep]}</p>
              <div className="mx-auto flex max-w-md justify-center gap-2">
                {processingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-full rounded-full transition-all ${
                      index <= processingStep ? 'bg-slate-500' : 'bg-gray-200'
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
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Redaction Complete!</h3>
                <p className="text-gray-500">Sensitive information has been permanently removed</p>
              </div>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-slate-600" />
                    <div>
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <EyeOff className="h-4 w-4" />
                    <span>Redacted</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={result.download_url}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-600 to-gray-700 py-3 font-medium text-white shadow-lg transition-all hover:from-slate-700 hover:to-gray-800"
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
                Redact Another PDF
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
                  onClick={handleProcess}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-600 px-6 py-3 font-medium text-white hover:bg-slate-700"
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
