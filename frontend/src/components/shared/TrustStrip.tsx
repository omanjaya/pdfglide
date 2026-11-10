import { ReactNode } from 'react';
import { BadgeCheck, Clock, Lock, Server, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTheme, ToolTone } from './toolThemes';
import { RETENTION_FULL } from './toolCopy';

const TRUST_ICONS: { icon: LucideIcon; label: string }[] = [
  { icon: BadgeCheck, label: 'Free, no sign-up' },
  { icon: Lock, label: 'Secure upload (HTTPS)' },
  { icon: Server, label: 'Processed on our server' },
  { icon: Clock, label: 'Auto-deleted after download' },
];

/**
 * Small trust / expectations strip. Always the same truthful wording (see toolCopy.ts).
 * Put it at the bottom of the idle panel. `details` (default true) adds the full
 * retention sentence under the chips.
 */
export function TrustStrip({
  className,
  details = true,
}: {
  className?: string;
  details?: boolean;
}) {
  return (
    <div className={cn('mt-6 border-t border-gray-100 pt-4 text-center', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {TRUST_ICONS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      {details && <p className="mx-auto mt-2 max-w-md text-xs text-gray-600">{RETENTION_FULL}</p>}
    </div>
  );
}

export interface FeatureItem {
  icon: LucideIcon;
  label: string;
  desc: string;
}

/** Three small "why this tool" tiles under the drop zone (lifted from Compress PDF). */
export function FeatureGrid({
  items,
  tone,
  className,
}: {
  items: FeatureItem[];
  tone?: ToolTone;
  className?: string;
}) {
  const theme = getTheme(tone);
  return (
    <ul className={cn('mt-6 grid grid-cols-1 gap-3 xs:grid-cols-3', className)}>
      {items.map(({ icon: Icon, label, desc }) => (
        <li
          key={label}
          className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 text-left xs:flex-col xs:gap-0 xs:p-4 xs:text-center"
        >
          <div
            aria-hidden="true"
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              theme.softStrong
            )}
          >
            <Icon className={cn('h-5 w-5', theme.text)} />
          </div>
          <div className="xs:mt-2">
            <p className="text-sm font-medium text-gray-800">{label}</p>
            <p className="text-xs text-gray-600">{desc}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Inline note, e.g. "Fonts are matched to the closest available typeface." */
export function InfoNote({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-700 sm:text-sm',
        className
      )}
    >
      {icon && <span className="mt-0.5 shrink-0 text-gray-500">{icon}</span>}
      <div>{children}</div>
    </div>
  );
}
