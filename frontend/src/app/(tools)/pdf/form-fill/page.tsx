'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FormInput, Upload, FileText, X, Download, RefreshCw, AlertCircle, CheckCircle2, Copy, Loader2, Check, FileCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import {
  getFormFields,
  fillFormPdf,
  FormField,
  TaskResponse,
} from '@/lib/api';

type Status = 'idle' | 'loading' | 'editing' | 'processing' | 'completed' | 'error';

const processingSteps = [
  'Reading form fields...',
  'Validating entries...',
  'Filling fields...',
  'Flattening form...',
  'Generating PDF...',
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FormFillPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState(false);
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
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [status]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      await loadFormFields(selectedFile);
    }
  }, []);

  const loadFormFields = async (selectedFile: File) => {
    setStatus('loading');
    setError(null);

    try {
      const response = await getFormFields(selectedFile);
      if (response.success) {
        setFormFields(response.data.fields);
        const initialValues: Record<string, string | boolean> = {};
        response.data.fields.forEach((field) => {
          if (field.field_type === 'checkbox') {
            initialValues[field.name] = field.value === 'true' || field.value === 'Yes';
          } else {
            initialValues[field.name] = field.value || '';
          }
        });
        setFieldValues(initialValues);

        if (response.data.fields.length === 0) {
          setError('This PDF does not contain any fillable form fields.');
          setStatus('idle');
        } else {
          setStatus('editing');
        }
      } else {
        setError(response.error || 'Failed to read form fields');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'An error occurred');
      setStatus('error');
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

  const handleFieldChange = (name: string, value: string | boolean) => {
    setFieldValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProcess = async () => {
    if (!file) return;

    setStatus('processing');
    setProcessingStep(0);
    setError(null);

    try {
      const response = await fillFormPdf(file, fieldValues, flatten);
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
    setFormFields([]);
    setFieldValues({});
    setFlatten(false);
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

  const renderField = (field: FormField) => {
    if (field.read_only) {
      return (
        <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-500 italic">
          {field.value || '(read-only)'}
        </div>
      );
    }

    switch (field.field_type) {
      case 'text':
        return (
          <Input
            id={field.name}
            value={(fieldValues[field.name] as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.default_value || 'Enter value...'}
            className="border-gray-300 focus:border-violet-500 focus:ring-violet-200"
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-3">
            <Checkbox
              id={field.name}
              checked={!!fieldValues[field.name]}
              onCheckedChange={(checked) => handleFieldChange(field.name, !!checked)}
            />
            <label htmlFor={field.name} className="cursor-pointer text-sm text-gray-600">
              {fieldValues[field.name] ? 'Checked' : 'Unchecked'}
            </label>
          </div>
        );

      case 'dropdown':
      case 'listbox':
        return (
          <Select
            value={(fieldValues[field.name] as string) || ''}
            onValueChange={(value) => handleFieldChange(field.name, value)}
          >
            <SelectTrigger className="border-gray-300 focus:border-violet-500 focus:ring-violet-200">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {field.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <input
                  type="radio"
                  id={`${field.name}-${option}`}
                  name={field.name}
                  value={option}
                  checked={fieldValues[field.name] === option}
                  onChange={() => handleFieldChange(field.name, option)}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor={`${field.name}-${option}`} className="cursor-pointer text-sm">
                  {option}
                </label>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <Input
            id={field.name}
            value={(fieldValues[field.name] as string) || ''}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            className="border-gray-300 focus:border-violet-500 focus:ring-violet-200"
          />
        );
    }
  };

  const fieldsByPage = formFields.reduce((acc, field) => {
    const page = field.page;
    if (!acc[page]) acc[page] = [];
    acc[page].push(field);
    return acc;
  }, {} as Record<number, FormField[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-violet-700 text-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
            <FormInput className="h-10 w-10" />
          </div>
          <h1 className="mb-3 text-4xl font-bold">Fill PDF Form</h1>
          <p className="text-lg text-violet-100">
            Fill out PDF form fields and download the completed document
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Idle State - Upload */}
        {status === 'idle' && (
          <div className="space-y-6">
            <Card className="border-2 border-dashed border-violet-200 bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8">
                <div
                  className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                    isDragging
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-violet-200 hover:border-violet-400 hover:bg-violet-50/50'
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
                  <div className="mb-4 inline-flex rounded-full bg-violet-100 p-4">
                    <Upload className="h-8 w-8 text-violet-600" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold text-gray-800">
                    Drop your PDF form here
                  </h3>
                  <p className="mb-4 text-gray-500">or click to browse</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 font-medium text-white shadow-lg transition-all hover:from-violet-700 hover:to-purple-700 hover:shadow-xl"
                  >
                    Select PDF Form
                  </button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <p className="text-amber-800">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {status === 'loading' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-violet-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Loading Form Fields...</h3>
              <p className="text-gray-500">Analyzing your PDF form</p>
            </CardContent>
          </Card>
        )}

        {/* Editing State - Form Fields */}
        {status === 'editing' && formFields.length > 0 && (
          <div className="space-y-6">
            {/* File Info */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-violet-100 p-3">
                      <FileText className="h-8 w-8 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{file?.name}</p>
                      <p className="text-sm text-gray-500">
                        {formFields.length} form field{formFields.length !== 1 ? 's' : ''} found
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Upload Different File
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Form Fields by Page */}
            {Object.entries(fieldsByPage).map(([pageNum, fields]) => (
              <Card key={pageNum} className="bg-white shadow-lg">
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-sm text-violet-700">
                      Page {pageNum}
                    </span>
                  </h3>
                  <div className="space-y-4">
                    {fields.map((field) => (
                      <div key={field.name} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          {field.name}
                          {field.required && <span className="text-red-500">*</span>}
                          {field.read_only && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              Read-only
                            </span>
                          )}
                        </label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Flatten Option */}
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Flatten Form</p>
                    <p className="text-sm text-gray-500">Make fields non-editable after filling</p>
                  </div>
                  <Switch
                    checked={flatten}
                    onCheckedChange={setFlatten}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Process Button */}
            <button
              onClick={handleProcess}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:from-violet-700 hover:to-purple-700 hover:shadow-xl"
            >
              <Check className="mr-2 inline-block h-5 w-5" />
              Fill Form & Download
            </button>
          </div>
        )}

        {/* Processing State */}
        {status === 'processing' && (
          <Card className="bg-white shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="mb-6 inline-flex rounded-full bg-violet-100 p-6">
                <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Filling Form...</h3>
              <p className="mb-6 text-gray-500">{processingSteps[processingStep]}</p>
              <div className="mx-auto flex max-w-md justify-center gap-2">
                {processingSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-full rounded-full transition-all ${
                      index <= processingStep ? 'bg-violet-500' : 'bg-gray-200'
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
                <h3 className="mb-2 text-xl font-semibold text-gray-900">Form Filled!</h3>
                <p className="text-gray-500">Your form has been filled and is ready to download</p>
              </div>

              <div className="mb-6 rounded-xl bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-8 w-8 text-violet-600" />
                    <div>
                      <p className="font-medium text-gray-900">{result.file_name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(result.file_size || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
                    <FormInput className="h-4 w-4" />
                    Filled
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={result.download_url}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 font-medium text-white shadow-lg transition-all hover:from-violet-700 hover:to-purple-700"
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
                Fill Another Form
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
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-medium text-white hover:bg-violet-700"
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
