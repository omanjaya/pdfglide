"""PDF protector processor."""

import asyncio
from pathlib import Path
from typing import Optional

from app.processors.base import BaseProcessor
from app.core.exceptions import ProcessingError


class PDFProtector(BaseProcessor):
    """Protect PDF with password and permissions."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        user_password: Optional[str] = None,
        owner_password: Optional[str] = None,
        allow_printing: bool = True,
        allow_copying: bool = False,
        allow_modifying: bool = False,
    ) -> Path:
        """
        Protect PDF with password.

        Args:
            file: Input PDF file path
            output_path: Output file path
            user_password: Password to open document (optional)
            owner_password: Password for full access (required if user_password set)
            allow_printing: Allow printing
            allow_copying: Allow copying text
            allow_modifying: Allow modifying

        Returns:
            Path to protected PDF
        """
        if not user_password and not owner_password:
            raise ProcessingError("At least one password is required")

        # Owner password is required if user password is set
        if user_password and not owner_password:
            owner_password = user_password

        def _protect():
            import pikepdf
            from pikepdf import Permissions

            with pikepdf.open(file) as pdf:
                # Set permissions
                permissions = Permissions(
                    print_lowres=allow_printing,
                    print_highres=allow_printing,
                    extract=allow_copying,
                    modify_annotation=allow_modifying,
                    modify_form=allow_modifying,
                    modify_assembly=allow_modifying,
                    modify_other=allow_modifying,
                )

                # Save with encryption
                pdf.save(
                    output_path,
                    encryption=pikepdf.Encryption(
                        user=user_password or "",
                        owner=owner_password,
                        allow=permissions,
                    ),
                )

            return output_path

        try:
            return await asyncio.to_thread(_protect)
        except Exception as e:
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to protect PDF: {str(e)}")
            raise ProcessingError(f"Unexpected error: {str(e)}")


class PDFUnlocker(BaseProcessor):
    """Remove password protection from PDF."""

    async def execute(
        self,
        file: Path,
        output_path: Path,
        password: str = "",
    ) -> Path:
        """
        Remove password from PDF.

        Args:
            file: Input PDF file path
            output_path: Output file path
            password: Password to unlock (if required)

        Returns:
            Path to unlocked PDF
        """

        def _unlock():
            import pikepdf

            with pikepdf.open(file, password=password) as pdf:
                # Save without encryption
                pdf.save(output_path)

            return output_path

        try:
            return await asyncio.to_thread(_unlock)
        except Exception as e:
            err_str = str(e).lower()
            if "password" in err_str:
                raise ProcessingError("Incorrect password")
            if "pikepdf" in str(type(e).__module__):
                raise ProcessingError(f"Failed to unlock PDF: {str(e)}")
            raise ProcessingError(f"Unexpected error: {str(e)}")
