import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface ToolCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
}

export function ToolCard({
  title,
  description,
  href,
  icon: Icon,
  color,
}: ToolCardProps) {
  return (
    <Link href={href} className="block h-full">
      <Card className="group h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/20 hover:-translate-y-0.5">
        <div className="flex h-full flex-col p-4 sm:p-5">
          {/* Icon and Title Row */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 group-hover:scale-105',
                color
              )}
            >
              <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
            </div>
            <h3 className="font-semibold text-sm sm:text-base leading-tight line-clamp-1">
              {title}
            </h3>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-grow">
            {description}
          </p>
        </div>
      </Card>
    </Link>
  );
}
