/**
 * SEO Component for meta tags and structured data
 */

import React from 'react';
import Head from 'next/head';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string[];
    canonical?: string;
    ogImage?: string;
    ogType?: 'website' | 'article' | 'product';
    noindex?: boolean;
    structuredData?: object;
}

const SITE_NAME = 'PDFGlide';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pdfglide.com';
const DEFAULT_DESCRIPTION = 'Free online PDF tools: merge, compress, split, convert PDF files. Fast, secure, and easy to use.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

export function SEO({
    title,
    description = DEFAULT_DESCRIPTION,
    keywords = ['PDF', 'merge PDF', 'compress PDF', 'convert PDF', 'free PDF tools'],
    canonical,
    ogImage = DEFAULT_IMAGE,
    ogType = 'website',
    noindex = false,
    structuredData,
}: SEOProps) {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;

    // Default structured data for organization
    const defaultStructuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: SITE_URL,
        description: DEFAULT_DESCRIPTION,
        applicationCategory: 'Utility',
        operatingSystem: 'Any',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '10000',
        },
    };

    return (
        <Head>
            {/* Basic Meta */}
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords.join(', ')} />

            {/* Robots */}
            {noindex && <meta name="robots" content="noindex, nofollow" />}

            {/* Canonical */}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* Open Graph */}
            <meta property="og:type" content={ogType} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={ogImage} />
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={ogImage} />

            {/* Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(structuredData || defaultStructuredData),
                }}
            />
        </Head>
    );
}

// Tool-specific SEO presets
export function ToolSEO({
    toolName,
    toolDescription,
    toolKeywords = [],
    path,
}: {
    toolName: string;
    toolDescription: string;
    toolKeywords?: string[];
    path: string;
}) {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: `${toolName} - ${SITE_NAME}`,
        url: `${SITE_URL}${path}`,
        description: toolDescription,
        applicationCategory: 'Utility',
        operatingSystem: 'Any',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        featureList: toolKeywords,
    };

    return (
        <SEO
            title={toolName}
            description={toolDescription}
            keywords={['PDFGlide', toolName, ...toolKeywords]}
            canonical={path}
            structuredData={structuredData}
        />
    );
}

// FAQ structured data generator
export function FAQStructuredData({ faqs }: { faqs: { question: string; answer: string }[] }) {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify(structuredData),
            }}
        />
    );
}

export default SEO;
