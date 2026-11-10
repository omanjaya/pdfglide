'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Move, PenTool, Type } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { api, TaskResponse } from '@/lib/api';

type Mode = 'image' | 'text';
type Position = 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';

const MODE_OPTIONS: { value: Mode; label: string; description: string }[] = [
  { value: 'image', label: 'Signature image', description: 'Upload a PNG or JPG' },
  { value: 'text', label: 'Typed signature', description: 'Type your name' },
];

const POSITION_OPTIONS: { value: Position; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center', label: 'Center' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const INPUT =
  'min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-600/30';

export default function SignPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<Mode>('image');
  const [signatures, setSignatures] = useState<File[]>([]);
  const [signatureText, setSignatureText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>('bottom-right');
  const [pageInput, setPageInput] = useState('');
  const [width, setWidth] = useState(150);
  const [height, setHeight] = useState(50);
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];
  const signature = signatures[0];
  const ready = mode === 'image' ? !!signature : !!signatureText.trim();

  useEffect(() => {
    if (!signature) return setPreview(null);
    const url = URL.createObjectURL(signature);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [signature]);

  // Field names follow the server's /pdf/sign form: signature_image | signature_text, position, page (-1 = last), width, height.
  const sign = () => {
    if (!file || !ready) return;
    run.run(async (req) => {
      const form = new FormData();
      form.append('file', file);
      if (mode === 'image') form.append('signature_image', signature);
      else form.append('signature_text', signatureText.trim());
      form.append('position', position);
      form.append('page', String(parseInt(pageInput) > 0 ? parseInt(pageInput) : -1));
      form.append('width', String(width));
      form.append('height', String(height));
      return (await api.post('/pdf/sign', form, req)).data;
    });
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setMode('image');
    setSignatures([]);
    setSignatureText('');
    setPosition('bottom-right');
    setPageInput('');
    setWidth(150);
    setHeight(50);
  };

  return (
    <ToolLayout
      title="Sign PDF"
      description="Add your signature to a page of your PDF"
      icon={PenTool}
      tone="purple"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Sign a PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="purple" typeLabel="PDF" title="Drag & drop the PDF to sign" />

          {!file && (
            <FeatureGrid
              tone="purple"
              items={[
                { icon: ImageIcon, label: 'Image signature', desc: 'PNG or JPG' },
                { icon: Type, label: 'Typed signature', desc: 'Or just type your name' },
                { icon: Move, label: 'Choose the spot', desc: 'Any page, 7 positions' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Signature">
                <ChoiceGroup label="Signature type" value={mode} onChange={setMode} options={MODE_OPTIONS} tone="purple" columns={2} />
                {mode === 'image' ? (
                  <section aria-label="Signature image" className="space-y-2">
                    <FileUploader
                      accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'], 'image/gif': ['.gif'] }}
                      multiple={false}
                      files={signatures}
                      onFilesChange={setSignatures}
                      tone="purple"
                      typeLabel="PNG or JPG"
                      title="Drag & drop your signature image"
                      hint="A PNG with a transparent background looks best."
                    />
                    {preview && (
                      <div className="flex justify-center rounded-lg border border-gray-200 bg-white p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="Your signature image" className="max-h-20 object-contain" />
                      </div>
                    )}
                  </section>
                ) : (
                  <Field label="Your signature" hint="Printed in italic blue text. Use plain Latin letters.">
                    <input type="text" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder="e.g. Jane Smith" maxLength={80} className={INPUT} />
                  </Field>
                )}
              </OptionsPanel>

              <OptionsPanel title="Placement" description="Where the signature goes on the page.">
                <ChoiceGroup label="Position on the page" value={position} onChange={setPosition} options={POSITION_OPTIONS} tone="purple" columns={3} />
                <Field label="Page number (optional)" hint="Leave empty to sign the last page.">
                  <input type="number" inputMode="numeric" min={1} value={pageInput} placeholder="Last page" onChange={(e) => setPageInput(e.target.value)} className={INPUT} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Width (points)">
                    <input type="number" inputMode="numeric" min={20} max={500} value={width} onChange={(e) => setWidth(Math.max(20, parseInt(e.target.value) || 150))} className={INPUT} />
                  </Field>
                  <Field label="Height (points)">
                    <input type="number" inputMode="numeric" min={10} max={300} value={height} onChange={(e) => setHeight(Math.max(10, parseInt(e.target.value) || 50))} className={INPUT} />
                  </Field>
                </div>
                <p className="text-xs text-gray-600">An image is scaled to fit inside this box, keeping its proportions.</p>
              </OptionsPanel>

              <InfoNote>
                The signature is added as a picture or text on the page. It is not a certified digital signature.
              </InfoNote>

              <div className="flex flex-col items-center gap-2">
                <PrimaryButton tone="purple" icon={<PenTool className="h-5 w-5" />} onClick={sign} disabled={!ready}>
                  Sign PDF
                </PrimaryButton>
                {!ready && <p className="text-xs text-gray-600">{mode === 'image' ? 'Add a signature image to continue.' : 'Type your signature to continue.'}</p>}
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
          title="Adding your signature"
          tone="purple"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your signed PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download signed PDF"
          resetLabel="Sign another PDF"
          onReset={startOver}
          tone="purple"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={sign}
          onEdit={run.backToEdit}
          editLabel="Change signature or position"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
