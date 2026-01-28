'use client';

import { useState, useCallback } from 'react';
import {
  Lock,
  Upload,
  X,
  Download,
  RotateCcw,
  FileText,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  Printer,
  ClipboardCopy,
  Edit3,
  KeyRound
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { protectPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'preview' | 'processing' | 'completed' | 'error';

const PERMISSIONS = [
  { id: 'printing', label: 'Allow Printing', description: 'Users can print the document', icon: Printer },
  { id: 'copying', label: 'Allow Copying', description: 'Users can copy text and images', icon: ClipboardCopy },
  { id: 'modifying', label: 'Allow Modifying', description: 'Users can edit the document', icon: Edit3 },
];

const PROCESSING_STEPS = [
  { id: 1, label: 'Reading PDF', icon: FileText },
  { id: 2, label: 'Applying encryption', icon: Lock },
  { id: 3, label: 'Setting permissions', icon: Shield },
  { id: 4, label: 'Finalizing', icon: Check },
];

export default function ProtectPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [userPassword, setUserPassword] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState<boolean>(true);
  const [allowCopying, setAllowCopying] = useState<boolean>(false);
  const [allowModifying, setAllowModifying] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setStatus('preview');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus('preview');
    }
  }, []);

  const handleProcess = async () => {
    if (!file) return;
    if (!userPassword && !ownerPassword) {
      setError('At least one password is required');
      return;
    }

    setStatus('processing');
    setError(null);
    setProcessingStep(0);

    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev < PROCESSING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 600);

    try {
      const response = await protectPdf(file, {
        userPassword: userPassword || undefined,
        ownerPassword: ownerPassword || undefined,
        allowPrinting,
        allowCopying,
        allowModifying,
      });

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
    setFile(null);
    setUserPassword('');
    setOwnerPassword('');
    setShowUserPassword(false);
    setShowOwnerPassword(false);
    setAllowPrinting(true);
    setAllowCopying(false);
    setAllowModifying(false);
    setStatus('idle');
    setResult(null);
    setError(null);
    setProcessingStep(0);
  };

  const copyDownloadLink = async () => {
    if (result?.download_url) {
      await navigator.clipboard.writeText(result.download_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const hasPassword = userPassword || ownerPassword;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Protect PDF</h1>
          <p className="mt-2 text-gray-600">Add password protection and set permissions</p>
        </div>

        {/* Idle - Upload */}
        {status === 'idle' && (
          <Card className="mx-auto max-w-2xl p-8">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
                isDragging
                  ? 'border-amber-500 bg-amber-50 scale-[1.02]'
                  : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full transition-all duration-300 ${
                isDragging ? 'bg-amber-200 scale-110' : 'bg-amber-100'
              }`}>
                <Upload className={`h-10 w-10 transition-colors ${isDragging ? 'text-amber-600' : 'text-amber-500'}`} />
              </div>
              <p className="text-lg font-medium text-gray-700">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
              </p>
              <p className="mt-2 text-sm text-gray-500">or click to browse</p>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: KeyRound, label: 'Password', desc: 'Secure access' },
                { icon: Shield, label: 'Permissions', desc: 'Control usage' },
                { icon: Lock, label: 'Encryption', desc: '256-bit AES' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="rounded-xl bg-gray-50 p-4 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                      <Icon className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-700">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Preview - Options */}
        {status === 'preview' && file && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* File Preview */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-gray-900">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Selected File
                </h3>
                <button onClick={handleReset} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-amber-50 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100">
                  <FileText className="h-8 w-8 text-amber-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>

              {/* Protection Preview */}
              <div className="mt-6 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-center justify-center gap-3">
                  <Shield className={`h-10 w-10 ${hasPassword ? 'text-amber-500' : 'text-gray-300'}`} />
                  <div className="text-left">
                    <p className={`font-medium ${hasPassword ? 'text-amber-700' : 'text-gray-400'}`}>
                      {hasPassword ? 'Protected' : 'Not Protected'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {userPassword ? 'User password set' : 'No user password'}
                      {ownerPassword ? ' • Owner password set' : ''}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Options */}
            <Card className="p-6">
              <h3 className="mb-6 flex items-center gap-2 font-semibold text-gray-900">
                <Lock className="h-5 w-5 text-amber-500" />
                Protection Settings
              </h3>

              <div className="space-y-5">
                {/* User Password */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Lock className="h-4 w-4" />
                    User Password (to open)
                  </label>
                  <div className="relative">
                    <input
                      type={showUserPassword ? 'text' : 'password'}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Enter password to open PDF"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showUserPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Required to open the PDF</p>
                </div>

                {/* Owner Password */}
                <div>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Shield className="h-4 w-4" />
                    Owner Password (full access)
                  </label>
                  <div className="relative">
                    <input
                      type={showOwnerPassword ? 'text' : 'password'}
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Enter owner password"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showOwnerPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Required for full access and changing permissions</p>
                </div>

                {/* Permissions */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">Permissions</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={allowPrinting}
                        onChange={(e) => setAllowPrinting(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <Printer className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Allow Printing</p>
                        <p className="text-xs text-gray-500">Users can print the document</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={allowCopying}
                        onChange={(e) => setAllowCopying(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <ClipboardCopy className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Allow Copying</p>
                        <p className="text-xs text-gray-500">Users can copy text and images</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={allowModifying}
                        onChange={(e) => setAllowModifying(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <Edit3 className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">Allow Modifying</p>
                        <p className="text-xs text-gray-500">Users can edit the document</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!hasPassword}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                >
                  <Lock className="mr-2 h-5 w-5" />
                  Protect PDF
                </Button>

                {!hasPassword && (
                  <p className="text-center text-sm text-amber-600">
                    Please set at least one password
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-orange-100">
                <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Protecting PDF</h3>
              <p className="mb-8 text-gray-500">Applying password and permissions</p>

              <div className="space-y-3">
                {PROCESSING_STEPS.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === processingStep;
                  const isCompleted = index < processingStep;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
                        isActive ? 'bg-amber-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        isActive ? 'bg-amber-500 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StepIcon className="h-4 w-4" />
                        )}
                      </div>
                      <span className={`text-sm font-medium ${
                        isActive ? 'text-amber-700' : isCompleted ? 'text-green-700' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Completed */}
        {status === 'completed' && result && (
          <Card className="mx-auto max-w-2xl p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">PDF Protected!</h3>
              <p className="mb-6 text-gray-500">Your document is now password protected</p>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100">
                    <Shield className="h-7 w-7 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{result.file_name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={copyDownloadLink}>
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
                <a href={result.download_url} download className="flex-1">
                  <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </a>
              </div>

              <button
                onClick={handleReset}
                className="mt-4 flex w-full items-center justify-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                Protect another PDF
              </button>
            </div>
          </Card>
        )}

        {/* Error */}
        {status === 'error' && (
          <Card className="mx-auto max-w-lg p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Protection Failed</h3>
              <p className="mb-6 text-red-600">{error}</p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Start Over
                </Button>
                <Button onClick={handleProcess} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600">
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
