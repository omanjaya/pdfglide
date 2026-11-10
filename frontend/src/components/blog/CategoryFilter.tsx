'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  LayoutGrid,
  BookOpen,
  Star,
  Lightbulb,
  Newspaper,
  FileText,
  type LucideIcon
} from 'lucide-react';

interface CategoryFilterProps {
  categories: string[];
  selected?: string;
}

const categoryConfig: Record<string, { icon: LucideIcon; gradient: string }> = {
  Tutorial: {
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-500'
  },
  Review: {
    icon: Star,
    gradient: 'from-purple-500 to-pink-500'
  },
  Tips: {
    icon: Lightbulb,
    gradient: 'from-amber-500 to-orange-500'
  },
  News: {
    icon: Newspaper,
    gradient: 'from-green-500 to-emerald-500'
  },
  Guide: {
    icon: FileText,
    gradient: 'from-indigo-500 to-blue-500'
  },
};

export function CategoryFilter({ categories, selected }: CategoryFilterProps) {
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q');

  const buildUrl = (category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (currentQuery) params.set('q', currentQuery);
    const queryString = params.toString();
    return queryString ? `/blog?${queryString}` : '/blog';
  };

  return (
    <div className="mb-8">
      <div className="flex flex-wrap gap-3">
        {/* All Categories Button */}
        <Link
          href={buildUrl()}
          className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            !selected
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
          }`}
        >
          <LayoutGrid className={`w-4 h-4 ${!selected ? '' : 'text-gray-400 group-hover:text-blue-500'}`} />
          <span>Semua</span>
        </Link>

        {/* Category Buttons */}
        {categories.map((category) => {
          const config = categoryConfig[category] || {
            icon: FileText,
            gradient: 'from-gray-500 to-gray-600'
          };
          const Icon = config.icon;
          const isSelected = selected?.toLowerCase() === category.toLowerCase();

          return (
            <Link
              key={category}
              href={buildUrl(category)}
              className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isSelected
                  ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? '' : 'text-gray-400 group-hover:text-blue-500'}`} />
              <span>{category}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
