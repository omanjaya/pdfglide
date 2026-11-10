'use client';

import { useState } from 'react';
import { Hash, FileText, ListOrdered, Type, LayoutGrid } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { addPageNumbers, TaskResponse } from '@/lib/api';

const POSITION_OPTIONS = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const FORMAT_OPTIONS = [
  { value: '{n}', label: '1', description: '1, 2, 3...', preview: '1' },
  { value: 'Page {n}', label: 'Page 1', description: 'Page 1, Page 2...', preview: 'Page 1' },
  { value: '{n} of {total}', label: '1 of 10', description: 'Number of total', preview: '1 of 10' },
  { value: 'Page {n} of {total}', label: 'Page 1 of 10', description: 'Page number of total', preview: 'Page 1 of 10' },
];

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24].map((s) => ({ value: s, label: String(s) }));

export default function PageNumbersPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [position, setPosition] = useState('bottom-center');
  const [startNumber, setStartNumber] = useState(1);
  const [formatTemplate, setFormatTemplate] = useState('{n}');
  const [fontSize, setFontSize] = useState(12);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];
  const previewText = FORMAT_OPTIONS.find((f) => f.value === formatTemplate)?.preview.replace(/^\d+/, String(startNumber)).replace(/^Page \d+/, `Page ${startNumber}`);

  const addNumbers = () => {
    if (file) run.run((req) => addPageNumbers(file, { position, startNumber, formatTemplate, fontSize }, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setPosition('bottom-center');
    setStartNumber(1);
    setFormatTemplate('{n}');
    setFontSize(12);
  };

  return (
    <ToolLayout
      title="Add Page Numbers"
      description="Add page numbers to your PDF document"
      icon={Hash}
      tone="indigo"
      width="lg"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Add page numbers to PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="indigo" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="indigo"
              items={[
                { icon: LayoutGrid, label: '6 positions', desc: 'Top or bottom' },
                { icon: ListOrdered, label: 'Start number', desc: 'Begin at any number' },
                { icon: Type, label: '4 formats', desc: 'Like Page 1 of 10' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 grid gap-6 md:grid-cols-[200px_1fr]">
              <div className="mx-auto" aria-hidden="true">
                <div className="relative h-64 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="absolute inset-4 flex items-center justify-center">
                    <FileText className="h-16 w-16 text-gray-300" />
                  </div>
                  <div
                    className={`absolute px-2 py-1 font-medium text-indigo-700 ${position.includes('top') ? 'top-2' : 'bottom-2'} ${
                      position.includes('left') ? 'left-2' : position.includes('right') ? 'right-2' : 'left-1/2 -translate-x-1/2'
                    }`}
                    style={{ fontSize: `${Math.max(fontSize * 0.75, 8)}px` }}
                  >
                    {previewText}
                  </div>
                </div>
                <p className="mt-2 text-center text-xs text-gray-600">Preview</p>
              </div>

              <OptionsPanel title="Page number options" icon={Hash}>
                <ChoiceGroup label="Position" tone="indigo" value={position} onChange={setPosition} columns={3} options={POSITION_OPTIONS} />
                <ChoiceGroup label="Format" tone="indigo" value={formatTemplate} onChange={setFormatTemplate} columns={2} options={FORMAT_OPTIONS.map(({ value, label, description }) => ({ value, label, description }))} />
                <Field label="Start number">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
                  />
                </Field>
                <ChoiceGroup label="Font size" tone="indigo" value={fontSize} onChange={setFontSize} columns={4} options={FONT_SIZES} />
              </OptionsPanel>
            </div>
          )}

          {file && (
            <div className="mt-5 space-y-5">
              <InfoNote>Numbers are added to every page. {'{total}'} formats use the real page count of your PDF.</InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="indigo" icon={<Hash className="h-5 w-5" />} onClick={addNumbers}>
                  Add page numbers
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
          title="Numbering your pages"
          tone="indigo"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your numbered PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Number another PDF"
          onReset={startOver}
          copyLink
          tone="indigo"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={addNumbers}
          onEdit={run.backToEdit}
          editLabel="Change options"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
