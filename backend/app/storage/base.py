from pathlib import Path
from typing import Protocol

from app.core.config import get_settings


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes | Path, content_type: str) -> str:
        """Store an object and return its public URL."""

    def delete(self, key: str) -> None: ...

    def presign_upload(self, key: str, content_type: str, expires: int = 900) -> dict | None:
        """Direct-to-storage upload target (large videos). None when unsupported."""


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:
            raise ValueError("Invalid storage key")
        return p

    def save(self, key: str, data: bytes | Path, content_type: str) -> str:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, Path):
            p.write_bytes(data.read_bytes())
        else:
            p.write_bytes(data)
        return f"/media/{key}"

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def presign_upload(self, key: str, content_type: str, expires: int = 900) -> dict | None:
        return None


class S3Storage:
    """S3-compatible storage (AWS S3, Cloudflare R2). Not exercised by automated tests:
    verify against a real bucket before production use."""

    def __init__(self):
        import boto3

        s = get_settings()
        self.bucket = s.s3_bucket
        self.public_base = s.s3_public_base_url.rstrip("/")
        self.client = boto3.client(
            "s3", endpoint_url=s.s3_endpoint_url or None,
            aws_access_key_id=s.s3_access_key_id, aws_secret_access_key=s.s3_secret_access_key,
        )

    def save(self, key: str, data: bytes | Path, content_type: str) -> str:
        body = data.read_bytes() if isinstance(data, Path) else data
        self.client.put_object(Bucket=self.bucket, Key=key, Body=body, ContentType=content_type, CacheControl="public, max-age=31536000, immutable")
        return f"{self.public_base}/{key}"

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def presign_upload(self, key: str, content_type: str, expires: int = 900) -> dict | None:
        url = self.client.generate_presigned_url(
            "put_object", Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type}, ExpiresIn=expires
        )
        return {"upload_url": url, "key": key, "public_url": f"{self.public_base}/{key}", "method": "PUT", "headers": {"Content-Type": content_type}}


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        s = get_settings()
        _storage = S3Storage() if s.storage_backend == "s3" else LocalStorage(s.local_media_dir)
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
