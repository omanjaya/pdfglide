'use client';

import { useState } from 'react';
import { QrCode, Link2, Zap, Maximize2 } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FeatureGrid, InfoNote } from '@/components/shared/TrustStrip';
import { ChoiceGroup, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { api, getDownloadUrl, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

const SIZES = [
  { value: 200, label: 'Small', description: '200 × 200 px' },
  { value: 400, label: 'Medium', description: '400 × 400 px' },
  { value: 800, label: 'Large', description: '800 × 800 px' },
];

// QR codes hold at most ~2.9 KB; stay safely below so the server never has to refuse.
const MAX_BYTES = 2000;
const WARN_BYTES = 600;

function byteLength(s: string) {
  return new TextEncoder().encode(s).length;
}

function validate(content: string): { error?: string; warning?: string } {
  if (!content.trim()) return { error: 'Enter some text or a link to turn into a QR code.' };
  const bytes = byteLength(content);
  if (bytes > MAX_BYTES) {
    return { error: `This is too long for a QR code (${bytes.toLocaleString()} of ${MAX_BYTES.toLocaleString()} characters allowed). Shorten it or use a short link.` };
  }
  const t = content.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t) && /^(www\.|[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$))/i.test(t) && !/\s/.test(t)) {
    return { warning: 'This looks like a web address. Start it with https:// so phones open it as a link.' };
  }
  if (bytes > WARN_BYTES) {
    return { warning: 'Long content makes a dense QR code that is harder to scan. A short link scans best.' };
  }
  return {};
}

export default function QRCodePage() {
  const [content, setContent] = useState('');
  const [touched, setTouched] = useState(false);
  const [size, setSize] = useState(400);
  const run = useToolRun<TaskResponse['data']>();

  const v = validate(content);
  const showError = touched && content.length > 0 ? v.error : undefined;
  const bytes = byteLength(content);

  const generate = () => {
    if (validate(content).error) {
      setTouched(true);
      return;
    }
    run.run(async (req) => {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('size', String(size));
      const response = await api.post('/qr/generate', formData, req);
      return response.data;
    });
  };
  const startOver = () => {
    run.reset();
    setContent('');
    setTouched(false);
    setSize(400);
  };

  return (
    <ToolLayout
      title="QR Code Generator"
      description="Turn a link or any text into a QR code you can download as a PNG."
      icon={QrCode}
      tone="purple"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Create a QR code">
          <form
            noValidate
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <Field
              label="Link or text"
              hint={
                <span className="flex flex-wrap justify-between gap-x-3">
                  <span>{v.warning && !showError ? v.warning : 'A web address, a Wi-Fi code, contact details, any text.'}</span>
                  <span className={cn(bytes > MAX_BYTES && 'font-semibold text-red-700')}>
                    {bytes.toLocaleString()} / {MAX_BYTES.toLocaleString()}
                  </span>
                </span>
              }
              error={showError}
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="https://example.com"
                rows={4}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={cn(
                  'min-h-[7rem] w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  showError ? 'border-red-500 focus-visible:ring-red-600' : 'border-gray-300 focus-visible:ring-purple-600'
                )}
              />
            </Field>

            <ChoiceGroup label="Image size" tone="purple" value={size} onChange={setSize} options={SIZES} />

            <div className="flex justify-center">
              <PrimaryButton
                type="submit"
                tone="purple"
                icon={<QrCode className="h-5 w-5" />}
                disabled={!content.trim() || !!v.error}
              >
                Create QR code
              </PrimaryButton>
            </div>
          </form>

          {!content.trim() && (
            <FeatureGrid
              tone="purple"
              items={[
                { icon: Link2, label: 'Links and text', desc: 'URLs, notes, contacts' },
                { icon: Maximize2, label: '3 sizes', desc: 'Up to 800 px' },
                { icon: Zap, label: 'Instant', desc: 'PNG, ready to print' },
              ]}
            />
          )}
          <InfoNote className="mt-6">
            The text you enter is sent to our server to draw the code. Do not encode secrets you would not
            want a QR code to reveal: anyone who scans it can read what is inside.
          </InfoNote>
        </ToolPanel>
      )}

      {run.isBusy && (
        <ProcessingCard stage="processing" title="Creating your QR code" tone="purple" onCancel={run.cancel} />
      )}

      {run.status === 'done' && run.result?.download_url && (
        <ResultCard
          title="Your QR code is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download PNG"
          resetLabel="Create another"
          onReset={startOver}
          tone="purple"
        >
          <div className="flex justify-center">
            <div className="rounded-xl border bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getDownloadUrl(run.result.download_url)}
                alt={`QR code for: ${content.length > 80 ? content.slice(0, 80) + '...' : content}`}
                width={size}
                height={size}
                className="h-auto w-full max-w-[260px]"
              />
            </div>
          </div>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          onRetry={generate}
          onEdit={run.backToEdit}
          editLabel="Edit the text"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
