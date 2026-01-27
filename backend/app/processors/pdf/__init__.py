"""PDF processors."""

from app.processors.pdf.merger import PDFMerger
from app.processors.pdf.splitter import PDFSplitter
from app.processors.pdf.compressor import PDFCompressor
from app.processors.pdf.converter import PDFToImageConverter, ImageToPDFConverter
from app.processors.pdf.rotator import PDFRotator
from app.processors.pdf.watermark import PDFWatermark
from app.processors.pdf.page_numbers import PDFPageNumbers
from app.processors.pdf.protector import PDFProtector, PDFUnlocker
from app.processors.pdf.organizer import PDFOrganizer
from app.processors.pdf.repairer import PDFRepairer
from app.processors.pdf.cropper import PDFCropper
from app.processors.pdf.signer import PDFSigner
from app.processors.pdf.metadata import PDFMetadataEditor
from app.processors.pdf.table_extractor import PDFTableExtractor

__all__ = [
    "PDFMerger",
    "PDFSplitter",
    "PDFCompressor",
    "PDFToImageConverter",
    "ImageToPDFConverter",
    "PDFRotator",
    "PDFWatermark",
    "PDFPageNumbers",
    "PDFProtector",
    "PDFUnlocker",
    "PDFOrganizer",
    "PDFRepairer",
    "PDFCropper",
    "PDFSigner",
    "PDFMetadataEditor",
    "PDFTableExtractor",
]
