'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import {
  CheckCircle2,
  Loader2,
  MousePointerClick,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// Set worker source
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PdfPageSelectorProps {
  file: File;
  selectedPages: Set<number>;
  onSelectionChange: (pages: Set<number>) => void;
}

interface PageThumbnail {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export function PdfPageSelector({
  file,
  selectedPages,
  onSelectionChange,
}: PdfPageSelectorProps) {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const lastClickedRef = useRef<number | null>(null);
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

  // Load PDF and render thumbnails
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setThumbnails([]);
      setLoadedCount(0);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);

        const thumbs: PageThumbnail[] = [];
        const THUMB_SCALE = 0.4;

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: THUMB_SCALE });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          thumbs.push({
            pageNumber: i,
            dataUrl: canvas.toDataURL('image/jpeg', 0.6),
            width: viewport.width,
            height: viewport.height,
          });

          if (!cancelled) {
            setLoadedCount(i);
            setThumbnails([...thumbs]);
          }
        }

        if (!cancelled) {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [file]);

  const handlePageClick = useCallback(
    (pageNumber: number, e: React.MouseEvent) => {
      const newSelection = new Set(selectedPages);

      if (e.shiftKey && lastClickedRef.current !== null) {
        // Range selection
        const start = Math.min(lastClickedRef.current, pageNumber);
        const end = Math.max(lastClickedRef.current, pageNumber);
        for (let i = start; i <= end; i++) {
          newSelection.add(i);
        }
      } else {
        // Toggle single page
        if (newSelection.has(pageNumber)) {
          newSelection.delete(pageNumber);
        } else {
          newSelection.add(pageNumber);
        }
      }

      lastClickedRef.current = pageNumber;
      onSelectionChange(newSelection);
    },
    [selectedPages, onSelectionChange]
  );

  const selectAll = useCallback(() => {
    const all = new Set<number>();
    for (let i = 1; i <= totalPages; i++) {
      all.add(i);
    }
    onSelectionChange(all);
  }, [totalPages, onSelectionChange]);

  const selectNone = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const selectOdd = useCallback(() => {
    const odds = new Set<number>();
    for (let i = 1; i <= totalPages; i += 2) {
      odds.add(i);
    }
    onSelectionChange(odds);
  }, [totalPages, onSelectionChange]);

  const selectEven = useCallback(() => {
    const evens = new Set<number>();
    for (let i = 2; i <= totalPages; i += 2) {
      evens.add(i);
    }
    onSelectionChange(evens);
  }, [totalPages, onSelectionChange]);

  const invertSelection = useCallback(() => {
    const inverted = new Set<number>();
    for (let i = 1; i <= totalPages; i++) {
      if (!selectedPages.has(i)) {
        inverted.add(i);
      }
    }
    onSelectionChange(inverted);
  }, [totalPages, selectedPages, onSelectionChange]);

  const allSelected = selectedPages.size === totalPages && totalPages > 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Select All / None Toggle */}
        <button
          onClick={allSelected ? selectNone : selectAll}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          {allSelected ? (
            <ToggleRight className="h-4 w-4 text-blue-500" />
          ) : (
            <ToggleLeft className="h-4 w-4" />
          )}
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>

        <button
          onClick={selectOdd}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Odd Pages
        </button>

        <button
          onClick={selectEven}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Even Pages
        </button>

        <button
          onClick={invertSelection}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Invert
        </button>

        {/* Selection Count */}
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {selectedPages.size}
          </span>
          <span className="text-gray-500">/ {totalPages} selected</span>
        </div>
      </div>

      {/* Hint */}
      <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-500">
        <MousePointerClick className="h-3.5 w-3.5" />
        <span>Click to select. Hold <kbd className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] dark:bg-gray-700">Shift</kbd> + click for range selection.</span>
      </div>

      {/* Loading Progress */}
      {loading && (
        <div className="mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span>
              Loading pages... {loadedCount}/{totalPages || '?'}
            </span>
          </div>
          {totalPages > 0 && (
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(loadedCount / totalPages) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Thumbnails Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[480px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
        {thumbnails.map((thumb) => {
          const isSelected = selectedPages.has(thumb.pageNumber);

          return (
            <button
              key={thumb.pageNumber}
              onClick={(e) => handlePageClick(thumb.pageNumber, e)}
              className={`group relative rounded-lg overflow-hidden border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 ${
                isSelected
                  ? 'border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02]'
                  : 'border-transparent hover:border-blue-300 hover:shadow-md'
              }`}
            >
              {/* Thumbnail Image */}
              <div className="relative bg-white dark:bg-gray-700">
                <img
                  src={thumb.dataUrl}
                  alt={`Page ${thumb.pageNumber}`}
                  className={`w-full h-auto block transition-all duration-200 ${
                    isSelected ? 'opacity-90' : 'opacity-100 group-hover:opacity-90'
                  }`}
                  draggable={false}
                />

                {/* Selection Overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-500/15" />
                )}

                {/* Checkmark */}
                <div
                  className={`absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-500 text-white scale-100'
                      : 'bg-white/80 text-gray-400 scale-0 group-hover:scale-100'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>

              {/* Page Number */}
              <div
                className={`py-1.5 text-center text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {thumb.pageNumber}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
