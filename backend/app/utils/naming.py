"""User-facing download names.

Files are stored on disk under internal names such as
``{uuid}_{timestamp}_{order}_{original_stem}.pdf``. Those identifiers are needed
for tracking but must never reach the user. This module is the single place
that turns a stored path (or an original upload name) into the name the user
sees in the download dialog, e.g. ``Onco_n_ILD_IC_compressed.pdf``.
"""

import re
from pathlib import Path
from typing import Optional, Union

MAX_STEM_LENGTH = 80
DEFAULT_STEM = "file"

# One internal ID: 32 hex chars (uuid4().hex) + "_" + unix timestamp,
# as produced by FileHandler.generate_file_id().
_INTERNAL_ID = r"[a-f0-9]{32}_\d{9,11}"

# Leading internal IDs, each optionally followed by the upload order
# ("_0", "_1", ...) that BaseService.save_input_file() appends.
_STORAGE_PREFIX_RE = re.compile(
    rf"^(?:{_INTERNAL_ID}(?:_\d{{1,3}}(?=_|$))?(?:_|$))+",
    re.IGNORECASE,
)

_SEPARATORS = " _-."


def strip_storage_prefix(stem: str) -> str:
    """Remove the internal ``{uuid}_{timestamp}[_{order}]_`` prefix from a stem.

    A stem without such a prefix is returned unchanged.
    """
    return _STORAGE_PREFIX_RE.sub("", stem)


def clean_stem(stem: str, fallback: str = DEFAULT_STEM) -> str:
    """Make a stem safe and tidy for use in a download name.

    Unsafe characters become underscores, repeated underscores and spaces are
    collapsed, and leading/trailing separators are removed. Returns
    ``fallback`` when nothing readable is left.
    """
    stem = "".join(c if (c.isalnum() or c in _SEPARATORS) else "_" for c in stem)
    stem = re.sub(r"\s+", " ", stem)
    # Any run of spaces/underscores that contains an underscore becomes one "_"
    stem = re.sub(r" *_[ _]*", "_", stem)
    stem = re.sub(r"\.{2,}", ".", stem)
    stem = stem.strip(_SEPARATORS)
    if len(stem) > MAX_STEM_LENGTH:
        stem = stem[:MAX_STEM_LENGTH].rstrip(_SEPARATORS)
    return stem or fallback


def _normalize_extension(extension: Optional[str]) -> str:
    if not extension:
        return ""
    # Extensions are short and alphanumeric; drop anything else (e.g. "/")
    extension = "".join(c for c in extension if c.isalnum() or c == ".").strip(".")
    extension = re.sub(r"\.{2,}", ".", extension)
    return f".{extension}" if extension else ""


def build_download_name(
    source: Union[str, Path, None],
    operation: Optional[str] = None,
    extension: Optional[str] = None,
    fallback: str = DEFAULT_STEM,
) -> str:
    """Build the name the user sees for a processed file.

    Args:
        source: Stored input path or original file name the output derives from.
        operation: Short suffix describing the action (e.g. ``"compressed"``).
            Omit for pure format conversions, where the new extension already
            describes the action.
        extension: Output extension, with or without the leading dot. Defaults
            to the extension of ``source``.
        fallback: Stem to use when ``source`` has no readable name.

    Returns:
        A name such as ``Onco_n_ILD_IC_compressed.pdf``.
    """
    source_path = Path(str(source)) if source else None
    raw_stem = source_path.stem if source_path else ""
    if extension is None and source_path is not None:
        extension = source_path.suffix

    stem = clean_stem(strip_storage_prefix(raw_stem), fallback=fallback)
    suffix = clean_stem(operation, fallback="") if operation else ""
    name = f"{stem}_{suffix}" if suffix else stem
    return f"{name}{_normalize_extension(extension)}"


def clean_download_name(file_name: str, fallback: str = DEFAULT_STEM) -> str:
    """Tidy an already-built download name, keeping its extension.

    Safety net for names that were built without :func:`build_download_name`:
    strips any leaked internal prefix and cleans up the separators.
    """
    return build_download_name(file_name, fallback=fallback)
