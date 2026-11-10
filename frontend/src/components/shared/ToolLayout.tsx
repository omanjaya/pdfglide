import { HTMLAttributes, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTheme, ToolTone } from './toolThemes';

interface ToolLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /**
   * Legacy: a Tailwind colour class such as "bg-blue-500" or
   * "bg-gradient-to-br from-orange-500 to-red-500". Only used to derive `tone` when
   * `tone` is not given. Prefer `tone`.
   */
  color?: string;
  /** Colour family for the page tint, icon tile, drop zone and buttons. */
  tone?: ToolTone;
  /** Content column width: md = 672px (default), lg = 768px, xl = 1024px. */
  width?: 'md' | 'lg' | 'xl';
  /**
   * Plain-text status for screen readers ("Uploading 40%", "Done", "Failed: ...").
   * Rendered in an always-mounted aria-live region. `useToolRun().announcement` feeds this.
   */
  status?: string;
  children: ReactNode;
}

const WIDTHS = { md: 'max-w-2xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

/**
 * Page shell for every tool page: tinted background, icon tile, h1, one-line description,
 * and a centred content column. Everything else on the page is a child.
 */
export function ToolLayout({
  title,
  description,
  icon: Icon,
  color,
  tone,
  width = 'md',
  status,
  children,
}: ToolLayoutProps) {
  const theme = getTheme(tone, color);
  return (
    <div className={cn('min-h-[calc(100vh-4rem)] bg-gradient-to-br', theme.page)}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-6 text-center sm:mb-8">
          <div
            aria-hidden="true"
            className={cn(
              'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg sm:mb-4 sm:h-16 sm:w-16',
              theme.icon
            )}
          >
            <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 sm:text-base">
            {description}
          </p>
        </header>
        <div className={cn('mx-auto w-full', WIDTHS[width])}>{children}</div>
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {status}
        </div>
      </div>
    </div>
  );
}

/** White rounded card that holds the main interaction (drop zone, options, action). */
export function ToolPanel({
  children,
  className,
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div';
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-8',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
