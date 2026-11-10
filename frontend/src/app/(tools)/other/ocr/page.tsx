'use client';

import { useMemo, useState } from 'react';
import { ScanText, Copy, Check, Download, Languages, Image as ImageIcon, FileText } from 'lucide-react';
import { ToolLayout, ToolPanel } from '@/components/shared/ToolLayout';
import { FileUploader } from '@/components/shared/FileUploader';
import { FeatureGrid, InfoNote, TrustStrip } from '@/components/shared/TrustStrip';
import { Field } from '@/components/shared/OptionsPanel';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { ProcessingCard } from '@/components/shared/ProcessingCard';
import { ResultCard } from '@/components/shared/ResultCard';
import { ErrorCard } from '@/components/shared/ErrorCard';
import { OCR_LANGUAGES } from '@/components/shared/ocrLanguages';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToolRun } from '@/hooks/useToolRun';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { api } from '@/lib/api';

interface OcrData {
  task_id: string;
  text: string;
  language: string;
}

const ACCEPT = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export default function OCRPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState('eng');
  const run = useToolRun<OcrData>();
  const { copy, copied, failed } = useCopyToClipboard();
  const file = files[0];
  const text = run.result?.text ?? '';
  const languageLabel = OCR_LANGUAGES.find((l) => l.value === language)?.label ?? language;

  const stats = useMemo(() => {
    const t = text.trim();
    return { words: t ? t.split(/\s+/).length : 0, chars: t.length };
  }, [text]);

  const extract = () => {
    if (!file) return;
    run.run(async (req) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      const response = await api.post('/ocr/extract', formData, req);
      return response.data;
    });
  };
  const startOver = () => {
    run.reset();
    setFiles([]);
    setLanguage('eng');
  };

  // Plain-text download generated in the browser from text we already have (not a server file).
  const downloadText = () => {
    const base = (file?.name || 'extracted-text').replace(/\.[^.]+$/, '');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}-text.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  return (
    <ToolLayout
      title="OCR - Extract Text"
      description="Read the text in photos, screenshots and scanned PDFs."
      icon={ScanText}
      tone="purple"
      status={run.status === 'done' && !text.trim() ? 'No text was found in this file.' : run.announcement}
    >
      {run.status === 'idle' && (
        <ToolPanel aria-label="Extract text with OCR">
          <FileUploader
            accept={ACCEPT}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
            tone="purple"
            typeLabel="PDF, JPG, PNG or WebP"
            hint="Clear, well-lit scans give the best results."
          />

          {!file && (
            <FeatureGrid
              tone="purple"
              items={[
                { icon: ImageIcon, label: 'Photos and scans', desc: 'JPG, PNG, WebP' },
                { icon: FileText, label: 'Scanned PDFs', desc: 'Read page by page' },
                { icon: Languages, label: '9 languages', desc: 'Pick the document language' },
              ]}
            />
          )}

          {file && (
            <div className="mt-6 space-y-5">
              <Field
                label="Document language"
                hint="Choose the language the text is written in. A wrong choice gives garbled results."
              >
                {(a11y) => (
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="min-h-[44px]" {...a11y}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OCR_LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <div className="flex justify-center">
                <PrimaryButton tone="purple" icon={<ScanText className="h-5 w-5" />} onClick={extract}>
                  Extract text
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
          title="Reading the text"
          hint={isPdf ? 'PDFs are read page by page, so long documents take longer.' : 'Reading text usually takes a few seconds.'}
          tone="purple"
          onCancel={run.cancel}
        />
      )}

      {run.status === 'done' && run.result && text.trim() && (
        <ResultCard
          title="Text extracted"
          tone="purple"
          retentionNote={null}
          onReset={startOver}
          resetLabel="Read another file"
          actions={
            <>
              <Button type="button" size="lg" className="min-h-[48px] bg-purple-700 text-base font-semibold text-white hover:bg-purple-800 focus-visible:ring-purple-600" onClick={() => copy(text)}>
                {copied ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                {copied ? 'Copied' : failed ? 'Copy failed' : 'Copy text'}
              </Button>
              <Button type="button" variant="outline" size="lg" className="min-h-[48px]" onClick={downloadText}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                Download .txt
              </Button>
            </>
          }
        >
          <p className="mb-2 text-sm text-gray-600">
            {stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} characters · {languageLabel}
          </p>
          <label htmlFor="ocr-text" className="sr-only">Extracted text</label>
          <textarea
            id="ocr-text"
            readOnly
            value={text}
            rows={12}
            className="max-h-96 min-h-[10rem] w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"
          />
          <p className="mt-2 text-xs text-gray-600">
            OCR can misread characters, so proofread anything important. The text is shown here only: our
            server does not keep a file for you to download.
          </p>
        </ResultCard>
      )}

      {run.status === 'done' && run.result && !text.trim() && (
        <ErrorCard
          title="No text found"
          message={`We could not read any text in this ${isPdf ? 'PDF' : 'image'}. Check that the language is set to ${languageLabel} and that the text is sharp and large enough, then try again.`}
          fileName={file?.name}
          fileSize={file?.size}
          onEdit={run.backToEdit}
          editLabel="Change language or file"
          onReset={startOver}
        />
      )}

      {run.status === 'error' && (
        <ErrorCard
          message={run.error || 'Something went wrong.'}
          fileName={file?.name}
          fileSize={file?.size}
          onRetry={extract}
          onEdit={run.backToEdit}
          editLabel="Change file or language"
          onReset={startOver}
        />
      )}
    </ToolLayout>
  );
}
