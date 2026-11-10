'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import type { WatermarkPosition } from './WatermarkPreview';

const GRID: WatermarkPosition[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const NAMES: Record<WatermarkPosition, string> = {
  'top-left': 'Top left', 'top-center': 'Top centre', 'top-right': 'Top right',
  'center-left': 'Middle left', center: 'Centre', 'center-right': 'Middle right',
  'bottom-left': 'Bottom left', 'bottom-center': 'Bottom centre', 'bottom-right': 'Bottom right',
  tile: 'Repeat across the image',
};

/** 3 x 3 grid of positions plus "Repeat" (tile). Real radio inputs: arrow keys work. */
export function PositionPicker({ value, onChange }: { value: WatermarkPosition; onChange: (v: WatermarkPosition) => void }) {
  const name = useId();
  const cell = (p: WatermarkPosition, className: string, content: React.ReactNode) => (
    <label
      key={p}
      title={NAMES[p]}
      className={cn(
        'relative flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border-2 bg-white text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        value === p ? 'border-indigo-600 bg-indigo-50 font-semibold text-indigo-800' : 'border-gray-200 text-gray-700 hover:border-gray-300',
        className
      )}
    >
      <input type="radio" name={name} value={p} checked={value === p} onChange={() => onChange(p)} className="sr-only" aria-label={NAMES[p]} />
      {content}
    </label>
  );
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-800">Position</legend>
      <div className="flex flex-col gap-2 xs:flex-row xs:items-stretch">
        <div className="grid w-full max-w-[220px] grid-cols-3 gap-1.5">
          {GRID.map((p) =>
            cell(p, 'aspect-square', (
              <span aria-hidden="true" className={cn('h-3 w-3 rounded-full', value === p ? 'bg-indigo-600' : 'bg-gray-300')} />
            ))
          )}
        </div>
        {cell('tile', 'px-4 xs:ml-2 xs:self-start', <span>Repeat</span>)}
      </div>
      <p className="text-xs text-gray-600">{NAMES[value]}</p>
    </fieldset>
  );
}
