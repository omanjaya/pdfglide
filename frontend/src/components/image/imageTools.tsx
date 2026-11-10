'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

/** Formats every image tool accepts (matches the server: JPG, PNG, WebP, GIF). */
export const IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};
export const IMAGE_TYPE_LABEL = 'JPG, PNG, WebP or GIF';
export const IMAGE_PASTE_HINT = 'You can also paste an image with Ctrl+V.';
/** The server refuses pictures above about this many pixels. */
export const MAX_MEGAPIXELS = 100;

export interface ImageInfo {
  url: string;
  width: number;
  height: number;
  /** The browser could not decode the file (it may still be processable, or corrupt). */
  failed: boolean;
}

/** Object URL + natural size of the selected image. The URL is revoked on change and unmount. */
export function useImageInfo(file: File | undefined): ImageInfo | null {
  const [info, setInfo] = useState<(ImageInfo & { file: File }) | null>(null);
  useEffect(() => {
    if (!file) {
      setInfo(null);
      return;
    }
    const url = URL.createObjectURL(file);
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => !cancelled && setInfo({ file, url, width: img.naturalWidth, height: img.naturalHeight, failed: false });
    img.onerror = () => !cancelled && setInfo({ file, url, width: 0, height: 0, failed: true });
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return info && info.file === file ? info : null;
}

/** Calls `onImage` when an image is pasted from the clipboard (only while `enabled`). */
export function usePasteImage(onImage: (file: File) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: ClipboardEvent) => {
      const found = Array.from(e.clipboardData?.files ?? []).find((f) =>
        Object.keys(IMAGE_ACCEPT).includes(f.type)
      );
      if (found) {
        e.preventDefault();
        onImage(found);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [enabled, onImage]);
}

/** Light checkerboard so transparency is visible. */
export const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0,8px 8px',
};

/** Preview of the selected image with its dimensions and size. */
export function ImagePreview({ file, info }: { file: File; info: ImageInfo | null }) {
  const tooBig = info && !info.failed && (info.width * info.height) / 1e6 > MAX_MEGAPIXELS;
  return (
    <figure className="mt-4">
      <div className="flex min-h-[8rem] items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-3">
        {info && !info.failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.url} alt={`Preview of ${file.name}`} style={CHECKERBOARD_STYLE} className="max-h-64 max-w-full rounded object-contain" />
        ) : (
          <p className="text-sm text-gray-700">
            {info?.failed ? 'This browser cannot show a preview of this file.' : 'Loading preview...'}
          </p>
        )}
      </div>
      <figcaption className="mt-2 text-center text-xs text-gray-700">
        {info && !info.failed ? `${info.width} × ${info.height} px · ` : ''}
        {formatFileSize(file.size)}
      </figcaption>
      {tooBig && (
        <p role="alert" className="mt-2 flex items-start justify-center gap-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          This picture is over {MAX_MEGAPIXELS} megapixels, which is more than the server accepts. It will probably be refused.
        </p>
      )}
    </figure>
  );
}

/** "1.2 MB" style for a possibly-missing number. */
export function bytes(n?: number): string {
  return typeof n === 'number' ? formatFileSize(n) : '';
}

/**
 * True when the picture has see-through pixels (checked on a small copy).
 * `null` while unknown. JPEG never has transparency.
 */
export function useHasTransparency(file: File | undefined, info: ImageInfo | null): boolean | null {
  const [state, setState] = useState<{ url: string; value: boolean } | null>(null);
  const url = info && !info.failed ? info.url : null;
  const canHaveAlpha = !!file && file.type !== 'image/jpeg';
  useEffect(() => {
    if (!url || !canHaveAlpha) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        const scale = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let value = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            value = true;
            break;
          }
        }
        setState({ url, value });
      } catch {
        /* unreadable: stay unknown */
      }
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url, canHaveAlpha]);
  if (!file) return null;
  if (!canHaveAlpha) return false;
  return state && state.url === url ? state.value : null;
}
