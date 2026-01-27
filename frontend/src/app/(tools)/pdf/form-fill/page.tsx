'use client';

import { useState } from 'react';
import { FormInput, Check, Download } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
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

export default function FormFillPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [flatten, setFlatten] = useState(false);
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (newFiles: File[]) => {
    setFiles(newFiles);
    if (newFiles.length > 0) {
      await loadFormFields(newFiles[0]);
    } else {
      setFormFields([]);
      setFieldValues({});
      setStatus('idle');
    }
  };

  const loadFormFields = async (file: File) => {
    setStatus('loading');
    setError(null);

    try {
      const response = await getFormFields(file);
      if (response.success) {
        setFormFields(response.data.fields);
        // Initialize field values with current values
        const initialValues: Record<string, string | boolean> = {};
        response.data.fields.forEach((field) => {
          if (field.field_type === 'checkbox') {
            initialValues[field.name] = field.value === 'true' || field.value === 'Yes';
          } else {
            initialValues[field.name] = field.value || '';
          }
        });
        setFieldValues(initialValues);
        setStatus('editing');

        if (response.data.fields.length === 0) {
          setError('This PDF does not contain any fillable form fields.');
          setStatus('idle');
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

  const handleFieldChange = (name: string, value: string | boolean) => {
    setFieldValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setStatus('processing');
    setError(null);

    try {
      const response = await fillFormPdf(files[0], fieldValues, flatten);
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
    setFormFields([]);
    setFieldValues({});
    setFlatten(false);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  const renderField = (field: FormField) => {
    if (field.read_only) {
      return (
        <div className="text-sm text-muted-foreground italic">
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
            placeholder={field.default_value || ''}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={!!fieldValues[field.name]}
              onCheckedChange={(checked) => handleFieldChange(field.name, !!checked)}
            />
            <label htmlFor={field.name} className="text-sm cursor-pointer">
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
            <SelectTrigger>
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
                  className="h-4 w-4"
                />
                <label
                  htmlFor={`${field.name}-${option}`}
                  className="text-sm cursor-pointer"
                >
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
          />
        );
    }
  };

  // Group fields by page
  const fieldsByPage = formFields.reduce((acc, field) => {
    const page = field.page;
    if (!acc[page]) acc[page] = [];
    acc[page].push(field);
    return acc;
  }, {} as Record<number, FormField[]>);

  return (
    <ToolLayout
      title="Fill PDF Form"
      description="Fill out PDF form fields and download the completed document"
      icon={FormInput}
      color="bg-violet-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={handleFileChange}
          />

          {error && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">{error}</p>
            </div>
          )}
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground">Loading form fields...</p>
        </div>
      )}

      {status === 'editing' && formFields.length > 0 && (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold truncate">
                {files[0]?.name}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {formFields.length} form field{formFields.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset} className="self-start sm:self-auto">
              Upload Different File
            </Button>
          </div>

          {Object.entries(fieldsByPage).map(([page, fields]) => (
            <Card key={page}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Page {page}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name} className="flex items-center gap-2">
                      {field.name}
                      {field.required && (
                        <span className="text-red-500">*</span>
                      )}
                      {field.read_only && (
                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          Read-only
                        </span>
                      )}
                    </Label>
                    {renderField(field)}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <Label htmlFor="flatten" className="text-sm">Flatten Form</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Make fields non-editable after filling
                  </p>
                </div>
                <Switch
                  id="flatten"
                  checked={flatten}
                  onCheckedChange={setFlatten}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Button size="lg" onClick={handleProcess}>
              <Check className="mr-2 h-5 w-5" />
              Fill Form & Download
            </Button>
          </div>
        </div>
      )}

      <ProcessingStatus
        status={status === 'processing' ? 'processing' : status === 'completed' ? 'completed' : status === 'error' && error ? 'error' : 'idle'}
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
