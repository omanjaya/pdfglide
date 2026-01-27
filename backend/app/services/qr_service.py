"""QR Code generation service."""

from pathlib import Path

from app.services.base import BaseService, ProcessedResult
from app.processors.other.qr_generator import QRCodeGenerator


class QRService(BaseService):
    """Service for QR code generation."""

    ALLOWED_TYPES: list[str] = []  # No file upload needed

    def __init__(self, storage_path: Path):
        super().__init__(storage_path)
        self.generator = QRCodeGenerator(self.processed_dir)

    async def generate(
        self,
        content: str,
        size: int = 400,
    ) -> ProcessedResult:
        """Generate QR code from content."""
        output_id = self.generate_output_id()
        output_path = self.get_output_path(output_id, ".png")

        await self.generator.execute(content, output_path, size)

        return ProcessedResult(
            id=output_id,
            file_name="qrcode.png",
            file_path=output_path,
            file_size=output_path.stat().st_size,
            mime_type="image/png",
        )
