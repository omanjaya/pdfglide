'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';

// Set worker source using unpkg CDN (more reliable than cdnjs for newer versions)
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

export interface UsePdfRendererReturn {
  isLoading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  pageInfo: PageInfo | null;
  zoom: number;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  renderPage: (canvas: HTMLCanvasElement) => Promise<void>;
  loadPdf: (file: File) => Promise<void>;
}

export function usePdfRenderer(): UsePdfRendererReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [zoom, setZoom] = useState(1);

  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

  const loadPdf = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);

      // Load PDF document
      const loadingTask = pdfjs.getDocument({ data: typedArray });
      const pdf = await loadingTask.promise;

      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(1);

      // Get first page info
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });

      setPageInfo({
        pageNumber: 1,
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load PDF');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renderPage = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!pdfDocRef.current || currentPage < 1 || currentPage > totalPages) {
        return;
      }

      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        const viewport = page.getViewport({ scale: zoom });

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Render page
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        // Update page info
        setPageInfo({
          pageNumber: currentPage,
          width: viewport.width,
          height: viewport.height,
          rotation: viewport.rotation,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to render page');
      }
    },
    [currentPage, totalPages, zoom]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, []);

  const handleSetCurrentPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  const handleSetZoom = useCallback((newZoom: number) => {
    // Clamp zoom between 0.25 and 4
    const clampedZoom = Math.max(0.25, Math.min(4, newZoom));
    setZoom(clampedZoom);
  }, []);

  return {
    isLoading,
    error,
    totalPages,
    currentPage,
    pageInfo,
    zoom,
    setCurrentPage: handleSetCurrentPage,
    setZoom: handleSetZoom,
    renderPage,
    loadPdf,
  };
}
