'use client';

import { useState } from 'react';
import { FileText, FileCheck2, ScanText, Type } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { OCR_LANGUAGES } from '@/components/shared/ocrLanguages';
import { useToolRun } from '@/hooks/useToolRun';
import { pdfToWord, PdfToWordOptions, TaskResponse } from '@/lib/api';

type Quality = NonNullable<PdfToWordOptions['quality']>;

const QUALITY_OPTIONS: { value: Quality; label: string; description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Fastest, least accurate reading of the scan.' },
  { value: 'standard', label: 'Standard', description: 'Balanced speed and accuracy.' },
  { value: 'high', label: 'High', description: 'Slowest, most accurate reading of the scan.' },
];

export default function PdfToWordPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<Quality>('standard');
  const [lang, setLang] = useState('eng');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (file) run.run((req) => pdfToWord(file, { quality, lang }, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setQuality('standard');
    setLang('eng');
  };

  return (
    <ToolLayout
      title="PDF to Word"
      description="Convert a PDF into an editable Word document (DOCX)."
      icon={FileText}
      tone="blue"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert PDF to Word">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="blue" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="blue"
              items={[
                { icon: Type, label: 'Editable text', desc: 'Fonts, sizes, bold, italic' },
                { icon: FileCheck2, label: 'Tables and images', desc: 'Carried into the DOCX' },
                { icon: ScanText, label: 'Scans too', desc: 'Read with OCR' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                PDFs with real text keep their fonts, sizes, bold and italic, tables and images. The result is a
                rebuilt, editable document, so very complex layouts can look a little different from the PDF.
                Password-protected PDFs must be unlocked first.
              </InfoNote>

              <OptionsPanel
                collapsible
                title="Scanned document options"
                description="Only used when the PDF is a scan (pictures of pages). Normal PDFs ignore these."
              >
                <Field label="Quality" hint={QUALITY_OPTIONS.find((o) => o.value === quality)?.description}>
                  {(a11y) => (
                    <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
                      <SelectTrigger className="min-h-[44px]" {...a11y}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUALITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <Field label="Document language" hint="Pick the language of the text in the scan.">
                  {(a11y) => (
                    <Select value={lang} onValueChange={setLang}>
                      <SelectTrigger className="min-h-[44px]" {...a11y}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OCR_LANGUAGES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>
                            {l.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </OptionsPanel>

              <div className="flex justify-center">
                <PrimaryButton tone="blue" icon={<FileText className="h-5 w-5" />} onClick={convert}>
                  Convert to Word
                </PrimaryButton>
              </div>
            </div>
          )}
          <TrustStrip />
        </ToolPanel>
      )}

      {run.isBusy && (
        <ProcessingCard
          stage={run.status === 'uploading' ? 'uploading' : 'processing'}
          progress={run.uploadProgress}
          loaded={run.uploadLoaded}
          total={run.uploadTotal}
          fileName={file?.name}
          fileSize={file?.size}
          title="Converting to Word"
          hint="Scanned or long PDFs can take a minute or more."
          tone="blue"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your Word document is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download Word file"
          resetLabel="Convert another file"
          onReset={startOver}
          tone="blue"
        >
          <p className="text-center text-xs text-gray-600">
            Open it in Word and skim the formatting: complex layouts may need small touch-ups.
          </p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Choose a different file"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
