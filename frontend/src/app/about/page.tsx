import { Metadata } from 'next';

const SITE_URL = 'https://pdfglide.com';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about PDFGlide - Your trusted free online PDF tools platform. Discover our mission to make document processing accessible to everyone.',
  keywords: ['about pdfglide', 'pdf tools company', 'free pdf software', 'document processing'],
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: {
    title: 'About Us | PDFGlide',
    description: 'Learn about PDFGlide - Your trusted free online PDF tools platform.',
    url: `${SITE_URL}/about`,
    type: 'website',
  },
};

export default function AboutPage() {
  const stats = [
    { number: '1M+', label: 'Files Processed' },
    { number: '50+', label: 'Countries Reached' },
    { number: '25+', label: 'PDF Tools' },
    { number: '99.9%', label: 'Uptime' },
  ];

  const values = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      title: 'Privacy First',
      description: 'Your files are automatically deleted within 1 hour. We never access, read, or share your documents.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Fast & Reliable',
      description: 'Powered by modern cloud infrastructure, our tools process files quickly without compromising quality.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
      ),
      title: 'No Installation',
      description: 'All tools run directly in your browser. No downloads, no plugins, no hassle.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Free to Use',
      description: 'Access all essential PDF tools completely free. No hidden fees, no registration required.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About PDFGlide</h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Making document processing accessible to everyone, everywhere.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-300 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Our Mission
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12">
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                PDFGlide was created with a simple mission: to provide powerful, easy-to-use document tools that are accessible to everyone. We believe that essential productivity tools shouldn&apos;t cost a fortune or require complex software installations.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Whether you&apos;re a student working on assignments, a professional managing documents, or anyone who needs to work with PDFs, our tools are designed to help you get the job done quickly and efficiently.
              </p>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                We&apos;re committed to maintaining the highest standards of privacy and security while continuously improving our tools based on user feedback. Your trust is our top priority.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-12 text-center">
            Our Core Values
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 text-center"
              >
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                  {value.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Offer Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              What We Offer
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">📄</span> PDF Tools
                </h3>
                <ul className="text-gray-600 dark:text-gray-300 space-y-2">
                  <li>Merge, split, and organize PDFs</li>
                  <li>Compress without losing quality</li>
                  <li>Add watermarks and page numbers</li>
                  <li>Protect with passwords</li>
                  <li>Edit and annotate documents</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">🔄</span> Conversion Tools
                </h3>
                <ul className="text-gray-600 dark:text-gray-300 space-y-2">
                  <li>PDF to Word, Excel, PowerPoint</li>
                  <li>Word, Excel to PDF</li>
                  <li>Images to PDF and vice versa</li>
                  <li>HTML to PDF</li>
                  <li>OCR for scanned documents</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">🖼️</span> Image Tools
                </h3>
                <ul className="text-gray-600 dark:text-gray-300 space-y-2">
                  <li>Compress and resize images</li>
                  <li>Convert between formats</li>
                  <li>Remove backgrounds with AI</li>
                  <li>Add watermarks</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="text-2xl">✨</span> Special Features
                </h3>
                <ul className="text-gray-600 dark:text-gray-300 space-y-2">
                  <li>Digital signatures</li>
                  <li>Form filling</li>
                  <li>PDF comparison</li>
                  <li>QR code generation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Try our free PDF tools today. No registration required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Explore Tools
            </a>
            <a
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
