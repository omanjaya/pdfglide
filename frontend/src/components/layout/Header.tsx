'use client';

import Link from 'next/link';
import { FileText, Image, FileSpreadsheet, Menu, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const navigation = [
  {
    name: 'PDF Tools',
    href: '#',
    icon: FileText,
    color: 'text-red-500',
    items: [
      { name: 'Merge PDF', href: '/pdf/merge' },
      { name: 'Split PDF', href: '/pdf/split' },
      { name: 'Compress PDF', href: '/pdf/compress' },
      { name: 'PDF Editor', href: '/pdf/editor' },
      { name: 'Visual Editor', href: '/pdf/visual-editor' },
      { name: 'Fill PDF Form', href: '/pdf/form-fill' },
      { name: 'Redact PDF', href: '/pdf/redact' },
      { name: 'Compare PDFs', href: '/pdf/compare' },
    ],
  },
  {
    name: 'Image Tools',
    href: '#',
    icon: Image,
    color: 'text-green-500',
    items: [
      { name: 'Compress Image', href: '/image/compress' },
      { name: 'Resize Image', href: '/image/resize' },
      { name: 'Convert Image', href: '/image/convert' },
      { name: 'Remove Background', href: '/image/remove-bg' },
    ],
  },
  {
    name: 'Document Tools',
    href: '#',
    icon: FileSpreadsheet,
    color: 'text-blue-500',
    items: [
      { name: 'Word to PDF', href: '/document/word-to-pdf' },
      { name: 'PDF to Word', href: '/document/pdf-to-word' },
      { name: 'Excel to PDF', href: '/document/excel-to-pdf' },
      { name: 'PDF to PowerPoint', href: '/pdf/to-powerpoint' },
      { name: 'PDF to PDF/A', href: '/pdf/to-pdfa' },
    ],
  },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg sm:text-xl font-bold" title="PDFGlide - Free Online PDF Tools">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm sm:text-base font-bold shadow-sm">
            P
          </div>
          <span className="hidden xs:inline bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">PDFGlide</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navigation.map((item) => (
            <div key={item.name} className="group relative">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground rounded-md hover:bg-accent">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span>{item.name}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
              <div className="invisible absolute left-0 top-full z-50 min-w-[200px] rounded-lg border bg-background p-1.5 opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:opacity-100">
                {item.items.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                  >
                    {subItem.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t md:hidden bg-background">
          <div className="container mx-auto px-4 py-3 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {navigation.map((item) => (
              <div key={item.name} className="mb-2">
                <button
                  onClick={() => toggleDropdown(item.name)}
                  className="w-full flex items-center justify-between py-2 text-sm font-medium"
                >
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      openDropdown === item.name ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openDropdown === item.name && (
                  <div className="ml-6 mt-1 space-y-1 pb-2">
                    {item.items.map((subItem) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        className="block py-2 px-3 text-sm text-muted-foreground rounded-md hover:bg-accent hover:text-foreground transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {subItem.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
