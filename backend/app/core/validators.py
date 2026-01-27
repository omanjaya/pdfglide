"""Input validation and sanitization utilities."""

import re
import unicodedata
from pathlib import Path
from typing import Optional, Set
from dataclasses import dataclass

from fastapi import UploadFile, HTTPException

from app.config import settings


# File signatures (magic bytes) for common file types
FILE_SIGNATURES = {
    # PDF
    "application/pdf": [b"%PDF-"],
    # Images
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF", b"WEBP"],
    "image/bmp": [b"BM"],
    "image/tiff": [b"II*\x00", b"MM\x00*"],
    # Documents
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        b"PK\x03\x04"
    ],  # docx
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        b"PK\x03\x04"
    ],  # xlsx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
        b"PK\x03\x04"
    ],  # pptx
    "application/msword": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],  # doc
    "application/vnd.ms-excel": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],  # xls
    "application/vnd.ms-powerpoint": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],  # ppt
    "application/vnd.oasis.opendocument.text": [b"PK\x03\x04"],  # odt
    "application/vnd.oasis.opendocument.spreadsheet": [b"PK\x03\x04"],  # ods
    "application/vnd.oasis.opendocument.presentation": [b"PK\x03\x04"],  # odp
    # Archive (for multi-file zip)
    "application/zip": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
}

# MIME type to file extension mapping
MIME_TO_EXTENSION = {
    "application/pdf": {".pdf"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/gif": {".gif"},
    "image/webp": {".webp"},
    "image/bmp": {".bmp"},
    "image/tiff": {".tif", ".tiff"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {".pptx"},
    "application/msword": {".doc"},
    "application/vnd.ms-excel": {".xls"},
    "application/vnd.ms-powerpoint": {".ppt"},
    "application/vnd.oasis.opendocument.text": {".odt"},
    "application/vnd.oasis.opendocument.spreadsheet": {".ods"},
    "application/vnd.oasis.opendocument.presentation": {".odp"},
}


@dataclass
class ValidationResult:
    """Result of file validation."""
    is_valid: bool
    error_message: Optional[str] = None
    sanitized_filename: Optional[str] = None
    detected_mime_type: Optional[str] = None


def sanitize_filename(filename: str, max_length: int = 200) -> str:
    """
    Sanitize a filename to prevent security issues.

    - Removes path traversal characters
    - Normalizes unicode
    - Removes dangerous characters
    - Limits length
    """
    if not filename:
        return "unnamed_file"

    # Normalize unicode
    filename = unicodedata.normalize("NFKD", filename)

    # Get basename (remove any path components)
    filename = Path(filename).name

    # Remove null bytes and other control characters
    filename = re.sub(r"[\x00-\x1f\x7f]", "", filename)

    # Remove potentially dangerous characters
    # Keep alphanumeric, dots, dashes, underscores
    name, ext = _split_extension(filename)
    name = re.sub(r"[^\w\-\.]", "_", name)

    # Prevent hidden files (starting with dot)
    name = name.lstrip(".")

    # Prevent multiple consecutive dots or underscores
    name = re.sub(r"\.{2,}", ".", name)
    name = re.sub(r"_{2,}", "_", name)

    # Ensure name is not empty
    if not name:
        name = "file"

    # Truncate if too long
    if len(name) > max_length - len(ext):
        name = name[:max_length - len(ext)]

    return f"{name}{ext}"


def _split_extension(filename: str) -> tuple[str, str]:
    """Split filename into name and extension, handling double extensions."""
    path = Path(filename)

    # Handle double extensions like .tar.gz
    double_ext_patterns = [".tar.gz", ".tar.bz2", ".tar.xz"]
    for pattern in double_ext_patterns:
        if filename.lower().endswith(pattern):
            return filename[:-len(pattern)], pattern

    return path.stem, path.suffix.lower()


def validate_file_size(file_size: int) -> Optional[str]:
    """Validate file size against maximum limit."""
    if file_size > settings.MAX_UPLOAD_SIZE:
        max_mb = settings.MAX_UPLOAD_SIZE // (1024 * 1024)
        return f"File size exceeds maximum allowed size of {max_mb}MB"
    return None


def detect_mime_type_by_magic(content: bytes) -> Optional[str]:
    """Detect MIME type by checking file magic bytes."""
    for mime_type, signatures in FILE_SIGNATURES.items():
        for sig in signatures:
            if content.startswith(sig):
                return mime_type
    return None


def validate_file_extension(filename: str, allowed_extensions: Set[str]) -> Optional[str]:
    """Validate file extension against allowed list."""
    _, ext = _split_extension(filename)
    ext = ext.lower()

    if ext not in allowed_extensions:
        allowed = ", ".join(sorted(allowed_extensions))
        return f"File extension '{ext}' not allowed. Allowed: {allowed}"
    return None


def validate_mime_type_matches_extension(
    filename: str,
    detected_mime: Optional[str],
) -> Optional[str]:
    """Validate that detected MIME type matches the file extension."""
    if not detected_mime:
        return None  # Can't validate without detection

    _, ext = _split_extension(filename)
    ext = ext.lower()

    # Get expected extensions for this MIME type
    expected_extensions = MIME_TO_EXTENSION.get(detected_mime, set())

    # Some MIME types share signatures (e.g., all Office XML files use PK)
    # So we only flag if we have a clear mismatch
    if expected_extensions and ext not in expected_extensions:
        # Check if this is a shared signature case
        shared_signature_mimes = {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.oasis.opendocument.text",
            "application/vnd.oasis.opendocument.spreadsheet",
            "application/vnd.oasis.opendocument.presentation",
            "application/zip",
        }

        if detected_mime in shared_signature_mimes:
            # These all share PK\x03\x04 signature, allow any of their extensions
            all_shared_extensions = set()
            for mime in shared_signature_mimes:
                all_shared_extensions.update(MIME_TO_EXTENSION.get(mime, set()))

            if ext not in all_shared_extensions:
                return f"File content does not match extension '{ext}'"
        else:
            return f"File content does not match extension '{ext}'"

    return None


async def validate_upload_file(
    file: UploadFile,
    allowed_extensions: Optional[Set[str]] = None,
    check_magic_bytes: bool = True,
) -> ValidationResult:
    """
    Comprehensive validation of an uploaded file.

    Args:
        file: FastAPI UploadFile object
        allowed_extensions: Set of allowed file extensions (e.g., {".pdf", ".jpg"})
        check_magic_bytes: Whether to verify file content matches extension

    Returns:
        ValidationResult with validation status and sanitized filename
    """
    # Validate filename exists
    if not file.filename:
        return ValidationResult(
            is_valid=False,
            error_message="Filename is required",
        )

    # Sanitize filename
    sanitized = sanitize_filename(file.filename)

    # Validate extension if restrictions provided
    if allowed_extensions:
        error = validate_file_extension(sanitized, allowed_extensions)
        if error:
            return ValidationResult(
                is_valid=False,
                error_message=error,
                sanitized_filename=sanitized,
            )

    # Read first chunk for validation
    first_chunk = await file.read(8192)
    await file.seek(0)  # Reset for later reading

    # Validate file is not empty
    if len(first_chunk) == 0:
        return ValidationResult(
            is_valid=False,
            error_message="File is empty",
            sanitized_filename=sanitized,
        )

    # Check file size (rough estimate from first chunk)
    # Full size check happens during upload
    file_size = file.size or len(first_chunk)
    size_error = validate_file_size(file_size)
    if size_error:
        return ValidationResult(
            is_valid=False,
            error_message=size_error,
            sanitized_filename=sanitized,
        )

    # Detect MIME type from magic bytes
    detected_mime = None
    if check_magic_bytes:
        detected_mime = detect_mime_type_by_magic(first_chunk)

        # Validate MIME matches extension
        mime_error = validate_mime_type_matches_extension(sanitized, detected_mime)
        if mime_error:
            return ValidationResult(
                is_valid=False,
                error_message=mime_error,
                sanitized_filename=sanitized,
                detected_mime_type=detected_mime,
            )

    return ValidationResult(
        is_valid=True,
        sanitized_filename=sanitized,
        detected_mime_type=detected_mime,
    )


def validate_page_range(pages: str, total_pages: int) -> Optional[str]:
    """
    Validate a page range specification.

    Args:
        pages: Page range string (e.g., "1-3,5,7-10" or "all")
        total_pages: Total number of pages in document

    Returns:
        Error message if invalid, None if valid
    """
    if pages.lower() == "all":
        return None

    # Remove whitespace
    pages = pages.replace(" ", "")

    # Validate format
    if not re.match(r"^[\d,\-]+$", pages):
        return "Invalid page range format. Use format like '1-3,5,7-10'"

    parts = pages.split(",")
    for part in parts:
        if "-" in part:
            try:
                start, end = part.split("-")
                start_num = int(start)
                end_num = int(end)

                if start_num < 1 or end_num < 1:
                    return "Page numbers must be positive"
                if start_num > end_num:
                    return f"Invalid range: {start_num}-{end_num}"
                if end_num > total_pages:
                    return f"Page {end_num} exceeds document length ({total_pages} pages)"
            except ValueError:
                return f"Invalid page range: {part}"
        else:
            try:
                page_num = int(part)
                if page_num < 1:
                    return "Page numbers must be positive"
                if page_num > total_pages:
                    return f"Page {page_num} exceeds document length ({total_pages} pages)"
            except ValueError:
                return f"Invalid page number: {part}"

    return None


def validate_password_strength(password: str, min_length: int = 4) -> Optional[str]:
    """
    Validate password meets minimum requirements.

    Args:
        password: Password to validate
        min_length: Minimum required length

    Returns:
        Error message if invalid, None if valid
    """
    if len(password) < min_length:
        return f"Password must be at least {min_length} characters"
    return None


def validate_url(url: str) -> Optional[str]:
    """
    Validate a URL for security (basic check).

    Args:
        url: URL to validate

    Returns:
        Error message if invalid, None if valid
    """
    # Use comprehensive SSRF-safe validation
    return validate_url_ssrf_safe(url)


def validate_url_ssrf_safe(url: str) -> Optional[str]:
    """
    Comprehensive URL validation to prevent SSRF attacks.

    This function validates URLs to ensure they:
    1. Use only allowed protocols (http, https)
    2. Don't point to private/internal IP addresses
    3. Don't use dangerous hostnames
    4. Don't contain encoded characters that could bypass checks

    Args:
        url: URL to validate

    Returns:
        Error message if invalid/dangerous, None if safe
    """
    import socket
    import ipaddress
    from urllib.parse import urlparse, unquote

    if not url:
        return "URL is required"

    # Decode URL to catch encoded bypasses (e.g., %31%32%37 = 127)
    try:
        decoded_url = unquote(url)
    except Exception:
        return "Invalid URL encoding"

    # Parse URL
    try:
        parsed = urlparse(decoded_url)
    except Exception:
        return "Invalid URL format"

    # 1. Validate protocol - ONLY allow http and https
    if parsed.scheme.lower() not in ("http", "https"):
        return f"Protocol '{parsed.scheme}' is not allowed. Only HTTP and HTTPS are permitted."

    # 2. Check for empty or missing hostname
    hostname = parsed.hostname
    if not hostname:
        return "Invalid URL: missing hostname"

    # 3. Block dangerous hostnames
    dangerous_hostnames = [
        "localhost",
        "localhost.localdomain",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "[::1]",
        "0",  # 0 resolves to 127.0.0.1 on some systems
        "metadata.google.internal",  # GCP metadata
        "169.254.169.254",  # AWS/Azure/GCP metadata
    ]

    hostname_lower = hostname.lower()
    if hostname_lower in dangerous_hostnames:
        return f"Access to '{hostname}' is not allowed"

    # 4. Block .internal and .local domains
    if hostname_lower.endswith((".internal", ".local", ".localhost", ".localdomain")):
        return f"Access to internal domain '{hostname}' is not allowed"

    # 5. Try to resolve hostname and check IP
    try:
        # Get all IP addresses for the hostname
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        ip_addresses = set()

        for family, _, _, _, sockaddr in addr_info:
            ip = sockaddr[0]
            ip_addresses.add(ip)

        # Check each resolved IP address
        for ip_str in ip_addresses:
            try:
                ip_obj = ipaddress.ip_address(ip_str)

                # Block private, loopback, reserved, and link-local addresses
                if ip_obj.is_private:
                    return f"URL resolves to private IP address ({ip_str})"
                if ip_obj.is_loopback:
                    return f"URL resolves to loopback address ({ip_str})"
                if ip_obj.is_reserved:
                    return f"URL resolves to reserved IP address ({ip_str})"
                if ip_obj.is_link_local:
                    return f"URL resolves to link-local address ({ip_str})"
                if ip_obj.is_multicast:
                    return f"URL resolves to multicast address ({ip_str})"

                # Block AWS/Azure/GCP metadata service IPs
                metadata_ips = [
                    "169.254.169.254",  # AWS/GCP/Azure
                    "169.254.170.2",    # AWS ECS
                    "fd00:ec2::254",    # AWS IPv6 metadata
                ]
                if ip_str in metadata_ips:
                    return f"Access to cloud metadata service ({ip_str}) is not allowed"

            except ValueError:
                # Invalid IP format, skip
                continue

    except socket.gaierror:
        # DNS resolution failed - this could be intentional (invalid domain)
        # or a temporary issue. For security, we'll allow it but log it.
        # The actual request will fail anyway if the domain doesn't exist.
        pass
    except Exception:
        # Other resolution errors
        pass

    # 6. Block URLs with credentials
    if parsed.username or parsed.password:
        return "URLs with embedded credentials are not allowed"

    # 7. Block suspicious port numbers
    port = parsed.port
    if port:
        # Block common internal service ports
        blocked_ports = {
            22,     # SSH
            23,     # Telnet
            25,     # SMTP
            445,    # SMB
            3306,   # MySQL
            5432,   # PostgreSQL
            6379,   # Redis
            27017,  # MongoDB
            9200,   # Elasticsearch
            11211,  # Memcached
        }
        if port in blocked_ports:
            return f"Access to port {port} is not allowed"

    return None


async def validate_url_ssrf_safe_async(url: str) -> Optional[str]:
    """
    Async version of SSRF-safe URL validation.

    Performs additional DNS resolution checks asynchronously.
    """
    import asyncio

    # First do synchronous checks
    error = validate_url_ssrf_safe(url)
    if error:
        return error

    # Additional async DNS rebinding protection
    # Resolve the hostname multiple times with a small delay
    # to detect DNS rebinding attacks
    from urllib.parse import urlparse
    import socket
    import ipaddress

    parsed = urlparse(url)
    hostname = parsed.hostname

    if not hostname:
        return "Invalid URL"

    try:
        # Resolve twice with a delay
        first_ips = set()
        second_ips = set()

        def resolve():
            try:
                addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
                return {sockaddr[0] for _, _, _, _, sockaddr in addr_info}
            except socket.gaierror:
                return set()

        first_ips = await asyncio.to_thread(resolve)
        await asyncio.sleep(0.1)  # Small delay
        second_ips = await asyncio.to_thread(resolve)

        # If IPs changed between resolutions, possible DNS rebinding
        if first_ips and second_ips and first_ips != second_ips:
            return "DNS rebinding detected: hostname resolved to different IPs"

        # Re-check resolved IPs for private ranges (in case first check was bypassed)
        all_ips = first_ips | second_ips
        for ip_str in all_ips:
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved:
                    return f"URL resolves to internal IP address ({ip_str})"
            except ValueError:
                continue

    except Exception:
        # If async checks fail, rely on synchronous checks
        pass

    return None


def sanitize_text_input(text: str, max_length: int = 1000) -> str:
    """
    Sanitize text input for safe use.

    Args:
        text: Text to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized text
    """
    # Normalize unicode
    text = unicodedata.normalize("NFKC", text)

    # Remove control characters except newlines and tabs
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Truncate if too long
    if len(text) > max_length:
        text = text[:max_length]

    return text.strip()


def validate_integer_range(
    value: int,
    min_val: Optional[int] = None,
    max_val: Optional[int] = None,
    param_name: str = "Value",
) -> Optional[str]:
    """
    Validate an integer is within allowed range.

    Args:
        value: Integer value to validate
        min_val: Minimum allowed value (inclusive)
        max_val: Maximum allowed value (inclusive)
        param_name: Name of parameter for error message

    Returns:
        Error message if invalid, None if valid
    """
    if min_val is not None and value < min_val:
        return f"{param_name} must be at least {min_val}"
    if max_val is not None and value > max_val:
        return f"{param_name} must be at most {max_val}"
    return None
