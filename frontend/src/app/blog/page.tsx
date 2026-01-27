'use client';

import Link from 'next/link';
import { blogPosts, getFeaturedPosts } from '@/lib/blog';
import { AdBanner } from '@/components/ads/AdBanner';

export default function BlogPage() {
  const featuredPosts = getFeaturedPosts();
  const recentPosts = blogPosts.slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            PDFGlide Blog
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Tips, tutorial, dan panduan lengkap seputar PDF, produktivitas, dan tools digital.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        {/* Ad Banner */}
        <AdBanner slot="blog-top" className="mb-8" />

        {/* Featured Posts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            Artikel Populer
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {featuredPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group"
              >
                <article className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow h-full">
                  <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-6xl">📄</span>
                  </div>
                  <div className="p-6">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      {post.category}
                    </span>
                    <h3 className="text-lg font-bold mt-2 text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm line-clamp-2">
                      {post.description}
                    </p>
                    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                      <span>{post.readTime} min read</span>
                      <span>{new Date(post.publishedAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        {/* Ad Banner */}
        <AdBanner slot="blog-middle" className="mb-8" />

        {/* All Posts */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            Semua Artikel
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group"
              >
                <article className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">📝</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
                        {post.category}
                      </span>
                      <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                        {post.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{post.readTime} min read</span>
                        <span>{new Date(post.publishedAt).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>

        {/* Ad Banner */}
        <AdBanner slot="blog-bottom" className="mt-8" />
      </div>
    </div>
  );
}
