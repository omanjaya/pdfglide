'use client';

import { useEffect, useRef, useState } from 'react';

export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'tile';

export interface WatermarkSettings {
  kind: 'text' | 'logo';
  text: string;
  /** Object URL of the logo (kind = logo). */
  logoUrl: string | null;
  position: WatermarkPosition;
  /** 0.1 - 1 */
  opacity: number;
  /** Size for a 1000 px wide picture (the server scales it with the image). */
  fontSize: number;
  color: string;
  /** Degrees, clockwise. */
  rotation: number;
  /** Logo width as percent of the image width. */
  imageScale: number;
}

const COLS = { left: 0, center: 1, right: 2 } as const;
const FONT_FAMILY = "'PreviewNotoBold', 'Noto Sans', 'Noto Sans Thai', 'Noto Sans Arabic', 'Noto Sans CJK SC', 'DejaVu Sans', 'Segoe UI', Arial, sans-serif";
const MAX_CANVAS_WIDTH = 1000;

/** The font the server uses for Latin text, loaded once so widths match the output. */
let fontReady: Promise<void> | null = null;
function loadPreviewFont(): Promise<void> {
  if (!fontReady) {
    fontReady =
      typeof FontFace === 'undefined'
        ? Promise.resolve()
        : new FontFace('PreviewNotoBold', 'url(/fonts/NotoSans-Bold-latin.woff2)', { weight: '700' })
            .load()
            .then((f) => {
              document.fonts.add(f);
            })
            .catch(() => undefined);
  }
  return fontReady;
}

/** Python's floor division / round semantics, so geometry matches the server pixel for pixel. */
const floorDiv = (a: number, b: number) => Math.floor(a / b);
function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  return d < 0.5 ? f : d > 0.5 ? f + 1 : f % 2 === 0 ? f : f + 1;
}

/** Size of a w x h box after rotating it by `deg` with expand=True. */
function rotatedBox(w: number, h: number, deg: number): [number, number] {
  if (deg % 360 === 0) return [w, h];
  const r = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return [Math.ceil(w * c + h * s - 1e-6), Math.ceil(w * s + h * c - 1e-6)];
}

interface Props {
  imageUrl: string;
  width: number;
  height: number;
  settings: WatermarkSettings;
  /** Shown to assistive tech. */
  label: string;
}

/**
 * Live preview that follows backend/app/processors/image/watermark.py:
 *  - font size = round(font_size * max(width, height) / 1000), minimum 8 px, in picture pixels
 *  - margin = max(8, round(0.04 * min(width, height))), 3 x 3 grid positions, tile spacing 1.6 x 2.4
 *  - rotation is clockwise, opacity multiplies the glyph/logo alpha
 * All geometry is computed in picture pixels and the canvas is scaled to the display size,
 * so the preview is the output scaled down.
 */
export function WatermarkPreview({ imageUrl, width, height, settings, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [base, setBase] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontTick, setFontTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPreviewFont().then(() => !cancelled && setFontTick((t) => t + 1));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setBase(img);
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!settings.logoUrl) {
      setLogo(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setLogo(img);
    img.src = settings.logoUrl;
  }, [settings.logoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !base) return;
    const cw = Math.min(width, MAX_CANVAS_WIDTH);
    const s = cw / width;
    canvas.width = cw;
    canvas.height = Math.max(1, Math.round(height * s));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(s, 0, 0, canvas.height / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base, 0, 0, width, height);

    const { kind, text, position, opacity, fontSize, color, rotation, imageScale } = settings;
    const useLogo = kind === 'logo' && logo;
    const label = text.trim() || (kind === 'text' ? 'Your watermark' : '');
    if (!useLogo && !label) return;

    // --- watermark "tile" size in picture pixels (before rotation)
    let tw: number;
    let th: number;
    let draw: (cx: number, cy: number) => void;
    if (useLogo && logo) {
      tw = Math.max(8, pyRound((width * imageScale) / 100));
      th = Math.max(1, pyRound((logo.naturalHeight * tw) / logo.naturalWidth));
      draw = (cx, cy) => ctx.drawImage(logo, -tw / 2, -th / 2, tw, th);
    } else {
      const px = Math.max(8, pyRound((fontSize * Math.max(width, height)) / 1000));
      ctx.font = `700 ${px}px ${FONT_FAMILY}`;
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const m = ctx.measureText(label);
      const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const pad = Math.max(2, floorDiv(px, 8));
      tw = Math.ceil(inkW) + 2 * pad;
      th = Math.ceil(inkH) + 2 * pad;
      const dx = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
      const dy = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
      draw = () => {
        ctx.fillStyle = color;
        ctx.fillText(label, -dx, -dy);
      };
    }
    const [rw, rh] = rotatedBox(tw, th, rotation);

    const place = (x: number, y: number) => {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(x + rw / 2, y + rh / 2);
      ctx.rotate((rotation * Math.PI) / 180); // canvas rotation is clockwise, like the server
      draw(0, 0);
      ctx.restore();
    };

    if (position === 'tile') {
      const stepX = pyRound(rw * 1.6);
      const stepY = pyRound(rh * 2.4);
      let row = 0;
      for (let y = floorDiv(-rh, 2); y < height; y += stepY, row++) {
        const shift = row % 2 ? floorDiv(stepX, 2) : 0;
        for (let x = floorDiv(-rw, 2) + shift - stepX; x < width; x += stepX) place(x, y);
      }
    } else {
      const [rowName, colName] = (position === 'center' ? ['center', 'center'] : position.split('-')) as ['top' | 'center' | 'bottom', keyof typeof COLS];
      const col = COLS[colName];
      const row = { top: 0, center: 1, bottom: 2 }[rowName];
      const margin = Math.max(8, pyRound(0.04 * Math.min(width, height)));
      const x = [margin, floorDiv(width - rw, 2), width - rw - margin][col];
      const y = [margin, floorDiv(height - rh, 2), height - rh - margin][row];
      place(x, y);
    }
  }, [base, logo, settings, width, height, fontTick]);

  return <canvas ref={canvasRef} role="img" aria-label={label} className="mx-auto block max-h-[60vh] max-w-full rounded-lg border border-gray-200 bg-white" />;
}
