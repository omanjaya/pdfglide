import { Metadata } from 'next';

const SITE_URL = 'https://pdfglide.com';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'PDFGlide Terms of Service - Read our terms and conditions for using our free online PDF tools and services.',
  keywords: ['terms of service', 'terms and conditions', 'pdfglide terms', 'user agreement'],
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
  openGraph: {
    title: 'Terms of Service | PDFGlide',
    description: 'PDFGlide Terms of Service - Read our terms and conditions for using our services.',
    url: `${SITE_URL}/terms`,
    type: 'website',
  },
};

export default function TermsOfServicePage() {
  const lastUpdated = '2024-01-15';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-blue-100">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 md:p-12">
          <div className="prose prose-lg dark:prose-invert max-w-none">

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                By accessing or using PDFGlide (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, please do not use our Service.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                These Terms apply to all visitors, users, and others who access or use the Service. We reserve the right to modify these Terms at any time. Your continued use of the Service after any changes indicates your acceptance of the new Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                2. Description of Service
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                PDFGlide provides free online tools for processing PDF files and other document formats. Our services include but are not limited to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Merging, splitting, and organizing PDF files</li>
                <li>Compressing and optimizing PDF documents</li>
                <li>Converting between PDF and other formats (Word, Excel, images)</li>
                <li>Adding watermarks, page numbers, and signatures</li>
                <li>Image processing and conversion tools</li>
                <li>OCR (Optical Character Recognition) services</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                3. User Responsibilities
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                When using PDFGlide, you agree to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Use the Service only for lawful purposes</li>
                <li>Not upload files containing malware, viruses, or harmful code</li>
                <li>Not upload illegal, offensive, or copyrighted content without authorization</li>
                <li>Not attempt to circumvent security measures or access restrictions</li>
                <li>Not use automated systems to overload or abuse the Service</li>
                <li>Not resell or commercially exploit the Service without permission</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                4. File Handling and Privacy
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We take your privacy seriously. Regarding files you upload:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Files are processed on secure servers using encrypted connections</li>
                <li>Uploaded files are automatically deleted within 1 hour</li>
                <li>We do not access, read, or share the contents of your files</li>
                <li>We do not store copies of your processed files beyond the retention period</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                For more information, please read our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                5. Intellectual Property
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                The Service and its original content, features, and functionality are owned by PDFGlide and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                You retain all rights to the files you upload. By using our Service, you grant us a limited, temporary license to process your files solely for the purpose of providing the requested service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                6. Service Limitations
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                To ensure fair use and maintain service quality, we impose the following limits:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Maximum file size: 100MB per file</li>
                <li>Maximum files per request: 20 files</li>
                <li>Processed files are available for download for 2 minutes, then deleted</li>
                <li>Rate limiting may apply to prevent abuse</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                We reserve the right to modify these limits at any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                7. Disclaimer of Warranties
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either express or implied, including but not limited to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 space-y-2">
                <li>Implied warranties of merchantability and fitness for a particular purpose</li>
                <li>Warranties that the Service will be uninterrupted, secure, or error-free</li>
                <li>Warranties regarding the accuracy or reliability of results</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-300 mt-4">
                We recommend keeping backup copies of your original files before processing.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                8. Limitation of Liability
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                To the maximum extent permitted by law, PDFGlide shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, or other intangible losses, resulting from your use of or inability to use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                9. Indemnification
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                You agree to indemnify and hold harmless PDFGlide and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorney fees) arising from your use of the Service or violation of these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                10. Third-Party Advertisements
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                Our Service may display advertisements provided by third parties, including Google AdSense. These advertisements may use cookies and tracking technologies. We are not responsible for the content or privacy practices of third-party advertisers. Please review their respective privacy policies for more information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                11. Termination
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                We reserve the right to terminate or suspend access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination, your right to use the Service will cease immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                12. Governing Law
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. Any disputes arising from these Terms or your use of the Service shall be resolved in the appropriate courts.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                13. Severability
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                14. Contact Information
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <ul className="list-none text-gray-600 dark:text-gray-300 space-y-2">
                <li><strong>Email:</strong> legal@pdfglide.com</li>
                <li><strong>Website:</strong> <a href="/contact" className="text-blue-600 hover:underline">Contact Page</a></li>
              </ul>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
