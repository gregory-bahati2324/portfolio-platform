import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.admin.common import ADMIN_DEPS, commit, get_or_404
from app.core.db import get_db
from app.core.security import current_admin
from app.models import AdminUser, MediaAsset, Profile, Project, ProjectMedia, SiteSettings
from app.schemas import admin as s
from app.services.audit import audit
from app.services.media import delete_stored, store_upload
from app.storage.base import get_storage

router = APIRouter(prefix="/media", dependencies=ADMIN_DEPS)


def _usage(db: Session, mid: uuid.UUID) -> list[str]:
    used = []
    if db.scalars(select(ProjectMedia.id).where(ProjectMedia.media_id == mid).limit(1)).first():
        used.append("project gallery")
    if db.scalars(select(Project.id).where(Project.main_image_id == mid, Project.deleted_at.is_(None)).limit(1)).first():
        used.append("project main image")
    if db.scalars(select(Profile.id).where((Profile.photo_id == mid) | (Profile.cv_id == mid)).limit(1)).first():
        used.append("profile")
    if db.scalars(select(SiteSettings.id).where(SiteSettings.logo_id == mid).limit(1)).first():
        used.append("site logo")
    return used


def _out(db: Session, m: MediaAsset) -> s.MediaOut:
    out = s.MediaOut.model_validate(m)
    out.in_use = bool(_usage(db, m.id))
    return out


@router.get("", response_model=list[s.MediaOut])
def list_media(kind: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(MediaAsset).order_by(MediaAsset.created_at.desc()).limit(500)
    if kind:
        stmt = stmt.where(MediaAsset.kind == kind)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(MediaAsset.alt_text.ilike(like) | MediaAsset.description.ilike(like) | MediaAsset.original_filename.ilike(like))
    return [_out(db, m) for m in db.scalars(stmt).all()]


@router.post("", response_model=s.MediaOut, status_code=201)
async def upload_media(
    request: Request, file: UploadFile = File(...), alt_text: str = Form("", max_length=300),
    description: str = Form("", max_length=2000), category: str = Form("", max_length=64),
    user: AdminUser = Depends(current_admin), db: Session = Depends(get_db),
):
    st = await store_upload(file)
    m = MediaAsset(
        kind=st.kind, url=st.url, thumbnail_url=st.thumbnail_url, storage_key=st.storage_key, thumb_key=st.thumb_key,
        mime_type=st.mime_type, size_bytes=st.size_bytes, alt_text=alt_text, description=description,
        category=category or None, original_filename=(file.filename or "")[:255],
    )
    db.add(m)
    audit(db, user, "media_uploaded", request, "media", "", kind=st.kind)
    try:
        commit(db)
    except Exception:
        delete_stored(st.storage_key, st.thumb_key)
        raise
    return _out(db, m)


@router.patch("/{id}", response_model=s.MediaOut)
def update_media(id: uuid.UUID, data: s.MediaUpdate, db: Session = Depends(get_db)):
    m = get_or_404(db, MediaAsset, id, "Media")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    commit(db)
    return _out(db, m)


@router.post("/{id}/replace", response_model=s.MediaOut)
async def replace_media(id: uuid.UUID, request: Request, file: UploadFile = File(...), user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    m = get_or_404(db, MediaAsset, id, "Media")
    st = await store_upload(file, expected_kind=m.kind)
    old = (m.storage_key, m.thumb_key)
    m.url, m.thumbnail_url, m.storage_key, m.thumb_key = st.url, st.thumbnail_url, st.storage_key, st.thumb_key
    m.mime_type, m.size_bytes, m.original_filename = st.mime_type, st.size_bytes, (file.filename or "")[:255]
    audit(db, user, "media_replaced", request, "media", id)
    commit(db)
    delete_stored(*old)
    return _out(db, m)


@router.delete("/{id}", status_code=204)
def delete_media(id: uuid.UUID, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    m = get_or_404(db, MediaAsset, id, "Media")
    used = _usage(db, id)
    if used:
        raise HTTPException(409, "Media is in use: " + ", ".join(used))
    keys = (m.storage_key, m.thumb_key)
    db.delete(m)
    audit(db, user, "media_deleted", request, "media", id)
    commit(db)
    delete_stored(*keys)


@router.post("/presign")
def presign_upload(kind: str = Form(..., pattern="^(video|document)$"), content_type: str = Form(...), db: Session = Depends(get_db)):
    """Direct-to-bucket upload for large videos (S3/R2 only)."""
    allowed = {"video": {"video/mp4", "video/webm"}, "document": {"application/pdf"}}[kind]
    if content_type not in allowed:
        raise HTTPException(415, "Unsupported content type")
    key = f"{kind}s/{uuid.uuid4().hex}.{content_type.split('/')[-1].replace('mp4', 'mp4')}"
    target = get_storage().presign_upload(key, content_type)
    if target is None:
        raise HTTPException(501, "Direct upload requires STORAGE_BACKEND=s3; use the regular upload endpoint locally")
    return target
