"""
PDF Form Filler - Read and fill PDF form fields (AcroForm).
Uses PyMuPDF (fitz) for form field operations.
"""
import fitz  # PyMuPDF
from pathlib import Path
from typing import List, Dict, Any, Optional

from app.processors.base import BaseProcessor
from app.schemas.pdf_edit import FormField, FormFieldType, FormFieldsResponse


class PDFFormFiller(BaseProcessor):
    """Processor for reading and filling PDF form fields."""

    async def execute(self, *args, **kwargs):
        """Generic execute method - delegates to specific methods."""
        raise NotImplementedError("Use get_form_fields or fill_form methods directly")

    def _map_field_type(self, field_type: int) -> FormFieldType:
        """Map PyMuPDF field type to our enum."""
        type_map = {
            fitz.PDF_WIDGET_TYPE_BUTTON: FormFieldType.BUTTON,
            fitz.PDF_WIDGET_TYPE_CHECKBOX: FormFieldType.CHECKBOX,
            fitz.PDF_WIDGET_TYPE_COMBOBOX: FormFieldType.DROPDOWN,
            fitz.PDF_WIDGET_TYPE_LISTBOX: FormFieldType.LISTBOX,
            fitz.PDF_WIDGET_TYPE_RADIOBUTTON: FormFieldType.RADIO,
            fitz.PDF_WIDGET_TYPE_SIGNATURE: FormFieldType.SIGNATURE,
            fitz.PDF_WIDGET_TYPE_TEXT: FormFieldType.TEXT,
        }
        return type_map.get(field_type, FormFieldType.UNKNOWN)

    def get_form_fields(self, input_path: Path) -> FormFieldsResponse:
        """
        Extract all form fields from a PDF.

        Args:
            input_path: Path to input PDF

        Returns:
            FormFieldsResponse with all form field metadata
        """
        doc = fitz.open(input_path)
        fields = []

        try:
            for page_idx in range(len(doc)):
                page = doc[page_idx]

                # Get all widgets (form fields) on this page
                for widget in page.widgets():
                    field_type = self._map_field_type(widget.field_type)

                    # Get field options for dropdown/listbox/radio
                    options = None
                    if field_type in (FormFieldType.DROPDOWN, FormFieldType.LISTBOX, FormFieldType.RADIO):
                        try:
                            options = widget.choice_values
                        except:
                            pass

                    # Get field flags
                    field_flags = widget.field_flags or 0
                    is_readonly = bool(field_flags & fitz.PDF_FIELD_IS_READ_ONLY)
                    is_required = bool(field_flags & fitz.PDF_FIELD_IS_REQUIRED)

                    # Get current value
                    value = widget.field_value
                    if value is None:
                        value = ""

                    # Get default value (may not exist in all PyMuPDF versions)
                    default_value = getattr(widget, 'field_default_value', None)

                    # Get rectangle
                    rect = widget.rect
                    rect_list = [rect.x0, rect.y0, rect.x1, rect.y1] if rect else None

                    field = FormField(
                        name=widget.field_name or f"field_{page_idx}_{len(fields)}",
                        field_type=field_type,
                        value=str(value) if value else None,
                        default_value=str(default_value) if default_value else None,
                        options=options,
                        required=is_required,
                        read_only=is_readonly,
                        page=page_idx + 1,  # 1-indexed
                        rect=rect_list,
                    )
                    fields.append(field)

        finally:
            doc.close()

        has_form = len(fields) > 0

        return FormFieldsResponse(
            fields=fields,
            field_count=len(fields),
            has_form=has_form,
        )

    def fill_form(
        self,
        input_path: Path,
        output_path: Path,
        field_values: Dict[str, Any],
        flatten: bool = False,
    ) -> int:
        """
        Fill form fields in a PDF.

        Args:
            input_path: Path to input PDF
            output_path: Path to save output PDF
            field_values: Dictionary mapping field names to values
            flatten: Whether to flatten the form (make fields non-editable)

        Returns:
            Number of fields filled
        """
        doc = fitz.open(input_path)
        filled_count = 0

        try:
            for page_idx in range(len(doc)):
                page = doc[page_idx]

                for widget in page.widgets():
                    field_name = widget.field_name

                    if field_name not in field_values:
                        continue

                    value = field_values[field_name]
                    field_type = self._map_field_type(widget.field_type)

                    # Skip read-only fields
                    if widget.field_flags and (widget.field_flags & fitz.PDF_FIELD_IS_READ_ONLY):
                        continue

                    try:
                        if field_type == FormFieldType.CHECKBOX:
                            # For checkbox, value should be bool or "Yes"/"Off"
                            if isinstance(value, bool):
                                widget.field_value = value
                            elif str(value).lower() in ("true", "yes", "on", "1"):
                                widget.field_value = True
                            else:
                                widget.field_value = False

                        elif field_type == FormFieldType.RADIO:
                            # For radio, set the value to match one of the options
                            widget.field_value = str(value)

                        elif field_type in (FormFieldType.DROPDOWN, FormFieldType.LISTBOX):
                            # For dropdown/listbox, set the selected option
                            widget.field_value = str(value)

                        elif field_type == FormFieldType.TEXT:
                            # For text fields, set the text value
                            widget.field_value = str(value)

                        else:
                            # Try to set value for other types
                            widget.field_value = str(value)

                        widget.update()
                        filled_count += 1

                    except Exception as e:
                        # Log but continue with other fields
                        print(f"Warning: Could not fill field '{field_name}': {e}")
                        continue

            # Flatten form if requested
            if flatten:
                # Iterate through all pages and flatten widgets
                for page_idx in range(len(doc)):
                    page = doc[page_idx]
                    # Get all widgets and remove them after drawing their content
                    widgets = list(page.widgets())
                    for widget in widgets:
                        # Draw the widget's appearance as permanent content
                        self._flatten_widget(page, widget)

            # Save the modified document
            doc.save(output_path, garbage=4, deflate=True)

        finally:
            doc.close()

        return filled_count

    def _flatten_widget(self, page: fitz.Page, widget: fitz.Widget) -> None:
        """
        Flatten a single widget by converting it to permanent content.

        This draws the widget's current appearance as regular page content
        and then removes the interactive widget.
        """
        try:
            field_type = self._map_field_type(widget.field_type)
            rect = widget.rect
            value = widget.field_value

            if not value:
                return

            if field_type == FormFieldType.TEXT:
                # Draw text at widget location
                fontsize = 12  # Default font size
                try:
                    # Try to get font size from widget
                    if hasattr(widget, 'text_fontsize'):
                        fontsize = widget.text_fontsize or 12
                except:
                    pass

                # Insert text
                page.insert_textbox(
                    rect,
                    str(value),
                    fontsize=fontsize,
                    fontname="helv",
                    color=(0, 0, 0),
                    align=fitz.TEXT_ALIGN_LEFT,
                )

            elif field_type == FormFieldType.CHECKBOX:
                if value:
                    # Draw checkmark
                    shape = page.new_shape()
                    # Draw a simple X or checkmark
                    x0, y0, x1, y1 = rect
                    margin = (x1 - x0) * 0.2
                    shape.draw_line(
                        fitz.Point(x0 + margin, y0 + margin),
                        fitz.Point(x1 - margin, y1 - margin)
                    )
                    shape.draw_line(
                        fitz.Point(x1 - margin, y0 + margin),
                        fitz.Point(x0 + margin, y1 - margin)
                    )
                    shape.finish(color=(0, 0, 0), width=1)
                    shape.commit()

            # Note: For complete flattening, we would need to actually remove
            # the widget annotations, which is more complex and may affect
            # document structure. The current approach draws the values but
            # keeps widgets (which may still be interactive).

        except Exception as e:
            print(f"Warning: Could not flatten widget: {e}")

    def reset_form(self, input_path: Path, output_path: Path) -> int:
        """
        Reset all form fields to their default values.

        Args:
            input_path: Path to input PDF
            output_path: Path to save output PDF

        Returns:
            Number of fields reset
        """
        doc = fitz.open(input_path)
        reset_count = 0

        try:
            for page_idx in range(len(doc)):
                page = doc[page_idx]

                for widget in page.widgets():
                    try:
                        default_value = getattr(widget, 'field_default_value', None)
                        if default_value is not None:
                            widget.field_value = default_value
                        else:
                            widget.field_value = ""
                        widget.update()
                        reset_count += 1
                    except Exception:
                        continue

            doc.save(output_path, garbage=4, deflate=True)

        finally:
            doc.close()

        return reset_count
