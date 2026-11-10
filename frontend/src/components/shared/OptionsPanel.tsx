'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useId,
  useState,
} from 'react';
import { ChevronDown, LucideIcon, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTheme, ToolTone } from './toolThemes';

interface OptionsPanelProps {
  title: string;
  /** One line under the title; use it to say when the options matter. */
  description?: string;
  icon?: LucideIcon;
  /** Collapsible (default false = always open). */
  collapsible?: boolean;
  /** Initial state when collapsible (default false = closed). */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Groups a tool's settings. Always-open by default; `collapsible` tucks advanced
 * settings away behind a 44px toggle (aria-expanded) for options that rarely matter.
 */
export function OptionsPanel({
  title,
  description,
  icon: Icon = Settings2,
  collapsible = false,
  defaultOpen = false,
  children,
  className,
}: OptionsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const expanded = !collapsible || open;

  const header = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-gray-900">{title}</span>
        {description && <span className="block text-xs text-gray-600">{description}</span>}
      </span>
      {collapsible && (
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-gray-500 transition-transform motion-reduce:transition-none', open && 'rotate-180')}
          aria-hidden="true"
        />
      )}
    </>
  );

  return (
    <section className={cn('rounded-xl border border-gray-200 bg-gray-50/60', className)} aria-label={title}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {header}
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 pt-4">{header}</div>
      )}
      <div id={bodyId} hidden={!expanded} className="space-y-4 px-4 pb-4 pt-3">
        {children}
      </div>
    </section>
  );
}

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

interface FieldProps {
  label: string;
  /** Helper text under the control (linked with aria-describedby). */
  hint?: ReactNode;
  /** Validation message (role=alert, linked, sets aria-invalid on the control). */
  error?: string | null;
  required?: boolean;
  /**
   * One control element (<input/>, <textarea/>) which receives id/aria-* automatically, or a
   * render function when the control is nested (Radix Select: put `id` on <SelectTrigger>).
   */
  children: ReactElement | ((a11y: FieldControlProps) => ReactElement);
  className?: string;
}

/** Label + control + hint + error, correctly wired for screen readers. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  const a11y: FieldControlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
  };
  let control: ReactNode;
  if (typeof children === 'function') {
    control = children(a11y);
  } else {
    const child = Children.only(children);
    control = isValidElement(child)
      ? cloneElement(child as ReactElement<Record<string, unknown>>, { ...a11y })
      : child;
  }
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
        {required && <span className="text-red-700" aria-hidden="true"> *</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-xs text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
}

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: ChoiceOption<T>[];
  tone?: ToolTone;
  /** Columns from `xs` up (default = number of options, max 4). Mobile is always 1-2 columns. */
  columns?: 2 | 3 | 4;
  hint?: string;
  className?: string;
}

/**
 * Segmented single choice (page size, orientation, quality preset). Real radio inputs
 * under the hood: arrow keys work, 44px tall, selected state is not colour-only (check mark).
 */
export function ChoiceGroup<T extends string | number>({
  label,
  value,
  onChange,
  options,
  tone,
  columns,
  hint,
  className,
}: ChoiceGroupProps<T>) {
  const theme = getTheme(tone);
  const name = useId();
  const cols = columns ?? (Math.min(options.length, 4) as 2 | 3 | 4);
  const colClass = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[
    Math.max(2, cols) as 2 | 3 | 4
  ];
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="text-sm font-medium text-gray-800">{label}</legend>
      <div className={cn('grid gap-2', colClass)}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <label
              key={String(opt.value)}
              className={cn(
                'relative flex min-h-[44px] cursor-pointer flex-col justify-center rounded-lg border-2 bg-white px-3 py-2 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                selected ? cn(theme.border, theme.soft, theme.text, 'font-semibold') : 'border-gray-200 text-gray-800 hover:border-gray-300'
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(opt.value)}
                checked={selected}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span>{opt.label}</span>
              {opt.description && (
                <span className={cn('text-xs font-normal', selected ? theme.text : 'text-gray-600')}>
                  {opt.description}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {hint && <p className="text-xs text-gray-600">{hint}</p>}
    </fieldset>
  );
}
