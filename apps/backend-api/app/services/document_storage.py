"""Supabase Storage adapter for public portfolio documents."""

from io import BytesIO
from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from app.repositories import base

BUCKET = "portfolio-documents"
MAX_FILE_BYTES = 25 * 1024 * 1024

ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _matches_file_format(suffix: str, content: bytes) -> bool:
    if suffix == ".pdf":
        return content.startswith(b"%PDF-")
    if suffix in {".doc", ".ppt"}:
        return content.startswith(OLE_SIGNATURE)
    if suffix in {".docx", ".pptx"}:
        try:
            with ZipFile(BytesIO(content)) as archive:
                names = set(archive.namelist())
        except (BadZipFile, OSError):
            return False
        required_prefix = "word/" if suffix == ".docx" else "ppt/"
        return "[Content_Types].xml" in names and any(
            name.startswith(required_prefix) for name in names
        )
    return False


class InvalidDocument(ValueError):
    """The uploaded file is unsupported or unsafe for the public library."""


def validate_upload(filename: str | None, content: bytes) -> tuple[str, str]:
    if not filename:
        raise InvalidDocument("Choose a document to upload.")
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_TYPES:
        raise InvalidDocument("Upload a PDF, Word document, or PowerPoint file.")
    if not content:
        raise InvalidDocument("The uploaded document is empty.")
    if len(content) > MAX_FILE_BYTES:
        raise InvalidDocument("The document is larger than the 25 MB limit.")
    if not _matches_file_format(suffix, content):
        raise InvalidDocument("The file contents do not match its document type.")
    return suffix, ALLOWED_TYPES[suffix]


async def upload_public_document(
    filename: str | None,
    content: bytes,
) -> tuple[str, str, str]:
    """Return storage path, public URL, and canonical MIME type."""
    suffix, mime_type = validate_upload(filename, content)
    path = f"{uuid4().hex}{suffix}"
    client = await base.get_supabase()
    bucket = client.storage.from_(BUCKET)
    await bucket.upload(
        path,
        content,
        {
            "content-type": mime_type,
            "cache-control": "3600",
            "upsert": "false",
        },
    )
    return path, await bucket.get_public_url(path), mime_type


async def delete_public_document(path: str) -> None:
    client = await base.get_supabase()
    await client.storage.from_(BUCKET).remove([path])
