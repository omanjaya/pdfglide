import Link from 'next/link';
import { BlogPost } from '@/lib/blog';
import {
  BookOpen,
  Star,
  Lightbulb,
  Newspaper,
  FileText,
  Clock,
  Calendar,
  ArrowRight,
  Sparkles,
  type LucideIcon
} from 'lucide-react';

interface BlogCardProps {
  post: BlogPost;
}

// Category configuration with icons and gradients
const categoryConfig: Record<string, { icon: LucideIcon; gradient: string; bgGradient: string }> = {
  Tutorial: {
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10'
  },
  Review: {
    icon: Star,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/10 to-pink-500/10'
  },
  Tips: {
    icon: Lightbulb,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/10 to-orange-500/10'
  },
  News: {
    icon: Newspaper,
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/10 to-emerald-500/10'
  },
  Guide: {
    icon: FileText,
    gradient: 'from-indigo-500 to-blue-500',
    bgGradient: 'from-indigo-500/10 to-blue-500/10'
  },
};

export function FeaturedBlogCard({ post }: BlogCardProps) {
  const config = categoryConfig[post.category] || {
    icon: FileText,
    gradient: 'from-blue-500 to-purple-600',
    bgGradient: 'from-blue-500/10 to-purple-500/10'
  };
  const Icon = config.icon;

  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <article className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden h-full border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800">
        {/* Thumbnail */}
        <div className={`relative h-52 bg-gradient-to-br ${config.gradient} overflow-hidden`}>
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }} />
          </div>

          {/* Floating Elements */}
          <div className="absolute top-4 left-4 w-16 h-16 bg-white/10 rounded-2xl blur-xl" />
          <div className="absolute bottom-8 right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl scale-150" />
              <div className="relative bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/30">
                <Icon className="w-10 h-10 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Featured Badge */}
          {post.featured && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-yellow-400/90 backdrop-blur-sm text-yellow-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
              <Sparkles className="w-3.5 h-3.5" />
              Featured
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Category & Read Time */}
          <div className="flex items-center gap-3 mb-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gradient-to-r ${config.bgGradient}`}>
              <Icon className="w-3.5 h-3.5" />
              {post.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3.5 h-3.5" />
              {post.readTime} min
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-3">
            {post.title}
          </h3>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mb-4">
            {post.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
              Baca
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function BlogCard({ post }: BlogCardProps) {
  const config = categoryConfig[post.category] || {
    icon: FileText,
    gradient: 'from-blue-500 to-purple-600',
    bgGradient: 'from-blue-500/10 to-purple-500/10'
  };
  const Icon = config.icon;

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <article className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800">
        <div className="flex">
          {/* Thumbnail */}
          <div className={`relative w-28 md:w-36 flex-shrink-0 bg-gradient-to-br ${config.gradient}`}>
            {/* Pattern */}
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '16px 16px'
            }} />

            {/* Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30 transform group-hover:scale-110 transition-transform duration-300">
                <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 p-5">
            {/* Category & Meta */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-gradient-to-r ${config.bgGradient}`}>
                <Icon className="w-3 h-3" />
                {post.category}
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                {post.readTime} min
              </span>
            </div>

            {/* Title */}
            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
              {post.title}
            </h3>

            {/* Description (hidden on mobile) */}
            <p className="hidden md:block text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-3">
              {post.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3" />
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </time>
              </div>
              <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Baca selengkapnya
                <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Hover Accent Line */}
        <div className={`absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full bg-gradient-to-r ${config.gradient} transition-all duration-300`} />
      </article>
    </Link>
  );
}
