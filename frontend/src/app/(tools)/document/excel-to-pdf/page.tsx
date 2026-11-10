'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileCheck2, Table2, Zap } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { excelToPdf, TaskResponse } from '@/lib/api';

const ACCEPT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
};

export default function ExcelToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const convert = () => {
    if (file) run.run((req) => excelToPdf(file, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
  };

  return (
    <ToolLayout
      title="Excel to PDF"
      description="Turn Excel spreadsheets (XLSX, XLS) into PDF files you can share and print."
      icon={FileSpreadsheet}
      tone="green"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert Excel to PDF">
          <FileUploader accept={ACCEPT} multiple={false} files={files} onFilesChange={setFiles} tone="green" typeLabel="XLSX or XLS" />

          {!file && (
            <FeatureGrid
              tone="green"
              items={[
                { icon: FileCheck2, label: 'XLSX and XLS', desc: 'Excel 97 and newer' },
                { icon: Table2, label: 'Ready to print', desc: 'Share as a PDF' },
                { icon: Zap, label: 'Fast', desc: 'Usually a few seconds' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <InfoNote>
                Fonts are matched to the closest typeface available on our server. Long or wide sheets may
                span several pages, so check the page breaks in the result.
              </InfoNote>
              <div className="flex justify-center">
                <PrimaryButton tone="green" icon={<FileSpreadsheet className="h-5 w-5" />} onClick={convert}>
                  Convert to PDF
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
          title="Converting to PDF"
          hint="Large workbooks can take up to a minute."
          tone="green"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PDF"
          resetLabel="Convert another file"
          onReset={startOver}
          tone="green"
        />
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
