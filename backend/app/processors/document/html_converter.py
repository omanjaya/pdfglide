"""HTML to PDF converter."""

import asyncio
from pathlib import Path
from typing import Optional

from app.processors.base import BaseProcessor
from app.core.validators import validate_url_ssrf_safe_async
from app.core.exceptions import ProcessingError


class HTMLToPDFConverter(BaseProcessor):
    """Convert HTML content or URL to PDF."""

    async def execute(
        self,
        output_path: Path,
        url: Optional[str] = None,
        html_content: Optional[str] = None,
        page_size: str = "A4",
        margin: int = 20,
    ) -> Path:
        """
        Convert HTML to PDF.

        Tries multiple backends in order:
        1. weasyprint (pure Python, good for simple HTML)
        2. playwright (headless browser, best for complex/JS pages)

        Args:
            output_path: Path for the output PDF
            url: URL to convert
            html_content: HTML string to convert
            page_size: Page size (A4, Letter, etc.)
            margin: Page margin in mm

        Returns:
            Path to the generated PDF

        Raises:
            ProcessingError: If URL is invalid or points to internal resources (SSRF protection)
        """
        if not url and not html_content:
            raise ValueError("Either url or html_content is required")

        # SSRF Protection: Validate URL before making any requests
        if url:
            validation_error = await validate_url_ssrf_safe_async(url)
            if validation_error:
                raise ProcessingError(f"URL validation failed: {validation_error}")

        # Try weasyprint first
        try:
            return await self._convert_with_weasyprint(
                output_path, url, html_content, page_size, margin
            )
        except Exception:
            pass

        # Fallback to playwright
        try:
            return await self._convert_with_playwright(
                output_path, url, html_content, page_size, margin
            )
        except Exception as e:
            raise RuntimeError(f"HTML to PDF conversion failed: {e}")

    async def _convert_with_weasyprint(
        self,
        output_path: Path,
        url: Optional[str],
        html_content: Optional[str],
        page_size: str,
        margin: int,
    ) -> Path:
        """Convert using weasyprint."""

        def _convert():
            from weasyprint import HTML, CSS

            css = CSS(string=f"""
                @page {{
                    size: {page_size};
                    margin: {margin}mm;
                }}
            """)

            if url:
                html = HTML(url=url)
            else:
                html = HTML(string=html_content)

            html.write_pdf(output_path, stylesheets=[css])
            return output_path

        return await asyncio.to_thread(_convert)

    async def _convert_with_playwright(
        self,
        output_path: Path,
        url: Optional[str],
        html_content: Optional[str],
        page_size: str,
        margin: int,
    ) -> Path:
        """Convert using playwright (headless browser)."""
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()

            if url:
                await page.goto(url, wait_until="networkidle")
            else:
                await page.set_content(html_content, wait_until="networkidle")

            # Convert page size to playwright format
            page_formats = {
                "A4": "A4",
                "Letter": "Letter",
                "Legal": "Legal",
                "Tabloid": "Tabloid",
            }

            await page.pdf(
                path=str(output_path),
                format=page_formats.get(page_size, "A4"),
                margin={
                    "top": f"{margin}mm",
                    "right": f"{margin}mm",
                    "bottom": f"{margin}mm",
                    "left": f"{margin}mm",
                },
                print_background=True,
            )

            await browser.close()

        return output_path
