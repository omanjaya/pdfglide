import { Metadata } from 'next';

const SITE_URL = 'https://pdfglide.com';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact PDFGlide - Get help with our free online PDF tools, report issues, or send us your feedback and suggestions.',
  keywords: ['contact pdfglide', 'pdf tools support', 'help', 'feedback', 'customer support'],
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    title: 'Contact Us | PDFGlide',
    description: 'Contact PDFGlide - Get help with our free online PDF tools.',
    url: `${SITE_URL}/contact`,
    type: 'website',
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
