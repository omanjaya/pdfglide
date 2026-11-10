'use client';

import { FormEvent, useState } from 'react';
import { Globe, Link2, FileCheck2, Zap } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { ChoiceGroup, Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { htmlToPdf, TaskResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

type PageSize = 'A4' | 'Letter' | 'Legal';

const PAGE_SIZES: { value: PageSize; label: string; description: string }[] = [
  { value: 'A4', label: 'A4', description: '210 × 297 mm' },
  { value: 'Letter', label: 'Letter', description: '8.5 × 11 in' },
  { value: 'Legal', label: 'Legal', description: '8.5 × 14 in' },
];

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?$)/i;

/** Returns the normalised URL, or a message explaining what is wrong. */
function checkUrl(raw: string): { url: string; note?: string } | { error: string } {
  const text = raw.trim();
  if (!text) return { error: 'Enter the address of the page you want to convert.' };
  if (/\s/.test(text)) return { error: 'The address cannot contain spaces.' };

  let candidate = text;
  let note: string | undefined;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate) && !/^[^/]+\.[a-z]{2,}(:\d+)?(\/|$)/i.test(candidate)) {
      return { error: 'Only web addresses starting with http:// or https:// can be converted.' };
    }
    candidate = `https://${candidate}`;
    note = `We will use ${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: 'That does not look like a valid web address. Try something like https://example.com.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only web addresses starting with http:// or https:// can be converted.' };
  }
  if (PRIVATE_HOST.test(parsed.hostname)) {
    return { error: 'Only public websites can be converted, not private or local addresses.' };
  }
  if (!parsed.hostname.includes('.') || /\.$/.test(parsed.hostname)) {
    return { error: 'That address needs a full domain name, for example example.com.' };
  }
  return { url: parsed.toString(), note };
}

export default function HtmlToPdfPage() {
  const [input, setInput] = useState('');
  const [touched, setTouched] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>('A4');
  const run = useToolRun<TaskResponse['data']>();

  const checked = checkUrl(input);
  const error = touched && 'error' in checked && input.trim() ? checked.error : null;
  const note = 'note' in checked && checked.note && !error ? checked.note : undefined;

  const convert = () => {
    const c = checkUrl(input);
    if ('error' in c) {
      setTouched(true);
      return;
    }
    run.run((req) => htmlToPdf(c.url, { pageSize }, req));
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    convert();
  };
  const startOver = () => {
    run.reset();
    setInput('');
    setTouched(false);
    setPageSize('A4');
  };

  const shownUrl = 'url' in checked ? checked.url : input.trim();

  return (
    <ToolLayout
      title="HTML to PDF"
      description="Save any public web page as a PDF."
      icon={Globe}
      tone="cyan"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Convert a web page to PDF">
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <Field
              label="Web page address"
              hint={note || 'Paste the full address of a public page, for example https://example.com/article'}
              error={error}
            >
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="https://example.com"
                className={cn(
                  'min-h-[48px] w-full rounded-lg border bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  error ? 'border-red-500 focus-visible:ring-red-600' : 'border-gray-300 focus-visible:ring-cyan-600'
                )}
              />
            </Field>

            {input.trim() && (
              <>
                <ChoiceGroup
                  label="Page size"
                  tone="cyan"
                  value={pageSize}
                  onChange={setPageSize}
                  options={PAGE_SIZES}
                />
                <InfoNote>
                  Only public pages can be converted: pages behind a login, private network addresses
                  and some heavily scripted sites may fail or come out incomplete.
                </InfoNote>
              </>
            )}

            <div className="flex justify-center">
              <PrimaryButton
                type="submit"
                tone="cyan"
                icon={<Globe className="h-5 w-5" />}
                disabled={!input.trim()}
              >
                Convert to PDF
              </PrimaryButton>
            </div>
          </form>

          {!input.trim() && (
            <FeatureGrid
              tone="cyan"
              items={[
                { icon: Link2, label: 'Just a link', desc: 'No upload needed' },
                { icon: FileCheck2, label: 'A4, Letter, Legal', desc: 'Choose the page size' },
                { icon: Zap, label: 'Fast', desc: 'Usually under a minute' },
              ]}
            />
          )}
          <TrustStrip details={false} />
          <p className="mt-2 text-center text-xs text-gray-600">
            The page is fetched by our server. The PDF is kept for 2 minutes and then deleted.
          </p>
        </ToolPanel>
      )}

      {run.isBusy && (
        <ProcessingCard
          stage="processing"
          fileName={shownUrl}
          title="Converting the page to PDF"
          hint="Our server is loading the page. Slow sites can take up to a minute."
          tone="cyan"
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
          resetLabel="Convert another page"
          onReset={startOver}
          tone="cyan"
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={undefined}
          onRetry={convert}
          onEdit={run.backToEdit}
          editLabel="Change the address"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
