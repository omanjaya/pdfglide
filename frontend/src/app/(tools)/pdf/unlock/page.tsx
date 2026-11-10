'use client';

import { useState } from 'react';
import { Unlock, Lock, KeyRound, Eye, EyeOff, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { unlockPdf, TaskResponse } from '@/lib/api';

export default function UnlockPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const unlock = () => {
    if (file) run.run((req) => unlockPdf(file, password, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setPassword('');
    setShow(false);
  };

  return (
    <ToolLayout
      title="Unlock PDF"
      description="Remove password protection and restrictions from your PDF files"
      icon={Unlock}
      tone="green"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Unlock PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="green" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="green"
              items={[
                { icon: KeyRound, label: 'Password removal', desc: 'Remove the open password' },
                { icon: ShieldCheck, label: 'Restrictions', desc: 'Remove print, copy, edit limits' },
                { icon: Lock, label: 'You need the password', desc: 'We cannot guess or crack it' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Password" icon={KeyRound}>
                <Field
                  label="PDF password (optional)"
                  hint="Enter the password if the PDF asks for one when you open it. Leave it empty if the PDF only has restrictions on printing, copying or editing."
                >
                  {(a11y) => (
                    <div className="relative">
                      <input
                        {...a11y}
                        type={show ? 'text' : 'password'}
                        autoComplete="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter PDF password"
                        className="min-h-[44px] w-full rounded-lg border border-gray-300 py-2 pl-4 pr-12 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? 'Hide password' : 'Show password'}
                        aria-pressed={show}
                        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {show ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                      </button>
                    </div>
                  )}
                </Field>
              </OptionsPanel>

              <div className="rounded-xl bg-gray-50 p-4">
                <h2 className="mb-2 text-sm font-semibold text-gray-800">This removes</h2>
                <ul className="space-y-1.5 text-sm text-gray-700">
                  {['The open (document) password', 'Printing restrictions', 'Copy and edit restrictions'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              <InfoNote>Only unlock PDFs you own or have permission to open.</InfoNote>

              <div className="flex justify-center">
                <PrimaryButton tone="green" icon={<Unlock className="h-5 w-5" />} onClick={unlock}>
                  Unlock PDF
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
          title="Unlocking your PDF"
          tone="green"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF is unlocked"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download unlocked PDF"
          resetLabel="Unlock another PDF"
          onReset={startOver}
          copyLink
          tone="green"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={unlock}
          onEdit={run.backToEdit}
          editLabel="Change password"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
