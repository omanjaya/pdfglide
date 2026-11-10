import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, blogPosts } from '@/lib/blog';
import { AdBanner } from '@/components/ads/AdBanner';
import { MarkdownContent } from '@/components/shared/MarkdownContent';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { TableOfContents } from '@/components/blog/TableOfContents';
import {
  Home,
  ChevronRight,
  Clock,
  Calendar,
  User,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  BookOpen,
  Star,
  Lightbulb,
  Newspaper,
  FileText,
  Hash,
  type LucideIcon,
} from 'lucide-react';

const SITE_URL = 'https://pdfglide.com';

interface Props {
  params: { slug: string };
}

// Category configuration
const categoryConfig: Record<
  string,
  { icon: LucideIcon; gradient: string; bgGradient: string }
> = {
  Tutorial: {
    icon: BookOpen,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
  Review: {
    icon: Star,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
  },
  Tips: {
    icon: Lightbulb,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-500/10 to-orange-500/10',
  },
  News: {
    icon: Newspaper,
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/10 to-emerald-500/10',
  },
  Guide: {
    icon: FileText,
    gradient: 'from-indigo-500 to-blue-500',
    bgGradient: 'from-indigo-500/10 to-blue-500/10',
  },
};

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost(params.slug);

  if (!post) {
    return {
      title: 'Artikel Tidak Ditemukan',
    };
  }

  const url = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

// Generate breadcrumb schema
function generateBreadcrumbSchema(post: {
  title: string;
  slug: string;
  category: string;
}) {
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
      {
        '@type': 'ListItem',
        position: 3,
        name: post.category,
        item: `${SITE_URL}/blog?category=${post.category}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: post.title,
        item: `${SITE_URL}/blog/${post.slug}`,
      },
    ],
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  const articleUrl = `${SITE_URL}/blog/${post.slug}`;

  const config = categoryConfig[post.category] || {
    icon: FileText,
    gradient: 'from-blue-500 to-purple-600',
    bgGradient: 'from-blue-500/10 to-purple-500/10',
  };
  const CategoryIcon = config.icon;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: `${SITE_URL}/og-image.png`,
    author: {
      '@type': 'Organization',
      name: post.author,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'PDFGlide',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    keywords: post.keywords.join(', '),
    articleSection: post.category,
    wordCount: post.content.split(/\s+/).length,
  };

  const breadcrumbSchema = generateBreadcrumbSchema(post);

  // Get related posts (same category, exclude current)
  const relatedPosts = blogPosts
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <article className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-900">
        {/* Header */}
        <header className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
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

          <div className="relative container mx-auto px-4 py-12 max-w-4xl">
            {/* Breadcrumb */}
            <nav
              className="flex items-center gap-2 text-sm mb-6 flex-wrap"
              aria-label="Breadcrumb"
            >
              <Link
                href="/"
                className="flex items-center gap-1 text-blue-200 hover:text-white transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <ChevronRight className="w-4 h-4 text-blue-300" />
              <Link
                href="/blog"
                className="text-blue-200 hover:text-white transition-colors"
              >
                Blog
              </Link>
              <ChevronRight className="w-4 h-4 text-blue-300" />
              <Link
                href={`/blog?category=${post.category}`}
                className="text-blue-200 hover:text-white transition-colors"
              >
                {post.category}
              </Link>
            </nav>

            {/* Category Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${config.gradient} rounded-full text-sm font-semibold shadow-lg`}
              >
                <CategoryIcon className="w-4 h-4" />
                {post.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-6 text-blue-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-white">
                    {post.author}
                  </span>
                  <span className="block text-xs text-blue-200">Author</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-sm font-medium text-white">
                    {post.readTime} min
                  </span>
                  <span className="block text-xs text-blue-200">Read time</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <time
                    dateTime={post.publishedAt}
                    className="block text-sm font-medium text-white"
                  >
                    {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                  <span className="block text-xs text-blue-200">Published</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 max-w-6xl">
          {/* Ad Banner */}
          <AdBanner slot="article-top" className="mb-8" />

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-8">
            {/* Content Column */}
            <div className="min-w-0">
              {/* Article Content */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 md:p-10">
                {/* Table of Contents (Mobile) */}
                <div className="lg:hidden mb-8">
                  <TableOfContents content={post.content} />
                </div>

                {/* Content */}
                <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline">
                  <MarkdownContent content={post.content} />
                </div>

                {/* Tags */}
                <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Hash className="w-4 h-4" />
                    <span>Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.keywords.slice(0, 6).map((keyword) => (
                      <Link
                        key={keyword}
                        href={`/blog?q=${encodeURIComponent(keyword)}`}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {keyword}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Share Buttons */}
                <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                  <ShareButtons
                    url={articleUrl}
                    title={post.title}
                    description={post.description}
                  />
                </div>
              </div>

              {/* Ad Banner */}
              <AdBanner slot="article-middle" className="my-8" />

              {/* CTA Box */}
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 text-white">
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

                <div className="relative text-center">
                  <Sparkles className="w-10 h-10 mx-auto mb-4 text-yellow-400" />
                  <h3 className="text-2xl font-bold mb-2">Siap Mencoba?</h3>
                  <p className="text-blue-100 mb-6">
                    Gunakan semua tools PDF gratis tanpa registrasi.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
                  >
                    Coba PDFGlide Gratis
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Sidebar (Desktop) */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                {/* Table of Contents */}
                <TableOfContents content={post.content} />

                {/* Share Buttons Sidebar */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
                  <ShareButtons
                    url={articleUrl}
                    title={post.title}
                    description={post.description}
                  />
                </div>

                {/* Ad Banner Sidebar */}
                <AdBanner slot="article-sidebar" />
              </div>
            </aside>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-16">
              <div className="flex items-center gap-2 mb-8">
                <FileText className="w-6 h-6 text-blue-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Artikel Terkait
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => {
                  const relatedConfig = categoryConfig[relatedPost.category] || {
                    icon: FileText,
                    gradient: 'from-blue-500 to-purple-600',
                  };
                  const RelatedIcon = relatedConfig.icon;

                  return (
                    <Link
                      key={relatedPost.slug}
                      href={`/blog/${relatedPost.slug}`}
                      className="group block"
                    >
                      <article className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all overflow-hidden h-full">
                        <div
                          className={`h-32 bg-gradient-to-br ${relatedConfig.gradient} flex items-center justify-center relative overflow-hidden`}
                        >
                          {/* Pattern */}
                          <div
                            className="absolute inset-0 opacity-20"
                            style={{
                              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                              backgroundSize: '16px 16px',
                            }}
                          />
                          <div className="relative bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30 transform group-hover:scale-110 transition-transform">
                            <RelatedIcon
                              className="w-6 h-6 text-white"
                              strokeWidth={1.5}
                            />
                          </div>
                        </div>
                        <div className="p-5">
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">
                            {relatedPost.category}
                          </span>
                          <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mt-2 mb-2">
                            {relatedPost.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {relatedPost.description}
                          </p>
                        </div>
                      </article>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Back to Blog */}
          <div className="mt-12 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Kembali ke Blog
            </Link>
          </div>

          {/* Ad Banner */}
          <AdBanner slot="article-bottom" className="mt-8" />
        </div>
      </article>
    </>
  );
}
