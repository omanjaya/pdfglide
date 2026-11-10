'use client';

import { useState } from 'react';
import { Lock, KeyRound, Shield, Eye, EyeOff } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { protectPdf, TaskResponse } from '@/lib/api';

const PERMISSIONS = [
  { key: 'allowPrinting', label: 'Allow printing', description: 'People can print the document' },
  { key: 'allowCopying', label: 'Allow copying', description: 'People can copy text and images' },
  { key: 'allowModifying', label: 'Allow modifying', description: 'People can edit the document' },
] as const;

function PasswordInput({ value, onChange, placeholder, ...a11y }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        {...a11y}
        type={show ? 'text' : 'password'}
        autoComplete="new-password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[44px] w-full rounded-lg border border-gray-300 py-2 pl-4 pr-12 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-600/30"
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
  );
}

export default function ProtectPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [userPassword, setUserPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [perms, setPerms] = useState({ allowPrinting: true, allowCopying: false, allowModifying: false });
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];
  const hasPassword = Boolean(userPassword || ownerPassword);

  const protect = () => {
    if (!file || !hasPassword) return;
    run.run((req) => protectPdf(file, { userPassword: userPassword || undefined, ownerPassword: ownerPassword || undefined, ...perms }, req));
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setUserPassword('');
    setOwnerPassword('');
    setPerms({ allowPrinting: true, allowCopying: false, allowModifying: false });
  };

  return (
    <ToolLayout
      title="Protect PDF"
      description="Add password protection and set permissions"
      icon={Lock}
      tone="amber"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Protect PDF with a password">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="amber" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="amber"
              items={[
                { icon: KeyRound, label: 'Password', desc: 'Needed to open the PDF' },
                { icon: Shield, label: 'Permissions', desc: 'Print, copy, edit' },
                { icon: Lock, label: 'Encryption', desc: '256-bit AES' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Passwords" icon={KeyRound} description="Set at least one.">
                <Field label="Password to open the PDF" hint="Required to open the PDF.">
                  {(a11y) => <PasswordInput {...a11y} value={userPassword} onChange={setUserPassword} placeholder="Enter password to open PDF" />}
                </Field>
                <Field label="Owner password (full access)" hint="Needed to change permissions or remove protection. If you only set the opening password, it is used for both.">
                  {(a11y) => <PasswordInput {...a11y} value={ownerPassword} onChange={setOwnerPassword} placeholder="Enter owner password" />}
                </Field>
              </OptionsPanel>

              <OptionsPanel title="Permissions" icon={Shield} description="What people can do once the PDF is open.">
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={perms[p.key]}
                      onChange={(e) => setPerms((s) => ({ ...s, [p.key]: e.target.checked }))}
                      className="h-5 w-5 shrink-0 rounded border-gray-300 accent-amber-700 focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                    />
                    <span>
                      <span className="block text-sm font-medium text-gray-900">{p.label}</span>
                      <span className="block text-xs text-gray-600">{p.description}</span>
                    </span>
                  </label>
                ))}
              </OptionsPanel>

              <InfoNote>We cannot recover a forgotten password. Keep a copy of it somewhere safe.</InfoNote>

              <div className="flex flex-col items-center gap-2">
                <PrimaryButton tone="amber" icon={<Lock className="h-5 w-5" />} onClick={protect} disabled={!hasPassword}>
                  Protect PDF
                </PrimaryButton>
                {!hasPassword && <p className="text-sm text-amber-800">Enter at least one password to continue.</p>}
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
          title="Encrypting your PDF"
          tone="amber"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your PDF is password protected"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download protected PDF"
          resetLabel="Protect another PDF"
          onReset={startOver}
          copyLink
          tone="amber"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={protect}
          onEdit={run.backToEdit}
          editLabel="Change options"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
