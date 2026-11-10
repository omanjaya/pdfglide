'use client';

import { useState } from 'react';
import { Presentation, Image as ImageIcon, Layers, Type } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { pdfToPowerPoint, TaskResponse } from '@/lib/api';

type Quality = 'low' | 'medium' | 'high';

const QUALITY_OPTIONS: { value: Quality; dpi: number; label: string; description: string }[] = [
  { value: 'low', dpi: 72, label: 'Low', description: 'Smaller file, faster processing' },
  { value: 'medium', dpi: 150, label: 'Medium', description: 'Balanced quality and size' },
  { value: 'high', dpi: 300, label: 'High', description: 'Best quality for printing' },
];

export default function PdfToPowerPointPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState<Quality>('medium');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    const dpi = QUALITY_OPTIONS.find((o) => o.value === quality)?.dpi ?? 150;
    if (file) run.run((req) => pdfToPowerPoint(file, dpi, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setQuality('medium');
  };

  return (
    <ToolLayout
      title="PDF to PowerPoint"
      description="Convert a PDF into a PowerPoint presentation with editable text"
      icon={Presentation}
      tone="orange"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert PDF to PowerPoint">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="orange" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="orange"
              items={[
                { icon: Type, label: 'Editable text', desc: 'Text boxes with the original fonts' },
                { icon: ImageIcon, label: 'Pictures kept', desc: 'Images and shapes stay as they are' },
                { icon: Layers, label: 'Slide = page', desc: 'Slides match the PDF page size' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                Each PDF page becomes a slide of the same size. Text in PDFs with real text becomes editable text
                boxes with the original fonts, sizes and colours, placed over a background that keeps pictures and
                shapes exactly. Scanned pages, rotated text and right-to-left text stay as pictures.
              </InfoNote>

              <OptionsPanel title="Picture quality" description="Resolution of the pictures and shapes behind the text.">
                <ChoiceGroup
                  label="Picture quality"
                  value={quality}
                  onChange={setQuality}
                  options={QUALITY_OPTIONS}
                  tone="orange"
                />
              </OptionsPanel>

              <div className="flex justify-center">
                <PrimaryButton tone="orange" icon={<Presentation className="h-5 w-5" />} onClick={convert}>
                  Convert to PowerPoint
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
          title="Building your presentation"
          hint="Long PDFs take longer because every page becomes a slide."
          tone="orange"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your presentation is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PowerPoint file"
          resetLabel="Convert another PDF"
          onReset={startOver}
          tone="orange"
        >
          <p className="text-center text-xs text-gray-600">
            Open it in PowerPoint and skim the slides: fonts you do not have installed may be substituted.
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
          editLabel="Change file or quality"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
