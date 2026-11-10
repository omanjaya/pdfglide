import { MetadataRoute } from 'next';
import { toolsMetadata } from '@/lib/seo';
import { blogPosts } from '@/lib/blog';

const SITE_URL = 'https://pdfglide.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  // Tool pages from metadata
  const toolPages: MetadataRoute.Sitemap = Object.values(toolsMetadata).map((tool) => ({
    url: `${SITE_URL}${tool.path}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...toolPages, ...blogPages];
}
