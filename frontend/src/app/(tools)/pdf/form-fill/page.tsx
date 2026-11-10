'use client';

import { useId, useState } from 'react';
import { Check, FileCheck, FormInput, ListChecks, MousePointerClick } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToolRun } from '@/hooks/useToolRun';
import { getFormFields, fillFormPdf, FormField, FormFieldsResponse, TaskResponse } from '@/lib/api';

type Values = Record<string, string | boolean>;

function FieldInput({ field, value, onChange }: { field: FormField; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  const uid = useId();

  if (field.read_only) {
    return (
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
          {field.name}
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-700">Read-only</span>
        </p>
        <p className="mt-1.5 rounded-lg bg-gray-100 px-4 py-2 text-sm italic text-gray-700">{field.value || '(read-only)'}</p>
      </div>
    );
  }

  if (field.field_type === 'checkbox') {
    return (
      <label htmlFor={uid} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-gray-800">
        <Checkbox id={uid} checked={!!value} onCheckedChange={(c) => onChange(!!c)} />
        <span>
          {field.name}
          {field.required && <span className="text-red-700"> *</span>}
        </span>
        <span className="text-xs font-normal text-gray-600">{value ? 'Checked' : 'Unchecked'}</span>
      </label>
    );
  }

  if (field.field_type === 'radio') {
    return (
      <fieldset>
        <legend className="text-sm font-medium text-gray-800">
          {field.name}
          {field.required && <span className="text-red-700"> *</span>}
        </legend>
        <div className="mt-1">
          {field.options?.map((option) => (
            <label key={option} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-gray-800">
              <input
                type="radio"
                name={`${uid}-${field.name}`}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="h-4 w-4 accent-purple-700"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.field_type === 'dropdown' || field.field_type === 'listbox') {
    return (
      <Field label={field.name} required={field.required}>
        {(a11y) => (
          <Select value={(value as string) || ''} onValueChange={onChange}>
            <SelectTrigger className="min-h-[44px]" {...a11y}>
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
        )}
      </Field>
    );
  }

  return (
    <Field label={field.name} required={field.required}>
      <Input
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.field_type === 'text' ? field.default_value || 'Enter value...' : undefined}
        className="min-h-[44px] border-gray-300"
      />
    </Field>
  );
}

export default function FormFillPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [values, setValues] = useState<Values>({});
  const [flatten, setFlatten] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const flattenId = useId();
  const detect = useToolRun<FormFieldsResponse['data']>();
  const fill = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const readFields = async (f: File) => {
    setNotice(null);
    const data = await detect.run((req) => getFormFields(f, req));
    if (!data) return;
    if (data.fields.length === 0) {
      setNotice('This PDF does not contain any fillable form fields.');
      setFiles([]);
      detect.reset();
      return;
    }
    const initial: Values = {};
    data.fields.forEach((fd) => {
      initial[fd.name] = fd.field_type === 'checkbox' ? fd.value === 'true' || fd.value === 'Yes' : fd.value || '';
    });
    setFields(data.fields);
    setValues(initial);
  };

  const onPick = (picked: File[]) => {
    setFiles(picked);
    if (picked[0]) readFields(picked[0]);
  };
  const submit = () => {
    if (file) fill.run((req) => fillFormPdf(file, values, flatten, req));
  };
  const startOver = () => {
    fill.reset();
    detect.reset();
    setFiles([]);
    setFields(null);
    setValues({});
    setFlatten(false);
    setNotice(null);
  };

  const byPage = (fields ?? []).reduce<Record<number, FormField[]>>((acc, f) => {
    (acc[f.page] ||= []).push(f);
    return acc;
  }, {});

  const showForm = !fill.isBusy && !detect.isBusy && fill.status !== 'done' && fill.status !== 'error' && detect.status !== 'error' && !(detect.status === 'done' && !fields);
  const announcement = fill.announcement || (detect.status === 'done' ? '' : detect.announcement);

  return (
    <ToolLayout
      title="Fill PDF Form"
      description="Fill out PDF form fields and download the completed document"
      icon={FormInput}
      tone="purple"
      width="lg"
      status={announcement}
    >
      {detect.isBusy && (
        <ProcessingCard
          stage={detect.status === 'uploading' ? 'uploading' : 'processing'}
          progress={detect.uploadProgress}
          loaded={detect.uploadLoaded}
          total={detect.uploadTotal}
          fileName={file?.name}
          fileSize={file?.size}
          title="Reading the form fields"
          tone="purple"
          onCancel={() => {
            detect.cancel();
            setFiles([]);
          }}
        />
      )}

      {fill.isBusy && (
        <ProcessingCard
          stage={fill.status === 'uploading' ? 'uploading' : 'processing'}
          progress={fill.uploadProgress}
          loaded={fill.uploadLoaded}
          total={fill.uploadTotal}
          fileName={file?.name}
          fileSize={file?.size}
          title="Filling in your form"
          tone="purple"
          onCancel={fill.cancel}
        />
      )}

      {fill.status === 'done' && fill.result && (
        <ResultCard
          title="Your filled form is ready"
          fileName={fill.result.file_name}
          fileSize={fill.result.file_size}
          downloadUrl={fill.result.download_url}
          downloadLabel="Download filled PDF"
          resetLabel="Fill another form"
          onReset={startOver}
          tone="purple"
        />
      )}

      {fill.status === 'error' && (
        <ErrorCard
          message={fill.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={submit}
          onEdit={fill.backToEdit}
          editLabel="Back to the form"
          onReset={startOver}
        />
      )}

      {detect.status === 'error' && (
        <ErrorCard
          message={detect.error || 'Something went wrong.'}
          title="We couldn't read this form"
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={file ? () => readFields(file) : undefined}
          onReset={startOver}
        />
      )}

      {showForm && !fields && (
        <ToolPanel aria-label="Fill a PDF form">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={onPick} tone="purple" typeLabel="PDF form" title="Drag & drop your PDF form here" />
          {notice && (
            <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {notice}
            </p>
          )}
          <FeatureGrid
            tone="purple"
            items={[
              { icon: MousePointerClick, label: 'Fields found for you', desc: 'Text, checkboxes, lists, options' },
              { icon: ListChecks, label: 'Fill by page', desc: 'Fields are grouped by page' },
              { icon: FileCheck, label: 'Flatten option', desc: 'Lock the answers in place' },
            ]}
          />
          <TrustStrip />
        </ToolPanel>
      )}

      {showForm && fields && (
        <ToolPanel aria-label="Fill the form fields">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900" title={file?.name}>{file?.name}</p>
              <p className="text-sm text-gray-700">
                {fields.length} form field{fields.length !== 1 ? 's' : ''} found
              </p>
            </div>
            <button
              type="button"
              onClick={startOver}
              className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
            >
              Upload a different file
            </button>
          </div>

          <div className="space-y-5">
            {Object.entries(byPage).map(([pageNum, pageFields]) => (
              <OptionsPanel key={pageNum} title={`Page ${pageNum}`}>
                <div className="space-y-4">
                  {pageFields.map((f) => (
                    <FieldInput key={f.name} field={f} value={values[f.name]} onChange={(v) => setValues((cur) => ({ ...cur, [f.name]: v }))} />
                  ))}
                </div>
              </OptionsPanel>
            ))}

            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
              <label htmlFor={flattenId} className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium text-gray-900">Flatten form</span>
                <span className="block text-xs text-gray-600">Make fields non-editable after filling</span>
              </label>
              <Switch id={flattenId} checked={flatten} onCheckedChange={setFlatten} />
            </div>

            <InfoNote>Your answers are filled into the PDF on our server. Check the downloaded file before you send it.</InfoNote>

            <div className="flex justify-center">
              <PrimaryButton tone="purple" icon={<Check className="h-5 w-5" />} onClick={submit}>
                Fill form
              </PrimaryButton>
            </div>
          </div>
          <TrustStrip />
        </ToolPanel>
      )}
    </ToolLayout>
  );
}
