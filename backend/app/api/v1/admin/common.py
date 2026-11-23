import uuid

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import csrf_protect, current_admin
from app.core.text import slugify
from app.models import MediaAsset

ADMIN_DEPS = [Depends(current_admin), Depends(csrf_protect)]


def unique_slug(db: Session, model, base: str, exclude_id: uuid.UUID | None = None) -> str:
    base = slugify(base)
    slug, n = base, 2
    while True:
        q = select(model).where(model.slug == slug)
        if exclude_id:
            q = q.where(model.id != exclude_id)
        if not db.scalars(q).first():
            return slug
        slug, n = f"{base}-{n}", n + 1


def get_or_404(db: Session, model, id: uuid.UUID, what: str = "Item"):
    obj = db.get(model, id)
    if not obj or getattr(obj, "deleted_at", None):
        raise HTTPException(404, f"{what} not found")
    return obj


def check_media(db: Session, *ids: uuid.UUID | None) -> None:
    for i in ids:
        if i and not db.get(MediaAsset, i):
            raise HTTPException(422, "Referenced media does not exist")


def commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Conflicts with existing data (duplicate or in use)") from None
