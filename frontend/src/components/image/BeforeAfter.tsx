'use client';

import { useId, useState } from 'react';
import { CHECKERBOARD_STYLE } from './imageTools';

interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  width: number;
  height: number;
  beforeLabel?: string;
  afterLabel?: string;
}

/**
 * Drag-to-compare slider: original on the left, result (on a checkerboard) on the right.
 * Operable with the keyboard through a real range input (arrow keys, Home/End).
 * The result image is loaded once, here.
 */
export function BeforeAfter({ beforeUrl, afterUrl, width, height, beforeLabel = 'Original', afterLabel = 'Result' }: BeforeAfterProps) {
  const [pos, setPos] = useState(50);
  const id = useId();
  const ratio = width > 0 && height > 0 ? width / height : 1;
  return (
    <div className="mx-auto w-full" style={{ maxWidth: `min(100%, calc(60vh * ${ratio}))` }}>
      <div
        className="relative w-full select-none overflow-hidden rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        style={{ aspectRatio: `${ratio}`, ...CHECKERBOARD_STYLE }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt={`${afterLabel} image`} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt={`${beforeLabel} image`} className="absolute inset-0 h-full w-full bg-white object-contain" draggable={false} />
        </div>
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{beforeLabel}</span>
        <span className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{afterLabel}</span>
        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
          <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-700 shadow-lg" aria-hidden="true">
            ↔
          </div>
        </div>
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare original and result"
          aria-valuetext={`${pos}% original, ${100 - pos}% result`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          style={{ touchAction: 'pan-y' }}
        />
      </div>
      <p className="mt-2 text-center text-xs text-gray-600">Drag the slider (or use the arrow keys) to compare. The chequered pattern shows transparent areas.</p>
    </div>
  );
}
