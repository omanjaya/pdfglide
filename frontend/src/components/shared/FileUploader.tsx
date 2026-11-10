'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { ErrorCode, FileRejection, useDropzone } from 'react-dropzone';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  FileText,
  Image as ImageIcon,
  Plus,
  Upload,
  X,
} from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { getTheme, ToolTone } from './toolThemes';

export interface FileUploaderProps {
  /** react-dropzone accept map, e.g. { 'application/pdf': ['.pdf'] } */
  accept: Record<string, string[]>;
  /** Bytes per file (default 100 MB, the server limit). */
  maxSize?: number;
  /** Max number of files (multi mode only). Default 20. */
  maxFiles?: number;
  /** Several files (merge, image to PDF...) or one. Default true; pass false for single-file tools. */
  multiple?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Colour family; match the page's ToolLayout tone. */
  tone?: ToolTone;
  /** Human label for the accepted types, e.g. "PDF". Derived from `accept` when omitted. */
  typeLabel?: string;
  /** Headline inside the drop zone. Default: "Drag & drop a PDF file here" style text. */
  title?: string;
  /** Extra line under the accepted-types line, e.g. "Add at least 2 files". */
  hint?: string;
  /** Show Up/Down buttons on each file (order matters, e.g. merge). Multi mode only. */
  reorderable?: boolean;
  /** Called once per rejected batch with the human messages (also shown inline). */
  onReject?: (messages: string[]) => void;
  disabled?: boolean;
}

function extensionsOf(accept: Record<string, string[]>): string[] {
  const exts = Object.values(accept).flat();
  return Array.from(new Set(exts.map((e) => e.replace(/^\./, '').toUpperCase())));
}

function joinWords(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`;
}

/**
 * Drop zone + selected-file list. Drag state, keyboard operable (Tab to focus, Enter/Space
 * opens the file dialog), states accepted types and size limit, explains rejections
 * ("wrong type", "too large", "too many files", "empty") and lets the user remove,
 * add more (multi) and reorder (multi, opt-in) files.
 */
export function FileUploader({
  accept,
  maxSize = 100 * 1024 * 1024,
  maxFiles = 20,
  multiple = true,
  files,
  onFilesChange,
  tone,
  typeLabel,
  title,
  hint,
  reorderable = false,
  onReject,
  disabled,
}: FileUploaderProps) {
  const theme = getTheme(tone);
  const [errors, setErrors] = useState<string[]>([]);
  const hintId = useId();
  const errorId = useId();

  const exts = useMemo(() => extensionsOf(accept), [accept]);
  const typesText = typeLabel || exts.join(', ');
  const limit = multiple ? maxFiles : 1;

  // Stable React keys even when files are reordered / removed.
  const ids = useRef(new WeakMap<File, number>());
  const nextId = useRef(0);
  const keyOf = (f: File) => {
    let id = ids.current.get(f);
    if (id === undefined) {
      id = nextId.current++;
      ids.current.set(f, id);
    }
    return id;
  };

  const reportErrors = useCallback(
    (messages: string[]) => {
      setErrors(messages);
      if (messages.length) onReject?.(messages);
    },
    [onReject]
  );

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      const messages: string[] = [];

      if (rejections.length) {
        const tooMany = rejections.some((r) => r.errors.some((e) => e.code === ErrorCode.TooManyFiles));
        if (tooMany && !multiple) {
          messages.push('Please choose one file at a time.');
        } else {
          for (const r of rejections) {
            const code = r.errors[0]?.code;
            const name = `"${r.file.name}"`;
            if (code === ErrorCode.FileInvalidType) {
              messages.push(`${name} is not a supported file type. Please choose a ${typeLabel || joinWords(exts)} file.`);
            } else if (code === ErrorCode.FileTooLarge) {
              messages.push(`${name} is ${formatFileSize(r.file.size)}, which is over the ${formatFileSize(maxSize)} limit.`);
            } else if (code === ErrorCode.FileTooSmall) {
              messages.push(`${name} is empty.`);
            } else {
              messages.push(`${name} could not be added.`);
            }
          }
        }
      }

      const usable = accepted.filter((f) => {
        if (f.size === 0) {
          messages.push(`"${f.name}" is empty (0 bytes), so there is nothing to process.`);
          return false;
        }
        return true;
      });

      if (usable.length) {
        if (multiple) {
          const room = maxFiles - files.length;
          if (usable.length > room) {
            messages.push(
              room > 0
                ? `You can add up to ${maxFiles} files. Added the first ${room}; the rest were skipped.`
                : `You can add up to ${maxFiles} files. Remove one to add another.`
            );
          }
          if (room > 0) onFilesChange([...files, ...usable.slice(0, room)]);
        } else {
          onFilesChange([usable[0]]);
        }
      }

      // Only keep a message list if something was wrong; a clean drop clears old errors.
      reportErrors(Array.from(new Set(messages)));
    },
    [exts, files, maxFiles, maxSize, multiple, onFilesChange, reportErrors]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    disabled,
    // Drop zone is keyboard-focusable itself; the explicit buttons call open().
    noKeyboard: false,
  });

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
    setErrors([]);
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    onFilesChange(next);
  };

  const hasFiles = files.length > 0;
  const showBigZone = !hasFiles || false;
  const showCompactZone = hasFiles && multiple && files.length < maxFiles;

  const headline =
    title ||
    (multiple
      ? `Drag & drop your ${typesText} files here`
      : `Drag & drop a ${exts.length === 1 ? exts[0] + ' ' : ''}file here`);

  const limitsText = multiple
    ? `${typesText} · up to ${formatFileSize(maxSize)} each`
    : `${typesText} · up to ${formatFileSize(maxSize)}`;

  const zone = (compact: boolean) => (
    <div
      {...getRootProps({
        role: 'button',
        'aria-label': compact ? 'Add more files' : `Choose ${multiple ? 'files' : 'a file'}. ${limitsText}`,
        'aria-describedby': [hintId, errors.length ? errorId : ''].filter(Boolean).join(' '),
        className: cn(
          'relative cursor-pointer rounded-2xl border-2 border-dashed text-center transition-colors motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          theme.ring,
          compact ? 'px-4 py-4' : 'px-4 py-8 sm:px-8 sm:py-12',
          isDragActive && isDragReject
            ? 'border-red-500 bg-red-50'
            : isDragActive
              ? theme.dragActive
              : cn('border-gray-300 bg-white', theme.hoverBorder),
          disabled && 'pointer-events-none opacity-50'
        ),
      })}
    >
      {compact ? (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-gray-800">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isDragActive ? 'Drop to add' : 'Add more files'}
          <span className="font-normal text-gray-600">
            ({files.length}/{maxFiles})
          </span>
        </p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className={cn(
              'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20',
              isDragActive && !isDragReject ? 'bg-white' : theme.softStrong
            )}
          >
            <Upload className={cn('h-8 w-8 sm:h-10 sm:w-10', isDragActive && isDragReject ? 'text-red-600' : theme.text)} />
          </div>
          <p className="text-base font-semibold text-gray-800 sm:text-lg">
            {isDragActive && isDragReject ? (
              "This file type isn't supported"
            ) : isDragActive ? (
              multiple ? 'Drop your files here' : 'Drop your file here'
            ) : (
              <>
                <span className="hidden sm:inline">{headline}</span>
                <span className="sm:hidden">Tap to choose {multiple ? 'files' : 'a file'}</span>
              </>
            )}
          </p>
          <p className="mt-1 hidden text-sm text-gray-700 sm:block">
            or <span className={cn('font-semibold underline underline-offset-2', theme.text)}>browse your files</span>
          </p>
          <p id={hintId} className="mt-3 text-xs text-gray-600 sm:mt-4">
            {limitsText}
            {hint && <span className="block">{hint}</span>}
          </p>
        </>
      )}
      {compact && (
        <span id={hintId} className="sr-only">
          {limitsText}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <input {...getInputProps()} aria-label={multiple ? 'Select files' : 'Select a file'} />

      {showBigZone && zone(false)}

      {errors.length > 0 && (
        <div
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <ul className="space-y-1">
            {errors.slice(0, 4).map((m) => (
              <li key={m}>{m}</li>
            ))}
            {errors.length > 4 && <li>and {errors.length - 4} more.</li>}
          </ul>
        </div>
      )}

      {hasFiles && (
        <section aria-label="Selected files" className="space-y-2">
          {multiple && (
            <h2 className="text-sm font-semibold text-gray-800">
              Selected files ({files.length})
            </h2>
          )}
          <ul className="space-y-2">
            {files.map((file, index) => (
              <li
                key={keyOf(file)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3',
                  multiple ? 'border-gray-200 bg-gray-50' : cn('border-transparent', theme.soft)
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg',
                    multiple ? 'h-10 w-10 bg-white' : cn('h-12 w-12', theme.softStrong)
                  )}
                >
                  {file.type.startsWith('image/') ? (
                    <ImageIcon className={cn('h-5 w-5', theme.text)} />
                  ) : (
                    <FileText className={cn('h-5 w-5', theme.text)} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-600">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  {reorderable && multiple && files.length > 1 && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-touch"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Move ${file.name} up`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-touch"
                        disabled={index === files.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Move ${file.name} down`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {!multiple && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="touch"
                      onClick={open}
                      className="text-gray-700"
                    >
                      Change
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-touch"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showCompactZone && zone(true)}
    </div>
  );
}
