import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, blogPosts } from '@/lib/blog';
import { AdBanner } from '@/components/ads/AdBanner';
import { MarkdownContent } from '@/components/shared/MarkdownContent';

interface Props {
  params: { slug: string };
}

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

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://pdfglide.com/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    author: {
      '@type': 'Organization',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'PDFGlide',
      logo: {
        '@type': 'ImageObject',
        url: 'https://pdfglide.com/logo.png',
      },
    },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://pdfglide.com/blog/${post.slug}`,
    },
  };

  // Get related posts (same category, exclude current)
  const relatedPosts = blogPosts
    .filter(p => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <Link
              href="/blog"
              className="text-blue-200 hover:text-white mb-4 inline-flex items-center gap-2"
            >
              ← Kembali ke Blog
            </Link>
            <span className="inline-block px-3 py-1 bg-blue-500 rounded-full text-sm font-medium mb-4 ml-4">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-blue-100 text-sm">
              <span>By {post.author}</span>
              <span>•</span>
              <span>{post.readTime} min read</span>
              <span>•</span>
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 max-w-4xl">
          {/* Ad Banner */}
          <AdBanner slot="article-top" className="mb-8" />

          {/* Content */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12">
            <MarkdownContent content={post.content} />
          </div>

          {/* Ad Banner */}
          <AdBanner slot="article-middle" className="my-8" />

          {/* CTA Box */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 text-white text-center my-8">
            <h3 className="text-2xl font-bold mb-2">Siap Mencoba?</h3>
            <p className="text-blue-100 mb-4">
              Gunakan semua tools PDF gratis tanpa registrasi.
            </p>
            <Link
              href="/"
              className="inline-block bg-white text-blue-600 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Coba PDFGlide Gratis →
            </Link>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                Artikel Terkait
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <Link
                    key={relatedPost.slug}
                    href={`/blog/${relatedPost.slug}`}
                    className="group"
                  >
                    <article className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow">
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                        {relatedPost.description}
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Ad Banner */}
          <AdBanner slot="article-bottom" className="mt-8" />
        </div>
      </article>
    </>
  );
}
