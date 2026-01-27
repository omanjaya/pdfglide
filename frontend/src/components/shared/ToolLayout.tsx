import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  children: ReactNode;
}

export function ToolLayout({
  title,
  description,
  icon: Icon,
  color,
  children,
}: ToolLayoutProps) {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8 text-center">
        <div
          className={cn(
            'mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl text-white shadow-md',
            color
          )}
        >
          <Icon className="h-6 w-6 sm:h-8 sm:w-8" />
        </div>
        <h1 className="mb-1.5 sm:mb-2 text-2xl sm:text-3xl font-bold">{title}</h1>
        <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-2">
          {description}
        </p>
      </div>
      <div className="mx-auto max-w-3xl">{children}</div>
    </div>
  );
}
