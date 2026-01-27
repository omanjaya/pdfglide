'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { ToolLayout } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { ProcessingStatus } from '@/components/shared/ProcessingStatus';
import { Button } from '@/components/ui/Button';
import { protectPdf, TaskResponse } from '@/lib/api';

type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export default function ProtectPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [userPassword, setUserPassword] = useState<string>('');
  const [ownerPassword, setOwnerPassword] = useState<string>('');
  const [allowPrinting, setAllowPrinting] = useState<boolean>(true);
  const [allowCopying, setAllowCopying] = useState<boolean>(false);
  const [allowModifying, setAllowModifying] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<TaskResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    if (files.length === 0) return;
    if (!userPassword && !ownerPassword) {
      setError('At least one password is required');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const response = await protectPdf(files[0], {
        userPassword: userPassword || undefined,
        ownerPassword: ownerPassword || undefined,
        allowPrinting,
        allowCopying,
        allowModifying,
      });
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
    setUserPassword('');
    setOwnerPassword('');
    setAllowPrinting(true);
    setAllowCopying(false);
    setAllowModifying(false);
    setStatus('idle');
    setResult(null);
    setError(null);
  };

  return (
    <ToolLayout
      title="Protect PDF"
      description="Add password protection and permissions to your PDF"
      icon={Lock}
      color="bg-amber-500"
    >
      {status === 'idle' && (
        <div className="space-y-6">
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            maxFiles={1}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />

          {files.length > 0 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">User password (to open)</label>
                  <input
                    type="password"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required to open the PDF
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Owner password (full access)</label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-md border px-3 py-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for full access
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                      className="rounded"
                    />
                    <span>Allow printing</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="rounded"
                    />
                    <span>Allow copying text</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowModifying}
                      onChange={(e) => setAllowModifying(e.target.checked)}
                      className="rounded"
                    />
                    <span>Allow modifying</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={handleProcess}
                  disabled={!userPassword && !ownerPassword}
                >
                  <Lock className="mr-2 h-5 w-5" />
                  Protect PDF
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <ProcessingStatus
        status={status}
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
