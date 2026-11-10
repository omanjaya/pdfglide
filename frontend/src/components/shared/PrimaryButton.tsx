'use client';

import { forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getTheme, ToolTone } from './toolThemes';

interface PrimaryButtonProps extends Omit<ButtonProps, 'size' | 'variant' | 'asChild'> {
  tone?: ToolTone;
  /** Leading icon shown when not loading. */
  icon?: ReactNode;
  loading?: boolean;
  /** Label while loading, e.g. "Converting...". */
  loadingText?: string;
  /** Full width on mobile, auto from `xs` up (default true). */
  block?: boolean;
}

/**
 * The one big call-to-action on a tool page ("Convert to PDF"). 48px tall, tone-coloured
 * (AA contrast), disabled + aria-busy while loading, spinner respects reduced motion.
 */
export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ tone, icon, loading, loadingText, block = true, children, className, disabled, ...props }, ref) => {
    const theme = getTheme(tone);
    return (
      <Button
        ref={ref}
        size="lg"
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          'min-h-[48px] px-8 text-base font-semibold shadow-sm',
          theme.solid,
          theme.ring,
          block && 'w-full xs:w-auto',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          icon && <span className="mr-2 inline-flex" aria-hidden="true">{icon}</span>
        )}
        {loading ? loadingText || 'Working...' : children}
      </Button>
    );
  }
);
PrimaryButton.displayName = 'PrimaryButton';
