# Tool page UI guidelines

Reference implementations (copy from these): `src/app/(tools)/document/word-to-pdf/page.tsx` (single file, no options),
`document/pdf-to-word/page.tsx` (collapsible options), `document/html-to-pdf` (non-file input), `other/ocr` (text result),
`other/qr-code` (no upload). All shared pieces live in `src/components/shared/`.

## Page skeleton

```tsx
'use client';
const run = useToolRun<TaskResponse['data']>();            // idle -> uploading -> processing -> done | error
const [files, setFiles] = useState<File[]>([]);            // page owns files + options, so they survive errors
const convert = () => run.run((req) => wordToPdf(files[0], req));   // req = { signal, onUploadProgress }
const startOver = () => { run.reset(); setFiles([]); /* reset options too */ };

<ToolLayout title description icon tone="blue" status={run.announcement}>
  {run.status === 'idle' && (
    <ToolPanel>
      <FileUploader accept multiple={false} files onFilesChange tone="blue" />
      {!files.length && <FeatureGrid items={[...3]} tone="blue" />}
      {files.length > 0 && (<> <OptionsPanel/>…  <PrimaryButton onClick={convert}>Convert</PrimaryButton> </>)}
      <TrustStrip />
    </ToolPanel>
  )}
  {run.isBusy && <ProcessingCard stage={run.status === 'uploading' ? 'uploading' : 'processing'} progress={run.uploadProgress} fileName title onCancel={run.cancel} />}
  {run.status === 'done' && run.result && <ResultCard title fileName={run.result.file_name} fileSize={run.result.file_size} downloadUrl={run.result.download_url} onReset={startOver} />}
  {run.status === 'error' && <ErrorCard message={run.error!} fileName onRetry={convert} onEdit={run.backToEdit} onReset={startOver} />}
</ToolLayout>
```

"Selected" is not a separate state: it is `idle` with `files.length > 0`. Cancel returns to idle with files and options intact.
Retry re-sends the same files and options because the page state is never cleared on error.

## Components (props that matter)

| Component | Props |
|---|---|
| `ToolLayout` | `title, description, icon, tone?, status?, width?='md'\|'lg'\|'xl'`, legacy `color` (tone is derived from it if `tone` is missing). Renders tinted page, icon tile, `<h1>`, aria-live region fed by `status`. |
| `ToolPanel` | white card; wrap the idle UI. `as?`, `className`. |
| `FileUploader` | existing `accept, maxSize=100MB, maxFiles=20, multiple=true, files, onFilesChange` plus `tone, typeLabel, title, hint, reorderable, onReject, disabled`. Shows accepted types and limit, drag state, keyboard (Tab, Enter/Space), clear rejection text (type / too large / too many / empty), file list with size + Remove, "Add more files" (multi), Up/Down (`reorderable`), "Change" (single). Pass `multiple={false}` for single-file tools. |
| `FeatureGrid` | `items: {icon,label,desc}[]` (3), `tone`. Shown under an empty drop zone. |
| `TrustStrip` | `details?=true`. Truthful HTTPS / server / auto-delete wording. Put last in the idle panel. |
| `InfoNote` | `icon?, children`. Expectation lines ("fonts are matched ..."). |
| `OptionsPanel` | `title, description?, icon?, collapsible?, defaultOpen?`. Use `collapsible` for rarely-needed settings. |
| `Field` | `label, hint?, error?, required?`, child control gets `id`/`aria-*`. For nested controls (Radix `Select`) pass a render function: `{(a11y) => <SelectTrigger {...a11y}/>}`. |
| `ChoiceGroup<T>` | `label, value, onChange, options:{value,label,description?}[], tone?, columns?, hint?` real radios, 44px. |
| `PrimaryButton` | `tone, icon?, loading?, loadingText?, block?` + Button props. 48px, AA contrast, `aria-busy`. |
| `ProcessingCard` | `stage:'uploading'\|'queued'\|'processing', progress?, loaded?, total?, serverProgress?, files?, fileName?, fileSize?, title?, hint?, tone?, onCancel?`. See "Processing state" below. |
| `ResultCard` | `title, fileName?, fileSize?, downloadUrl?, downloadLabel?, stats?, children?, actions?, onReset?, resetLabel?, copyLink?, retentionNote?, tone?`. Focuses its heading on mount. |
| `StatTile` | `label, value, accent?` for the `stats` slot (before/after sizes). |
| `ErrorCard` | `message, title?, fileName?, fileSize?, onRetry?, onEdit?, editLabel?, onReset?`. `role="alert"`, focused on mount. |
| `ProcessingStatus` | legacy all-in-one; now renders the cards above. Keep for unconverted pages only. |

Hooks: `useToolRun` (state machine, upload progress, cancel, `announcement`), `useCopyToClipboard`.
Tones: `blue green emerald red orange amber purple cyan pink indigo teal` (`toolThemes.ts`).

## Processing state (top UX priority)
It replaces the form while work runs (no double submit) and is centred on desktop and 390px. It shows the file name(s) and size,
steps `Uploading -> Processing -> Done`, a real upload percentage (bytes sent / total for files >= 1 MB), an indeterminate bar for
the server stage with a tool-specific verb (`title`), elapsed time after 3 s, an honest "keep this tab open" note after 10 s,
and a real Cancel. It never shows a fake server percentage or a time estimate. The stage flips to Processing when the upload
event reports `loaded === total` (inside `useToolRun`), not on a timer.

```tsx
const run = useToolRun<TaskResponse['data']>();
const compress = () => run.run((req) => compressPdf(file, 'medium', req));   // req = { signal, onUploadProgress }
{run.isBusy && (
  <ProcessingCard stage={run.status === 'uploading' ? 'uploading' : 'processing'}
    progress={run.uploadProgress} loaded={run.uploadLoaded} total={run.uploadTotal}
    files={files} title="Compressing your PDF" tone="green" onCancel={run.cancel} />
)}
```
Cancel aborts the request (AbortController) and returns to the form with files and options intact. For polling tools
(`useTaskPolling`): `stage="queued"` while queued, `stage="processing"` with `serverProgress={task.progress}` only when the API reports one.
Non-upload tools (URL, text): pass `stage="processing"` always. Announcements: `<ToolLayout status={run.announcement}>` plus a
`role="status"` line inside the card; focus moves to the result/error heading on completion.

## The site is free
No pricing, plans, upgrade prompts or daily/file-count limits in UI or copy ("Free, no sign-up" is fine). `getErrorMessage` drops
server sentences that mention upgrading. `UpgradeModal` is unused: do not import it.

## Errors
`src/lib/api.ts` turns every failed request into one human sentence (`getErrorMessage(err)`), also assigned to `err.message`
and `err.response.data.detail` by an interceptor. Show `run.error` as is. Do not prefix it, do not map status codes in pages,
do not replace it with a generic message. Every `api.ts` helper takes a trailing `config?: RequestConfig`.

## Wording about files (one source: `toolCopy.ts`)
Files are uploaded to our server. Results are deleted about 2 minutes after the first download, or after 5 minutes if never
downloaded; re-downloading inside that window works. Use `<TrustStrip/>`, `RETENTION_*` constants, or the `ResultCard` default.
Never write your own variant, never say files stay on the device or "are deleted after download" without the timing.

## Download
`ResultCard` renders `<a href={getDownloadUrl(download_url)} download>`; the server's `Content-Disposition` names the file.
Show `file_name` exactly as returned. No `download="x.pdf"`, no blob downloads of server files. Anything that fetches the
download URL (including `<img src>`) starts the delete timer, so say so (see `qr-code`).

## Do / Don't
- Do keep `files` and options in the page; do show the file name and size in processing and error states.
- Do state accepted extensions and limits in the drop zone (`typeLabel`), and expectations in an `InfoNote`.
- Do use `Field`/`ChoiceGroup` so labels are tied to inputs; tap targets >= 44px; hints `text-gray-600` or darker.
- Do put one `<h1>` (ToolLayout) and `<h2>` for sections; never skip levels.
- Don't hand-roll headers, drop zones, spinners or result blocks; don't use `text-gray-400` for text.
- Don't add `animate-*` without `motion-reduce:animate-none`; don't announce status in your own live region.
- Don't claim fidelity ("perfect copy", "exact"); say what is kept and what may differ.
- Don't show options the backend ignores (e.g. html-to-pdf has no orientation).

## Conversion checklist (hand-rolled page -> shared)
1. Pick a `tone` from the page's old colour; keep the icon, title and description text.
2. Replace header + background with `ToolLayout` (`status={run.announcement}`), wrap idle UI in `ToolPanel`.
3. Replace the custom drop zone with `FileUploader` (`multiple`, `reorderable` for merge-like tools, `typeLabel`). Delete local drag handlers and size formatting.
4. Move options into `OptionsPanel`/`Field`/`ChoiceGroup`; keep defaults and the API payload identical.
5. Replace the `useState` status/progress/error/result set with `useToolRun`; call the helper with `(req) => helper(..., req)`.
6. Replace processing/result/error markup with `ProcessingCard`/`ResultCard`/`ErrorCard`; put before/after numbers into `stats`, extra buttons into `actions`, `copyLink` only if the page had it (it now copies the full URL).
7. Replace "files deleted after ..." text with `TrustStrip`; remove claims that contradict `toolCopy.ts`.
8. Async/polling pages: keep `useTaskPolling`/`AsyncProcessingStatus`; wrap only the shell, upload and result/error cards.
9. Check at 1440 and 390: idle, selected, done, error; no horizontal scroll; Tab order; `tsc --noEmit` passes.
