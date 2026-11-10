'use client';

import { useState } from 'react';
import { AlertTriangle, CreditCard, EyeOff, Hash, Mail, Phone, Plus, Search, X } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { OptionsPanel, Field, ChoiceGroup } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { useToolRun } from '@/hooks/useToolRun';
import { redactPdf, redactPdfPatterns, TaskResponse } from '@/lib/api';

type RedactMode = 'terms' | 'patterns';
type PatternType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'custom';

const MODE_OPTIONS: { value: RedactMode; label: string; description: string }[] = [
  { value: 'terms', label: 'Search terms', description: 'Redact specific words or phrases' },
  { value: 'patterns', label: 'Patterns', description: 'Redact emails, phones, SSNs, etc.' },
];

const PATTERN_OPTIONS: { value: PatternType; label: string; description: string; icon: typeof Mail }[] = [
  { value: 'email', label: 'Email addresses', description: 'user@example.com', icon: Mail },
  { value: 'phone', label: 'Phone numbers', description: '+1-234-567-8900', icon: Phone },
  { value: 'ssn', label: 'SSN', description: 'XXX-XX-XXXX', icon: Hash },
  { value: 'credit_card', label: 'Credit cards', description: '1234-5678-9012-3456', icon: CreditCard },
];

const TEXT_INPUT =
  'min-h-[44px] w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/30';

export default function RedactPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<RedactMode>('terms');
  const [terms, setTerms] = useState<string[]>([]);
  const [termInput, setTermInput] = useState('');
  const [patterns, setPatterns] = useState<PatternType[]>([]);
  const [customPattern, setCustomPattern] = useState('');
  const run = useToolRun<TaskResponse['data']>();
  const file = files[0];

  const ready = mode === 'terms' ? terms.length > 0 : patterns.length > 0 || !!customPattern;

  const addTerm = () => {
    const t = termInput.trim();
    if (t && !terms.includes(t)) setTerms([...terms, t]);
    setTermInput('');
  };
  const togglePattern = (p: PatternType) =>
    setPatterns((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const redact = () => {
    if (!file || !ready) return;
    run.run((req) =>
      mode === 'terms'
        ? redactPdf(file, terms, undefined, req)
        : redactPdfPatterns(file, patterns, customPattern || undefined, req)
    );
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setMode('terms');
    setTerms([]);
    setTermInput('');
    setPatterns([]);
    setCustomPattern('');
  };

  return (
    <ToolLayout
      title="Redact PDF"
      description="Permanently remove sensitive information from PDF documents"
      icon={EyeOff}
      tone="indigo"
      status={run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Redact a PDF">
          <FileUploader accept={{ 'application/pdf': ['.pdf'] }} multiple={false} files={files} onFilesChange={setFiles} tone="indigo" typeLabel="PDF" />

          {!file && (
            <FeatureGrid
              tone="indigo"
              items={[
                { icon: Search, label: 'Search terms', desc: 'Words or phrases you list' },
                { icon: Mail, label: 'Patterns', desc: 'Emails, phones, SSNs, cards' },
                { icon: EyeOff, label: 'Permanent', desc: 'Text is removed, not just covered' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <OptionsPanel title="Redaction mode">
                <ChoiceGroup label="What to redact" value={mode} onChange={setMode} options={MODE_OPTIONS} tone="indigo" columns={2} />

                {mode === 'terms' ? (
                  <div className="space-y-3">
                    <Field label="Text to redact" hint="Press Enter or the add button. Each term is blacked out wherever it appears.">
                      <input
                        type="text"
                        value={termInput}
                        onChange={(e) => setTermInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTerm();
                          }
                        }}
                        placeholder="Enter text to redact..."
                        className={TEXT_INPUT}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={addTerm}
                      disabled={!termInput.trim()}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add term
                    </button>
                    {terms.length > 0 && (
                      <ul aria-label="Terms to redact" className="flex flex-wrap gap-2">
                        {terms.map((term) => (
                          <li key={term} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 pl-4 text-sm font-medium text-indigo-800">
                            <span className="max-w-[180px] truncate">{term}</span>
                            <button
                              type="button"
                              onClick={() => setTerms(terms.filter((t) => t !== term))}
                              aria-label={`Remove ${term}`}
                              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-gray-800">Patterns to redact</legend>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {PATTERN_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                          <label
                            key={value}
                            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                          >
                            <input
                              type="checkbox"
                              checked={patterns.includes(value)}
                              onChange={() => togglePattern(value)}
                              className="h-4 w-4 accent-indigo-700"
                            />
                            <Icon className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="block font-medium text-gray-900">{label}</span>
                              <span className="block truncate text-xs text-gray-600">{description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <Field label="Custom regular expression (optional)">
                      <input type="text" value={customPattern} onChange={(e) => setCustomPattern(e.target.value)} placeholder="e.g., \d{3}-\d{2}-\d{4}" className={TEXT_INPUT} />
                    </Field>
                  </div>
                )}
              </OptionsPanel>

              <InfoNote icon={<AlertTriangle className="h-4 w-4 text-amber-700" />} className="bg-amber-50 text-amber-900">
                <strong>Permanent redaction.</strong> Redacted content cannot be recovered: the original text is removed
                from the PDF. Keep your original file.
              </InfoNote>

              <div className="flex flex-col items-center gap-2">
                <PrimaryButton tone="indigo" icon={<EyeOff className="h-5 w-5" />} onClick={redact} disabled={!ready}>
                  Redact PDF
                </PrimaryButton>
                {!ready && (
                  <p className="text-xs text-gray-600">
                    {mode === 'terms' ? 'Add at least one term to continue.' : 'Choose at least one pattern to continue.'}
                  </p>
                )}
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
          title="Finding and removing sensitive text"
          tone="indigo"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && (
        <ResultCard
          title="Your redacted PDF is ready"
          fileName={run.result.file_name}
          fileSize={run.result.file_size}
          downloadUrl={run.result.download_url}
          downloadLabel="Download redacted PDF"
          resetLabel="Redact another PDF"
          onReset={startOver}
          tone="indigo"
        >
          <p className="text-center text-xs text-gray-600">
            Open the file and check that everything you wanted removed is gone before you share it.
          </p>
        </ResultCard>
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={redact}
          onEdit={run.backToEdit}
          editLabel="Change what to redact"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
