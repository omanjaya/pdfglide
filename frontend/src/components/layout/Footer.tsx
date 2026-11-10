import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-5">
          {/* PDF Tools */}
          <div>
            <h2 className="mb-3 font-semibold">PDF Tools</h2>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li>
                <Link href="/pdf/merge" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Merge PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/split" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Split PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/compress" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Compress PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/convert" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  PDF to Image
                </Link>
              </li>
              <li>
                <Link href="/pdf/editor" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  PDF Editor
                </Link>
              </li>
              <li>
                <Link href="/pdf/protect" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Protect PDF
                </Link>
              </li>
            </ul>
          </div>

          {/* More PDF Tools */}
          <div>
            <h2 className="mb-3 font-semibold">More PDF</h2>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li>
                <Link href="/pdf/rotate" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Rotate PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/watermark" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Add Watermark
                </Link>
              </li>
              <li>
                <Link href="/pdf/sign" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Sign PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/unlock" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Unlock PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/form-fill" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Fill PDF Form
                </Link>
              </li>
              <li>
                <Link href="/pdf/to-excel" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  PDF to Excel
                </Link>
              </li>
            </ul>
          </div>

          {/* Convert Tools */}
          <div>
            <h2 className="mb-3 font-semibold">Convert</h2>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li>
                <Link href="/document/word-to-pdf" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Word to PDF
                </Link>
              </li>
              <li>
                <Link href="/document/pdf-to-word" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  PDF to Word
                </Link>
              </li>
              <li>
                <Link href="/document/excel-to-pdf" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Excel to PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/to-powerpoint" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  PDF to PowerPoint
                </Link>
              </li>
              <li>
                <Link href="/pdf/from-image" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Image to PDF
                </Link>
              </li>
              <li>
                <Link href="/document/html-to-pdf" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  HTML to PDF
                </Link>
              </li>
            </ul>
          </div>

          {/* Image Tools */}
          <div>
            <h2 className="mb-3 font-semibold">Image Tools</h2>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li>
                <Link href="/image/compress" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Compress Image
                </Link>
              </li>
              <li>
                <Link href="/image/resize" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Resize Image
                </Link>
              </li>
              <li>
                <Link href="/image/convert" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Convert Image
                </Link>
              </li>
              <li>
                <Link href="/image/remove-bg" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Remove Background
                </Link>
              </li>
              <li>
                <Link href="/other/ocr" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  OCR - Extract Text
                </Link>
              </li>
              <li>
                <Link href="/other/qr-code" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  QR Code Generator
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="col-span-2 md:col-span-1">
            <h2 className="mb-3 font-semibold">Company</h2>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/blog" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="inline-block py-1 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 border-t pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-bold">
                P
              </div>
              <span className="font-semibold">PDFGlide</span>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Free online tools to process PDF, images, and documents. Fast, secure, and easy to use.
            </p>
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} PDFGlide. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
