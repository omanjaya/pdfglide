import { Metadata } from 'next';
import Link from 'next/link';
import { blogPosts, getFeaturedPosts, getAllCategories } from '@/lib/blog';
import { AdBanner } from '@/components/ads/AdBanner';
import { BlogSearch } from '@/components/blog/BlogSearch';
import { CategoryFilter } from '@/components/blog/CategoryFilter';
import { BlogCard, FeaturedBlogCard } from '@/components/blog/BlogCard';
import {
  Home,
  ChevronRight,
  Sparkles,
  Search,
  FileText,
  ArrowRight,
} from 'lucide-react';

const SITE_URL = 'https://pdfglide.com';

export const metadata: Metadata = {
  title: 'Blog - Tips & Tutorial PDF',
  description:
    'Tips, tutorial, dan panduan lengkap seputar PDF, produktivitas, dan tools digital. Pelajari cara menggunakan PDF tools secara efektif.',
  keywords: [
    'pdf tutorial',
    'tips pdf',
    'panduan pdf',
    'cara edit pdf',
    'pdf tools guide',
  ],
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: 'PDFGlide Blog - Tips & Tutorial PDF',
    description:
      'Tips, tutorial, dan panduan lengkap seputar PDF, produktivitas, dan tools digital.',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
};

// Generate breadcrumb schema
function generateBreadcrumbSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${SITE_URL}/blog`,
      },
    ],
  };
}

// Generate blog listing schema
function generateBlogListingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'PDFGlide Blog',
    description:
      'Tips, tutorial, dan panduan lengkap seputar PDF, produktivitas, dan tools digital.',
    url: `${SITE_URL}/blog`,
    publisher: {
      '@type': 'Organization',
      name: 'PDFGlide',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    blogPost: blogPosts.slice(0, 10).map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: {
        '@type': 'Organization',
        name: post.author,
      },
    })),
  };
}

interface BlogPageProps {
  searchParams: { category?: string; q?: string };
}

export default function BlogPage({ searchParams }: BlogPageProps) {
  const featuredPosts = getFeaturedPosts();
  const categories = getAllCategories();
  const selectedCategory = searchParams.category;
  const searchQuery = searchParams.q?.toLowerCase();

  // Filter posts
  let filteredPosts = [...blogPosts];

  if (selectedCategory) {
    filteredPosts = filteredPosts.filter(
      (post) => post.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }

  if (searchQuery) {
    filteredPosts = filteredPosts.filter(
      (post) =>
        post.title.toLowerCase().includes(searchQuery) ||
        post.description.toLowerCase().includes(searchQuery) ||
        post.keywords.some((k) => k.toLowerCase().includes(searchQuery))
    );
  }

  const breadcrumbSchema = generateBreadcrumbSchema();
  const blogListingSchema = generateBlogListingSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListingSchema) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                backgroundSize: '32px 32px',
              }}
            />
          </div>

          {/* Floating Elements */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl" />

          <div className="relative container mx-auto px-4 py-16">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-6" aria-label="Breadcrumb">
              <Link
                href="/"
                className="flex items-center gap-1 text-blue-200 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <ChevronRight className="w-4 h-4 text-blue-300" />
              <span className="text-white font-medium">Blog</span>
            </nav>

            {/* Title */}
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center gap-3">
                <FileText className="w-10 h-10 md:w-12 md:h-12" />
                PDFGlide Blog
              </h1>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Tips, tutorial, dan panduan lengkap seputar PDF, produktivitas,
                dan tools digital untuk meningkatkan efisiensi kerja Anda.
              </p>

              {/* Search */}
              <BlogSearch />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-12">
          {/* Ad Banner */}
          <AdBanner slot="blog-top" className="mb-8" />

          {/* Category Filter */}
          <CategoryFilter categories={categories} selected={selectedCategory} />

          {/* Search Results Info */}
          {(searchQuery || selectedCategory) && (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Search className="w-5 h-5 text-blue-500" />
                <span>
                  <strong className="text-gray-900 dark:text-white">
                    {filteredPosts.length}
                  </strong>{' '}
                  artikel ditemukan
                  {selectedCategory && (
                    <span>
                      {' '}
                      dalam kategori{' '}
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {selectedCategory}
                      </span>
                    </span>
                  )}
                  {searchQuery && (
                    <span>
                      {' '}
                      untuk &quot;
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {searchQuery}
                      </span>
                      &quot;
                    </span>
                  )}
                </span>
              </div>
              <Link
                href="/blog"
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset filter
              </Link>
            </div>
          )}

          {/* Featured Posts (only show when no filter) */}
          {!searchQuery && !selectedCategory && featuredPosts.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Artikel Populer
                </h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredPosts.map((post) => (
                  <FeaturedBlogCard key={post.slug} post={post} />
                ))}
              </div>
            </section>
          )}

          {/* Ad Banner */}
          <AdBanner slot="blog-middle" className="mb-8" />

          {/* All Posts */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {searchQuery || selectedCategory
                  ? 'Hasil Pencarian'
                  : 'Semua Artikel'}
              </h2>
            </div>

            {filteredPosts.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <Search className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Artikel tidak ditemukan
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                  Tidak ada artikel yang sesuai dengan pencarian Anda. Coba kata
                  kunci lain atau reset filter.
                </p>
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                >
                  Lihat Semua Artikel
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {filteredPosts.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </section>

          {/* Ad Banner */}
          <AdBanner slot="blog-bottom" className="mt-8" />

          {/* CTA Section */}
          <section className="mt-16 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 md:p-12 text-white">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                  backgroundSize: '24px 24px',
                }}
              />
            </div>

            <div className="relative text-center max-w-2xl mx-auto">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Butuh Tools PDF?
              </h3>
              <p className="text-blue-100 mb-8 text-lg">
                Gunakan semua tools PDF gratis tanpa registrasi. Merge, split,
                compress, convert, dan banyak lagi!
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-8 py-4 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
              >
                Coba PDFGlide Gratis
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
