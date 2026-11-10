import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
}

/**
 * Tool tile. The whole card is one link. Titles are never truncated: they wrap
 * onto as many lines as needed. On phones the tile is a compact horizontal row
 * (icon left, text right); from the `xs` breakpoint it becomes a grid tile.
 */
export function ToolCard({
  title,
  description,
  href,
  icon: Icon,
  color,
}: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex h-full items-start gap-3 rounded-lg border bg-card p-3 shadow-sm transition-[box-shadow,border-color,transform] duration-200 group-hover:border-primary/30 group-hover:shadow-md group-active:bg-accent/50 motion-safe:group-hover:-translate-y-0.5 sm:p-4">
        <div
          aria-hidden="true"
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 motion-safe:group-hover:scale-105 sm:h-11 sm:w-11',
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-foreground break-words">
            {title}
          </h3>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
