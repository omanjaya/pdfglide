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
import type { LucideIcon } from 'lucide-react';
import type { ToolCategory } from '@/types/tool';

/**
 * Single source of truth for every tool on the site.
 * Used by the home page grid + search, the header menus and the footer.
 * (Lives under src/components so Tailwind picks up the colour classes.)
 */
export interface SiteTool {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  category: ToolCategory;
  /** Extra search terms (synonyms, file extensions). */
  keywords: string;
  popular?: boolean;
}

type RawTool = Omit<SiteTool, 'category' | 'keywords' | 'popular'>;

const KEYWORDS: Record<string, string> = {
  '/pdf/merge': 'combine join concatenate append put together',
  '/pdf/split': 'separate divide extract pages cut break apart',
  '/pdf/compress': 'shrink reduce size smaller optimize email',
  '/pdf/convert': 'jpg jpeg png picture photo export images',
  '/pdf/rotate': 'turn flip sideways landscape portrait orientation',
  '/pdf/watermark': 'stamp logo confidential draft text overlay',
  '/pdf/page-numbers': 'number pages footer header numbering paginate',
  '/pdf/protect': 'password encrypt secure lock restrict',
  '/pdf/unlock': 'password decrypt remove protection open restricted',
  '/pdf/organize': 'reorder rearrange delete pages extract sort move',
  '/pdf/to-powerpoint': 'pptx slides presentation ppt',
  '/pdf/redact': 'blackout hide censor sensitive private confidential',
  '/pdf/compare': 'diff differences changes versions',
  '/pdf/to-pdfa': 'archive archival long-term pdf/a compliance',
  '/pdf/editor': 'edit text add comments annotate modify',
  '/pdf/visual-editor': 'shapes draw annotate highlight annotations markup',
  '/pdf/form-fill': 'form fields fillable complete type',
  '/pdf/crop': 'trim margins cut resize page',
  '/pdf/repair': 'fix corrupted damaged broken recover',
  '/pdf/sign': 'signature esign sign electronically initials',
  '/pdf/from-image': 'jpg png picture photo scan images to pdf',
  '/pdf/to-excel': 'xlsx spreadsheet tables csv extract data',
  '/image/compress': 'shrink reduce size jpg png webp optimize',
  '/image/resize': 'scale dimensions pixels width height',
  '/image/convert': 'jpg jpeg png webp gif format change',
  '/image/remove-bg': 'background transparent cutout erase ai',
  '/document/word-to-pdf': 'docx doc word microsoft',
  '/document/pdf-to-word': 'docx doc editable word',
  '/document/excel-to-pdf': 'xlsx xls spreadsheet microsoft',
  '/document/pptx-to-pdf': 'ppt pptx slides presentation powerpoint',
  '/document/html-to-pdf': 'web page website url',
  '/other/ocr': 'scan image text recognition extract text',
  '/other/qr-code': 'qr barcode link url generate',
};

const POPULAR = new Set([
  '/pdf/merge',
  '/pdf/split',
  '/pdf/compress',
  '/document/pdf-to-word',
  '/document/word-to-pdf',
  '/pdf/convert',
  '/pdf/sign',
  '/pdf/from-image',
]);

const pdfTools: RawTool[] = [
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
    color: 'bg-cyan-600',
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
    color: 'bg-amber-600',
  },
  {
    title: 'Unlock PDF',
    description: 'Remove password from PDF',
    href: '/pdf/unlock',
    icon: Unlock,
    color: 'bg-green-600',
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
    color: 'bg-amber-600',
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

const imageTools: RawTool[] = [
  {
    title: 'Compress Image',
    description: 'Reduce image file size for web',
    href: '/image/compress',
    icon: Minimize2,
    color: 'bg-green-600',
  },
  {
    title: 'Resize Image',
    description: 'Change image dimensions',
    href: '/image/resize',
    icon: Maximize2,
    color: 'bg-green-600',
  },
  {
    title: 'Convert Image',
    description: 'Convert JPG, PNG, WebP formats',
    href: '/image/convert',
    icon: RefreshCw,
    color: 'bg-green-600',
  },
  {
    title: 'Remove Background',
    description: 'Remove image background with AI',
    href: '/image/remove-bg',
    icon: Eraser,
    color: 'bg-green-600',
  },
];

const documentTools: RawTool[] = [
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
    color: 'bg-cyan-600',
  },
];

const otherTools: RawTool[] = [
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

function enrich(list: RawTool[], category: ToolCategory): SiteTool[] {
  return list.map((t) => ({
    ...t,
    category,
    keywords: KEYWORDS[t.href] ?? '',
    popular: POPULAR.has(t.href),
  }));
}

export interface ToolCategoryInfo {
  id: ToolCategory;
  label: string;
  /** Short label used in the header. */
  navLabel: string;
  icon: LucideIcon;
  color: string;
  textColor: string;
  tools: SiteTool[];
}

export const TOOL_CATEGORIES: ToolCategoryInfo[] = [
  { id: 'pdf', label: 'PDF Tools', navLabel: 'PDF', icon: FileText, color: 'bg-red-600', textColor: 'text-red-600', tools: enrich(pdfTools, 'pdf') },
  { id: 'image', label: 'Image Tools', navLabel: 'Image', icon: Image, color: 'bg-green-600', textColor: 'text-green-600', tools: enrich(imageTools, 'image') },
  { id: 'document', label: 'Document Tools', navLabel: 'Document', icon: FileSpreadsheet, color: 'bg-blue-600', textColor: 'text-blue-600', tools: enrich(documentTools, 'document') },
  { id: 'other', label: 'Other Tools', navLabel: 'Other', icon: Wrench, color: 'bg-purple-600', textColor: 'text-purple-600', tools: enrich(otherTools, 'other') },
];

export const ALL_TOOLS: SiteTool[] = TOOL_CATEGORIES.flatMap((c) => c.tools);

export const POPULAR_TOOLS: SiteTool[] = ALL_TOOLS.filter((t) => t.popular);
