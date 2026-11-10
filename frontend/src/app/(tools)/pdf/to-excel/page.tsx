'use client';

import { useState } from 'react';
import { FileSpreadsheet, Grid3X3, Combine, Rows } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { pdfToExcel, TaskResponse } from '@/lib/api';

export default function PdfToExcelPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (file) run.run((req) => pdfToExcel(file, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };
  const noTables = /no tables found/i.test(run.error ?? '');

  return (
    <ToolLayout
      title="PDF to Excel"
      description="Extract tables from a PDF into an Excel spreadsheet"
      icon={FileSpreadsheet}
      tone="emerald"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert PDF to Excel">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="emerald" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="emerald"
              items={[
                { icon: Grid3X3, label: 'Ruled tables', desc: 'Detected automatically' },
                { icon: Rows, label: 'Real numbers', desc: 'Numbers become numeric cells' },
                { icon: Combine, label: 'Merged cells', desc: 'Kept, and tables across pages are joined' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                Tables with ruled lines are detected on every page, one sheet per table area. Numbers become real
                numbers, merged cells are kept, and a table that continues across pages is joined. Scanned PDFs are
                pictures of pages, so they have no tables to extract.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="emerald" icon={<FileSpreadsheet className="h-5 w-5" />} onClick={convert}>
                  Convert to Excel
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
          title="Finding tables and building your spreadsheet"
          tone="emerald"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your spreadsheet is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download Excel file"
          resetLabel="Convert another PDF"
          onReset={startOver}
          tone="emerald"
        >
          <p className="text-center text-xs text-gray-600">
            Open it in Excel and check the sheets: each table area is on its own sheet.
          </p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <div className="space-y-4">
          <ErrorCard
            message={run.error || 'Something went wrong.'}
            fileName={file?.name}
            fileSize={file?.size}
            onRetry={convert}
            onEdit={run.backToEdit}
            editLabel="Choose a different file"
            onReset={startOver}
          />
          {noTables && (
            <InfoNote className="bg-white">
              <p className="font-medium text-gray-900">What to try</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>This tool finds tables drawn with ruled lines. Tables made only of spaced-out text may not be detected.</li>
                <li>A scanned PDF is a picture of each page, so it has no tables to extract.</li>
                <li>Check that the PDF really contains a table, or try a different file.</li>
              </ul>
            </InfoNote>
          )}
        </div>
      )}
    </ToolLayout>
  );
}
