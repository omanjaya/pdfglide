import { Metadata } from 'next';

const SITE_URL = 'https://pdfglide.com';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'PDFGlide Privacy Policy - Learn how we collect, use, and protect your personal information when using our free online PDF tools.',
  keywords: ['privacy policy', 'data protection', 'pdfglide privacy', 'file security'],
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
  openGraph: {
    title: 'Privacy Policy | PDFGlide',
    description: 'PDFGlide Privacy Policy - Learn how we collect, use, and protect your personal information.',
    url: `${SITE_URL}/privacy`,
    type: 'website',
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = '2024-01-15';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-blue-100">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12">
          <div className="prose prose-lg dark:prose-invert max-w-none">

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                1. Introduction
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Welcome to PDFGlide (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services at pdfglide.com.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                By using PDFGlide, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                2. Information We Collect
              </h2>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                2.1 Files You Upload
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                When you use our PDF tools, you may upload files for processing. These files are:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4 space-y-2">
                <li>Processed on our secure servers</li>
                <li>Automatically deleted within 1 hour after processing</li>
                <li>Never shared with third parties</li>
                <li>Not used for any purpose other than providing the requested service</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                2.2 Automatically Collected Information
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We automatically collect certain information when you visit our website:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4 space-y-2">
                <li>IP address (anonymized for analytics)</li>
                <li>Browser type and version</li>
                <li>Operating system</li>
                <li>Pages visited and time spent</li>
                <li>Referring website</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                2.3 Cookies and Tracking Technologies
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We use cookies and similar tracking technologies to enhance your experience:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Essential cookies:</strong> Required for the website to function properly</li>
                <li><strong>Analytics cookies:</strong> Help us understand how visitors use our site</li>
                <li><strong>Advertising cookies:</strong> Used to show relevant advertisements through Google AdSense</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                3. How We Use Your Information
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We use the collected information for the following purposes:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>To provide and maintain our PDF tools and services</li>
                <li>To improve and optimize our website performance</li>
                <li>To analyze usage patterns and trends</li>
                <li>To detect and prevent technical issues or abuse</li>
                <li>To display relevant advertisements</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                4. File Security
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We take the security of your files seriously:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>All file transfers are encrypted using SSL/TLS (HTTPS)</li>
                <li>Files are stored temporarily in secure, isolated environments</li>
                <li>Automatic deletion occurs within 1 hour of processing</li>
                <li>No human access to uploaded files</li>
                <li>We do not read, analyze, or share the contents of your files</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                5. Third-Party Services
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We use the following third-party services:
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Google AdSense
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We use Google AdSense to display advertisements. Google may use cookies to serve ads based on your prior visits to our website or other websites. You can opt out of personalized advertising by visiting{' '}
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Google Ads Settings
                </a>.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-3">
                Google Analytics
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                We use Google Analytics to understand how visitors interact with our website. This service collects anonymous usage data to help us improve our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                6. Your Rights
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Access:</strong> Request access to your personal data</li>
                <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
                <li><strong>Erasure:</strong> Request deletion of your data</li>
                <li><strong>Portability:</strong> Request transfer of your data</li>
                <li><strong>Objection:</strong> Object to processing of your data</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                7. Children&apos;s Privacy
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                8. Changes to This Policy
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                9. Contact Us
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-none text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Email:</strong> privacy@pdfglide.com</li>
                <li><strong>Website:</strong> <a href="/contact" className="text-blue-600 hover:underline">Contact Page</a></li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
