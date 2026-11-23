"""Upload validation and processing. Type is decided from file CONTENT (magic bytes /
Pillow), never from the client-supplied filename or content type."""
import io
import logging
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.storage.base import get_storage

log = logging.getLogger("app.media")

CHUNK = 1024 * 1024
IMAGE_FORMATS = {"JPEG", "PNG", "WEBP", "GIF"}
MAX_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


@dataclass
class Stored:
    kind: str
    url: str
    thumbnail_url: str | None
    storage_key: str
    thumb_key: str | None
    mime_type: str
    size_bytes: int


def _detect(head: bytes) -> tuple[str, str] | None:
    if head.startswith(b"\x89PNG\r\n\x1a\n") or head[:3] == b"\xff\xd8\xff" or head[:6] in (b"GIF87a", b"GIF89a") or (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
        return "image", "image"
    if head[4:8] == b"ftyp":
        return "video", "video/mp4"
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return "video", "video/webm"
    if head[:5] == b"%PDF-":
        return "document", "application/pdf"
    return None


def _limit(kind: str) -> int:
    s = get_settings()
    return {"image": s.max_image_mb, "video": s.max_video_mb, "document": s.max_document_mb}[kind] * 1024 * 1024


async def _spool(file: UploadFile, hard_cap: int) -> tuple[Path, int]:
    size = 0
    tmp = tempfile.NamedTemporaryFile(delete=False)
    try:
        while chunk := await file.read(CHUNK):
            size += len(chunk)
            if size > hard_cap:
                raise HTTPException(413, "File is too large")
            tmp.write(chunk)
    except Exception:
        tmp.close()
        Path(tmp.name).unlink(missing_ok=True)
        raise
    tmp.close()
    return Path(tmp.name), size


def _process_image(path: Path) -> tuple[bytes, bytes]:
    try:
        with Image.open(path) as im:
            if im.format not in IMAGE_FORMATS:
                raise HTTPException(415, "Unsupported image format")
            im.load()
            img = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(415, "Invalid or unsafe image file") from None
    full = img.copy()
    full.thumbnail((2000, 2000))
    thumb = img.copy()
    thumb.thumbnail((480, 480))
    out, tb = io.BytesIO(), io.BytesIO()
    full.save(out, "WEBP", quality=85, method=4)  # re-encoding also strips metadata
    thumb.save(tb, "WEBP", quality=80, method=4)
    return out.getvalue(), tb.getvalue()


async def store_upload(file: UploadFile, expected_kind: str | None = None) -> Stored:
    hard_cap = max(_limit("image"), _limit("video"), _limit("document"))
    path, size = await _spool(file, hard_cap)
    try:
        if size == 0:
            raise HTTPException(400, "Empty file")
        with path.open("rb") as f:
            det = _detect(f.read(16))
        if not det:
            raise HTTPException(415, "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, PDF")
        kind, mime = det
        if expected_kind and kind != expected_kind:
            raise HTTPException(415, f"Expected a {expected_kind} file")
        if size > _limit(kind):
            raise HTTPException(413, f"{kind.capitalize()} exceeds the {_limit(kind) // (1024 * 1024)} MB limit")
        storage = get_storage()
        uid = uuid.uuid4().hex
        if kind == "image":
            full, thumb = _process_image(path)
            key, tkey = f"images/{uid}.webp", f"images/{uid}_thumb.webp"
            url = storage.save(key, full, "image/webp")
            turl = storage.save(tkey, thumb, "image/webp")
            return Stored("image", url, turl, key, tkey, "image/webp", len(full))
        ext = {"video/mp4": "mp4", "video/webm": "webm", "application/pdf": "pdf"}[mime]
        key = f"{'videos' if kind == 'video' else 'documents'}/{uid}.{ext}"
        url = storage.save(key, path, mime)
        return Stored(kind, url, None, key, None, mime, size)
    finally:
        path.unlink(missing_ok=True)


def delete_stored(storage_key: str | None, thumb_key: str | None = None) -> None:
    storage = get_storage()
    for k in (storage_key, thumb_key):
        if k:
            try:
                storage.delete(k)
            except Exception:  # a file that is already gone must not block row deletion
                log.warning("could not delete stored file")
