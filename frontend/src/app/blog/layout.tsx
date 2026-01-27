import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog - Tips & Tutorial PDF',
  description: 'Baca artikel, tips, dan tutorial seputar PDF. Cara menggabungkan, kompres, convert, dan edit PDF secara online.',
  keywords: ['blog pdf', 'tutorial pdf', 'tips pdf', 'cara edit pdf', 'panduan pdf'],
  openGraph: {
    title: 'PDFGlide Blog - Tips & Tutorial PDF',
    description: 'Baca artikel, tips, dan tutorial seputar PDF. Cara menggabungkan, kompres, convert, dan edit PDF secara online.',
    url: 'https://pdfglide.com/blog',
    type: 'website',
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
