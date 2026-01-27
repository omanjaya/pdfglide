import { ToolCard } from '@/components/shared/ToolCard';
import {
  FileText,
  Image,
  FileSpreadsheet,
  Combine,
  Split,
  Minimize2,
  FileOutput,
  Maximize2,
  RefreshCw,
  FileImage,
  ImagePlus,
  Eraser,
  ScanText,
  QrCode,
  Wrench,
  RotateCw,
  Droplets,
  Hash,
  Lock,
  Unlock,
  Layers,
  Presentation,
  EyeOff,
  GitCompare,
  Archive,
  Edit3,
  Crop,
  PenTool,
  Table,
  Globe,
  FormInput,
  Pencil,
} from 'lucide-react';

const pdfTools = [
  {
    title: 'Merge PDF',
    description: 'Combine multiple PDF files into one',
    href: '/pdf/merge',
    icon: Combine,
    color: 'bg-red-500',
  },
  {
    title: 'Split PDF',
    description: 'Separate PDF pages into multiple files',
    href: '/pdf/split',
    icon: Split,
    color: 'bg-red-500',
  },
  {
    title: 'Compress PDF',
    description: 'Reduce PDF file size while keeping quality',
    href: '/pdf/compress',
    icon: Minimize2,
    color: 'bg-red-500',
  },
  {
    title: 'PDF to Image',
    description: 'Convert PDF pages to JPG or PNG',
    href: '/pdf/convert',
    icon: FileImage,
    color: 'bg-red-500',
  },
  {
    title: 'Rotate PDF',
    description: 'Rotate PDF pages by any angle',
    href: '/pdf/rotate',
    icon: RotateCw,
    color: 'bg-purple-500',
  },
  {
    title: 'Add Watermark',
    description: 'Add text watermark to PDF pages',
    href: '/pdf/watermark',
    icon: Droplets,
    color: 'bg-cyan-500',
  },
  {
    title: 'Page Numbers',
    description: 'Add page numbers to your PDF',
    href: '/pdf/page-numbers',
    icon: Hash,
    color: 'bg-indigo-500',
  },
  {
    title: 'Protect PDF',
    description: 'Add password protection to PDF',
    href: '/pdf/protect',
    icon: Lock,
    color: 'bg-amber-500',
  },
  {
    title: 'Unlock PDF',
    description: 'Remove password from PDF',
    href: '/pdf/unlock',
    icon: Unlock,
    color: 'bg-green-500',
  },
  {
    title: 'Organize PDF',
    description: 'Reorder, delete, or extract pages',
    href: '/pdf/organize',
    icon: Layers,
    color: 'bg-orange-500',
  },
  {
    title: 'PDF to PowerPoint',
    description: 'Convert PDF to PPTX presentation',
    href: '/pdf/to-powerpoint',
    icon: Presentation,
    color: 'bg-orange-500',
  },
  {
    title: 'Redact PDF',
    description: 'Remove sensitive information',
    href: '/pdf/redact',
    icon: EyeOff,
    color: 'bg-gray-700',
  },
  {
    title: 'Compare PDFs',
    description: 'Find differences between two PDFs',
    href: '/pdf/compare',
    icon: GitCompare,
    color: 'bg-indigo-500',
  },
  {
    title: 'PDF to PDF/A',
    description: 'Convert to archival format',
    href: '/pdf/to-pdfa',
    icon: Archive,
    color: 'bg-teal-500',
  },
  {
    title: 'PDF Editor',
    description: 'Add text, images, and comments',
    href: '/pdf/editor',
    icon: Edit3,
    color: 'bg-purple-500',
  },
  {
    title: 'Visual Editor',
    description: 'Edit PDF with shapes & annotations',
    href: '/pdf/visual-editor',
    icon: Pencil,
    color: 'bg-indigo-500',
  },
  {
    title: 'Fill PDF Form',
    description: 'Fill out PDF form fields',
    href: '/pdf/form-fill',
    icon: FormInput,
    color: 'bg-violet-500',
  },
  {
    title: 'Crop PDF',
    description: 'Remove margins or crop pages',
    href: '/pdf/crop',
    icon: Crop,
    color: 'bg-amber-500',
  },
  {
    title: 'Repair PDF',
    description: 'Fix corrupted or damaged PDFs',
    href: '/pdf/repair',
    icon: Wrench,
    color: 'bg-rose-500',
  },
  {
    title: 'Sign PDF',
    description: 'Add signature to PDF documents',
    href: '/pdf/sign',
    icon: PenTool,
    color: 'bg-violet-500',
  },
  {
    title: 'Image to PDF',
    description: 'Convert images to PDF document',
    href: '/pdf/from-image',
    icon: ImagePlus,
    color: 'bg-pink-500',
  },
  {
    title: 'PDF to Excel',
    description: 'Extract tables from PDF to Excel',
    href: '/pdf/to-excel',
    icon: Table,
    color: 'bg-green-600',
  },
];

const imageTools = [
  {
    title: 'Compress Image',
    description: 'Reduce image file size for web',
    href: '/image/compress',
    icon: Minimize2,
    color: 'bg-green-500',
  },
  {
    title: 'Resize Image',
    description: 'Change image dimensions',
    href: '/image/resize',
    icon: Maximize2,
    color: 'bg-green-500',
  },
  {
    title: 'Convert Image',
    description: 'Convert JPG, PNG, WebP formats',
    href: '/image/convert',
    icon: RefreshCw,
    color: 'bg-green-500',
  },
  {
    title: 'Remove Background',
    description: 'Remove image background with AI',
    href: '/image/remove-bg',
    icon: Eraser,
    color: 'bg-green-500',
  },
];

const documentTools = [
  {
    title: 'Word to PDF',
    description: 'Convert Word documents to PDF',
    href: '/document/word-to-pdf',
    icon: FileOutput,
    color: 'bg-blue-500',
  },
  {
    title: 'PDF to Word',
    description: 'Convert PDF to editable Word',
    href: '/document/pdf-to-word',
    icon: FileText,
    color: 'bg-blue-500',
  },
  {
    title: 'Excel to PDF',
    description: 'Convert Excel spreadsheets to PDF',
    href: '/document/excel-to-pdf',
    icon: FileSpreadsheet,
    color: 'bg-blue-500',
  },
  {
    title: 'PowerPoint to PDF',
    description: 'Convert presentations to PDF',
    href: '/document/pptx-to-pdf',
    icon: Presentation,
    color: 'bg-orange-600',
  },
  {
    title: 'HTML to PDF',
    description: 'Convert webpages to PDF',
    href: '/document/html-to-pdf',
    icon: Globe,
    color: 'bg-cyan-500',
  },
];

const otherTools = [
  {
    title: 'OCR - Extract Text',
    description: 'Extract text from images & PDFs',
    href: '/other/ocr',
    icon: ScanText,
    color: 'bg-purple-500',
  },
  {
    title: 'QR Code Generator',
    description: 'Create QR codes from text or URLs',
    href: '/other/qr-code',
    icon: QrCode,
    color: 'bg-purple-500',
  },
];

interface ToolSectionProps {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  tools: typeof pdfTools;
}

function ToolSection({ title, icon, iconBg, tools }: ToolSectionProps) {
  return (
    <section className="mb-10 sm:mb-12">
      <div className="mb-4 sm:mb-6 flex items-center gap-3">
        <div className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl text-white shadow-sm ${iconBg}`}>
          {icon}
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {tools.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 sm:py-12">
        {/* Hero Section */}
        <section className="mb-10 sm:mb-16 text-center">
          <h1 className="mb-3 sm:mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              PDFGlide
            </span>
            <span className="block text-lg sm:text-xl md:text-2xl lg:text-3xl mt-2 font-semibold text-foreground/80">
              Free Online PDF Tools
            </span>
          </h1>
          <p className="mx-auto max-w-xl sm:max-w-2xl text-sm sm:text-base lg:text-lg text-muted-foreground px-4 mb-4">
            Your all-in-one file processing toolkit. Convert, compress, merge, and edit
            PDF, images, Word, Excel, and more. Fast, secure, and completely free.
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm text-muted-foreground/70">
            <span>Merge PDF</span>
            <span>•</span>
            <span>Split PDF</span>
            <span>•</span>
            <span>Compress PDF</span>
            <span>•</span>
            <span>Convert PDF</span>
            <span>•</span>
            <span>Edit PDF</span>
          </div>
        </section>

        {/* PDF Tools */}
        <ToolSection
          title="PDF Tools"
          icon={<FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
          iconBg="bg-red-500"
          tools={pdfTools}
        />

        {/* Image Tools */}
        <ToolSection
          title="Image Tools"
          icon={<Image className="h-4 w-4 sm:h-5 sm:w-5" />}
          iconBg="bg-green-500"
          tools={imageTools}
        />

        {/* Document Tools */}
        <ToolSection
          title="Document Tools"
          icon={<FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />}
          iconBg="bg-blue-500"
          tools={documentTools}
        />

        {/* Other Tools */}
        <ToolSection
          title="Other Tools"
          icon={<Wrench className="h-4 w-4 sm:h-5 sm:w-5" />}
          iconBg="bg-purple-500"
          tools={otherTools}
        />
      </div>
    </div>
  );
}
