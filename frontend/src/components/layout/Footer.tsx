import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* PDF Tools */}
          <div>
            <h3 className="mb-3 font-semibold">PDF Tools</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pdf/merge" className="hover:text-foreground transition-colors">
                  Merge PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/split" className="hover:text-foreground transition-colors">
                  Split PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/compress" className="hover:text-foreground transition-colors">
                  Compress PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/convert" className="hover:text-foreground transition-colors">
                  PDF to Image
                </Link>
              </li>
              <li>
                <Link href="/pdf/editor" className="hover:text-foreground transition-colors">
                  PDF Editor
                </Link>
              </li>
              <li>
                <Link href="/pdf/protect" className="hover:text-foreground transition-colors">
                  Protect PDF
                </Link>
              </li>
            </ul>
          </div>

          {/* More PDF Tools */}
          <div>
            <h3 className="mb-3 font-semibold">More PDF</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pdf/rotate" className="hover:text-foreground transition-colors">
                  Rotate PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/watermark" className="hover:text-foreground transition-colors">
                  Add Watermark
                </Link>
              </li>
              <li>
                <Link href="/pdf/sign" className="hover:text-foreground transition-colors">
                  Sign PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/unlock" className="hover:text-foreground transition-colors">
                  Unlock PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/form-fill" className="hover:text-foreground transition-colors">
                  Fill PDF Form
                </Link>
              </li>
              <li>
                <Link href="/pdf/to-excel" className="hover:text-foreground transition-colors">
                  PDF to Excel
                </Link>
              </li>
            </ul>
          </div>

          {/* Convert Tools */}
          <div>
            <h3 className="mb-3 font-semibold">Convert</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/document/word-to-pdf" className="hover:text-foreground transition-colors">
                  Word to PDF
                </Link>
              </li>
              <li>
                <Link href="/document/pdf-to-word" className="hover:text-foreground transition-colors">
                  PDF to Word
                </Link>
              </li>
              <li>
                <Link href="/document/excel-to-pdf" className="hover:text-foreground transition-colors">
                  Excel to PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf/to-powerpoint" className="hover:text-foreground transition-colors">
                  PDF to PowerPoint
                </Link>
              </li>
              <li>
                <Link href="/pdf/from-image" className="hover:text-foreground transition-colors">
                  Image to PDF
                </Link>
              </li>
              <li>
                <Link href="/document/html-to-pdf" className="hover:text-foreground transition-colors">
                  HTML to PDF
                </Link>
              </li>
            </ul>
          </div>

          {/* Image Tools */}
          <div>
            <h3 className="mb-3 font-semibold">Image Tools</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/image/compress" className="hover:text-foreground transition-colors">
                  Compress Image
                </Link>
              </li>
              <li>
                <Link href="/image/resize" className="hover:text-foreground transition-colors">
                  Resize Image
                </Link>
              </li>
              <li>
                <Link href="/image/convert" className="hover:text-foreground transition-colors">
                  Convert Image
                </Link>
              </li>
              <li>
                <Link href="/image/remove-bg" className="hover:text-foreground transition-colors">
                  Remove Background
                </Link>
              </li>
              <li>
                <Link href="/other/ocr" className="hover:text-foreground transition-colors">
                  OCR - Extract Text
                </Link>
              </li>
              <li>
                <Link href="/other/qr-code" className="hover:text-foreground transition-colors">
                  QR Code Generator
                </Link>
              </li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="mb-3 font-semibold">PDFGlide</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>100% Free</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>No Registration</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Secure & Private</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Auto Delete (1 hour)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Works on All Devices</span>
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
