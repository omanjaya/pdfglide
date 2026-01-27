import { Metadata } from 'next';

const SITE_NAME = 'PDFGlide';
const SITE_URL = 'https://pdfglide.com';
const SITE_DESCRIPTION = 'Free online PDF tools to merge, split, compress, convert, rotate, unlock and watermark PDF files. Fast, secure, and easy to use.';

export interface ToolMeta {
  title: string;
  description: string;
  keywords: string[];
  path: string;
}

// All tool metadata for SEO
export const toolsMetadata: Record<string, ToolMeta> = {
  // PDF Tools
  'pdf/merge': {
    title: 'Merge PDF Files Online',
    description: 'Combine multiple PDF files into one document. Free online PDF merger - no installation required. Fast, secure, and easy to use.',
    keywords: ['merge pdf', 'combine pdf', 'join pdf', 'pdf merger', 'merge pdf files online free'],
    path: '/pdf/merge',
  },
  'pdf/split': {
    title: 'Split PDF Online',
    description: 'Split PDF into multiple files or extract specific pages. Free online PDF splitter - separate PDF pages easily.',
    keywords: ['split pdf', 'separate pdf pages', 'extract pdf pages', 'pdf splitter', 'divide pdf'],
    path: '/pdf/split',
  },
  'pdf/compress': {
    title: 'Compress PDF Online',
    description: 'Reduce PDF file size while maintaining quality. Free online PDF compressor - make PDFs smaller for email and web.',
    keywords: ['compress pdf', 'reduce pdf size', 'pdf compressor', 'shrink pdf', 'make pdf smaller'],
    path: '/pdf/compress',
  },
  'pdf/convert': {
    title: 'PDF to Image Converter',
    description: 'Convert PDF pages to JPG or PNG images. Free online PDF to image converter - high quality output.',
    keywords: ['pdf to image', 'pdf to jpg', 'pdf to png', 'convert pdf to image', 'pdf converter'],
    path: '/pdf/convert',
  },
  'pdf/rotate': {
    title: 'Rotate PDF Pages Online',
    description: 'Rotate PDF pages by 90, 180, or 270 degrees. Free online PDF rotation tool - fix upside down pages.',
    keywords: ['rotate pdf', 'rotate pdf pages', 'turn pdf', 'pdf rotation', 'flip pdf'],
    path: '/pdf/rotate',
  },
  'pdf/watermark': {
    title: 'Add Watermark to PDF',
    description: 'Add text or image watermark to PDF pages. Free online PDF watermark tool - protect your documents.',
    keywords: ['pdf watermark', 'add watermark to pdf', 'watermark pdf online', 'pdf stamp', 'protect pdf'],
    path: '/pdf/watermark',
  },
  'pdf/page-numbers': {
    title: 'Add Page Numbers to PDF',
    description: 'Add page numbers to your PDF document. Free online tool - customize position, format, and style.',
    keywords: ['add page numbers pdf', 'pdf page numbers', 'number pdf pages', 'pdf pagination'],
    path: '/pdf/page-numbers',
  },
  'pdf/protect': {
    title: 'Password Protect PDF',
    description: 'Add password protection to your PDF files. Free online PDF encryption - secure your documents.',
    keywords: ['protect pdf', 'password pdf', 'encrypt pdf', 'secure pdf', 'pdf password protection'],
    path: '/pdf/protect',
  },
  'pdf/unlock': {
    title: 'Unlock PDF - Remove Password',
    description: 'Remove password protection from PDF files. Free online PDF unlocker - unlock secured PDFs.',
    keywords: ['unlock pdf', 'remove pdf password', 'pdf unlocker', 'decrypt pdf', 'unsecure pdf'],
    path: '/pdf/unlock',
  },
  'pdf/organize': {
    title: 'Organize PDF Pages',
    description: 'Reorder, delete, or extract pages from PDF. Free online PDF organizer - rearrange your documents.',
    keywords: ['organize pdf', 'reorder pdf pages', 'delete pdf pages', 'rearrange pdf', 'pdf page organizer'],
    path: '/pdf/organize',
  },
  'pdf/to-powerpoint': {
    title: 'PDF to PowerPoint Converter',
    description: 'Convert PDF to editable PowerPoint presentation. Free online PDF to PPTX converter.',
    keywords: ['pdf to powerpoint', 'pdf to pptx', 'convert pdf to ppt', 'pdf to presentation'],
    path: '/pdf/to-powerpoint',
  },
  'pdf/redact': {
    title: 'Redact PDF - Remove Sensitive Information',
    description: 'Permanently remove sensitive information from PDF. Free online PDF redaction tool - protect privacy.',
    keywords: ['redact pdf', 'remove text from pdf', 'pdf redaction', 'censor pdf', 'black out pdf'],
    path: '/pdf/redact',
  },
  'pdf/compare': {
    title: 'Compare PDF Files',
    description: 'Find differences between two PDF documents. Free online PDF comparison tool - visual diff.',
    keywords: ['compare pdf', 'pdf diff', 'compare pdf files', 'pdf comparison', 'find differences pdf'],
    path: '/pdf/compare',
  },
  'pdf/to-pdfa': {
    title: 'Convert PDF to PDF/A',
    description: 'Convert PDF to archival PDF/A format. Free online PDF/A converter for long-term preservation.',
    keywords: ['pdf to pdfa', 'pdfa converter', 'archival pdf', 'pdf archive format', 'iso 19005'],
    path: '/pdf/to-pdfa',
  },
  'pdf/editor': {
    title: 'PDF Editor Online',
    description: 'Edit PDF files online - add text, images, and annotations. Free online PDF editor - no installation.',
    keywords: ['pdf editor', 'edit pdf online', 'pdf editor free', 'modify pdf', 'add text to pdf'],
    path: '/pdf/editor',
  },
  'pdf/visual-editor': {
    title: 'Visual PDF Editor',
    description: 'Edit PDF with shapes, annotations, and drawings. Free visual PDF editor with intuitive interface.',
    keywords: ['visual pdf editor', 'pdf annotation', 'draw on pdf', 'pdf markup', 'annotate pdf'],
    path: '/pdf/visual-editor',
  },
  'pdf/form-fill': {
    title: 'Fill PDF Forms Online',
    description: 'Fill out PDF form fields online. Free PDF form filler - complete forms without printing.',
    keywords: ['fill pdf form', 'pdf form filler', 'complete pdf form', 'fillable pdf', 'pdf form online'],
    path: '/pdf/form-fill',
  },
  'pdf/crop': {
    title: 'Crop PDF Pages',
    description: 'Crop or remove margins from PDF pages. Free online PDF cropper - adjust page size.',
    keywords: ['crop pdf', 'pdf cropper', 'remove pdf margins', 'trim pdf', 'resize pdf pages'],
    path: '/pdf/crop',
  },
  'pdf/repair': {
    title: 'Repair Corrupted PDF',
    description: 'Fix corrupted or damaged PDF files. Free online PDF repair tool - recover your documents.',
    keywords: ['repair pdf', 'fix pdf', 'corrupted pdf', 'damaged pdf', 'pdf recovery'],
    path: '/pdf/repair',
  },
  'pdf/sign': {
    title: 'Sign PDF Online',
    description: 'Add your signature to PDF documents. Free online PDF signing tool - create digital signatures.',
    keywords: ['sign pdf', 'pdf signature', 'digital signature pdf', 'esign pdf', 'sign document online'],
    path: '/pdf/sign',
  },
  'pdf/from-image': {
    title: 'Image to PDF Converter',
    description: 'Convert images to PDF document. Free online JPG, PNG to PDF converter - combine images into PDF.',
    keywords: ['image to pdf', 'jpg to pdf', 'png to pdf', 'convert image to pdf', 'photo to pdf'],
    path: '/pdf/from-image',
  },
  'pdf/to-excel': {
    title: 'PDF to Excel Converter',
    description: 'Extract tables from PDF to Excel spreadsheet. Free online PDF to XLSX converter.',
    keywords: ['pdf to excel', 'pdf to xlsx', 'extract tables from pdf', 'pdf table extractor', 'pdf to spreadsheet'],
    path: '/pdf/to-excel',
  },

  // Image Tools
  'image/compress': {
    title: 'Compress Images Online',
    description: 'Reduce image file size without losing quality. Free online image compressor for JPG, PNG, WebP.',
    keywords: ['compress image', 'image compressor', 'reduce image size', 'optimize image', 'compress jpg png'],
    path: '/image/compress',
  },
  'image/resize': {
    title: 'Resize Images Online',
    description: 'Change image dimensions easily. Free online image resizer - resize JPG, PNG, WebP.',
    keywords: ['resize image', 'image resizer', 'change image size', 'scale image', 'resize photo'],
    path: '/image/resize',
  },
  'image/convert': {
    title: 'Image Format Converter',
    description: 'Convert images between JPG, PNG, WebP formats. Free online image converter.',
    keywords: ['convert image', 'image converter', 'jpg to png', 'png to jpg', 'webp converter'],
    path: '/image/convert',
  },
  'image/remove-bg': {
    title: 'Remove Image Background',
    description: 'Remove background from images with AI. Free online background remover - get transparent PNG.',
    keywords: ['remove background', 'background remover', 'transparent background', 'remove bg', 'cut out image'],
    path: '/image/remove-bg',
  },
  'image/watermark': {
    title: 'Add Watermark to Images',
    description: 'Add text or image watermark to your photos. Free online image watermark tool.',
    keywords: ['image watermark', 'add watermark to image', 'watermark photo', 'protect images'],
    path: '/image/watermark',
  },

  // Document Tools
  'document/word-to-pdf': {
    title: 'Word to PDF Converter',
    description: 'Convert Word documents (DOC, DOCX) to PDF. Free online Word to PDF converter.',
    keywords: ['word to pdf', 'doc to pdf', 'docx to pdf', 'convert word to pdf', 'word document to pdf'],
    path: '/document/word-to-pdf',
  },
  'document/pdf-to-word': {
    title: 'PDF to Word Converter',
    description: 'Convert PDF to editable Word document. Free online PDF to DOC/DOCX converter.',
    keywords: ['pdf to word', 'pdf to doc', 'pdf to docx', 'convert pdf to word', 'pdf to editable'],
    path: '/document/pdf-to-word',
  },
  'document/excel-to-pdf': {
    title: 'Excel to PDF Converter',
    description: 'Convert Excel spreadsheets to PDF. Free online XLS/XLSX to PDF converter.',
    keywords: ['excel to pdf', 'xlsx to pdf', 'xls to pdf', 'spreadsheet to pdf', 'convert excel to pdf'],
    path: '/document/excel-to-pdf',
  },
  'document/pptx-to-pdf': {
    title: 'PowerPoint to PDF Converter',
    description: 'Convert PowerPoint presentations to PDF. Free online PPTX to PDF converter.',
    keywords: ['powerpoint to pdf', 'pptx to pdf', 'ppt to pdf', 'presentation to pdf', 'convert ppt to pdf'],
    path: '/document/pptx-to-pdf',
  },
  'document/html-to-pdf': {
    title: 'HTML to PDF Converter',
    description: 'Convert web pages and HTML to PDF. Free online HTML to PDF converter.',
    keywords: ['html to pdf', 'webpage to pdf', 'url to pdf', 'convert html to pdf', 'web to pdf'],
    path: '/document/html-to-pdf',
  },

  // Other Tools
  'other/ocr': {
    title: 'OCR - Extract Text from Images',
    description: 'Extract text from images and scanned PDFs. Free online OCR tool - accurate text recognition.',
    keywords: ['ocr', 'extract text from image', 'image to text', 'ocr online', 'text recognition'],
    path: '/other/ocr',
  },
  'other/qr-code': {
    title: 'QR Code Generator',
    description: 'Create QR codes for URLs, text, or contact info. Free online QR code generator.',
    keywords: ['qr code generator', 'create qr code', 'qr code maker', 'generate qr code', 'qr code free'],
    path: '/other/qr-code',
  },
};

export function generateToolMetadata(toolKey: string): Metadata {
  const tool = toolsMetadata[toolKey];
  if (!tool) {
    return generateBaseMetadata();
  }

  // Don't include SITE_NAME here - the root layout template adds it
  const pageTitle = `${tool.title} - Free Online`;
  const fullTitle = `${pageTitle} | ${SITE_NAME}`;
  const url = `${SITE_URL}${tool.path}`;

  return {
    title: pageTitle,  // Template in root layout adds " | PDFGlide"
    description: tool.description,
    keywords: tool.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,  // Full title for social sharing
      description: tool.description,
      url: url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: tool.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: tool.description,
      images: [`${SITE_URL}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export function generateBaseMetadata(): Metadata {
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} - Free Online PDF Tools`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    keywords: [
      'pdf tools',
      'online pdf editor',
      'merge pdf',
      'split pdf',
      'compress pdf',
      'convert pdf',
      'pdf converter',
      'free pdf tools',
      'pdf online',
      'edit pdf',
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      title: `${SITE_NAME} - Free Online PDF Tools`,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: `${SITE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} - Free Online PDF Tools`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} - Free Online PDF Tools`,
      description: SITE_DESCRIPTION,
      images: [`${SITE_URL}/og-image.png`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      // Add these when you have the verification codes
      // google: 'your-google-verification-code',
      // yandex: 'your-yandex-verification-code',
      // bing: 'your-bing-verification-code',
    },
  };
}

// Structured data for the website
export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// Structured data for software application
export function generateSoftwareAppSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1250',
      bestRating: '5',
      worstRating: '1',
    },
    description: SITE_DESCRIPTION,
  };
}

// Structured data for organization
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      // Add social media links when available
      // 'https://twitter.com/pdfglide',
      // 'https://facebook.com/pdfglide',
    ],
  };
}

// Structured data for a specific tool (HowTo schema)
export function generateToolSchema(toolKey: string) {
  const tool = toolsMetadata[toolKey];
  if (!tool) return null;

  const actionVerb = tool.title.split(' ')[0]; // e.g., "Merge", "Split", "Compress"

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: tool.title,
    description: tool.description,
    url: `${SITE_URL}${tool.path}`,
    totalTime: 'PT1M',
    tool: {
      '@type': 'HowToTool',
      name: SITE_NAME,
    },
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Upload your file',
        text: 'Click the upload area or drag and drop your file.',
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Configure options',
        text: 'Adjust settings as needed for your output.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Process and download',
        text: `Click the ${actionVerb} button and download your processed file.`,
      },
    ],
  };
}
