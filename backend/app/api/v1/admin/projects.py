import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.admin.common import ADMIN_DEPS, check_media, commit, get_or_404, unique_slug
from app.core.db import get_db
from app.core.security import current_admin
from app.models import AdminUser, Project, ProjectCategory, ProjectMedia, Service, Skill
from app.schemas import admin as s
from app.schemas import public as pub
from app.services.audit import audit

router = APIRouter(prefix="/projects", dependencies=ADMIN_DEPS)
LOAD = (selectinload(Project.skills), selectinload(Project.media).selectinload(ProjectMedia.asset))


def _out(p: Project) -> s.ProjectAdminOut:
    plain = {f: getattr(p, f) for f in s.ProjectAdminOut.model_fields if f not in ("skill_ids", "media")}
    out = s.ProjectAdminOut(**plain)
    out.skill_ids = [k.id for k in p.skills if k.deleted_at is None]
    out.media = [
        s.ProjectMediaOut(media_id=m.media_id, caption=m.caption, kind=m.asset.kind, url=m.asset.url, thumbnail_url=m.asset.thumbnail_url)
        for m in p.media
    ]
    return out


def _apply(db: Session, p: Project, data: s.ProjectIn) -> None:
    check_media(db, data.main_image_id, *[m.media_id for m in data.media])
    if data.category_id:
        get_or_404(db, ProjectCategory, data.category_id, "Category")
    if data.service_id:
        get_or_404(db, Service, data.service_id, "Service")
    d = data.model_dump(exclude={"skill_ids", "media", "slug"})
    for k, v in d.items():
        setattr(p, k, v)
    p.slug = unique_slug(db, Project, data.slug or p.slug or data.title, exclude_id=p.id if p.id else None)
    skills = db.scalars(select(Skill).where(Skill.id.in_(data.skill_ids), Skill.deleted_at.is_(None))).all() if data.skill_ids else []
    if len(skills) != len(set(data.skill_ids)):
        raise HTTPException(422, "Unknown skill in skill_ids")
    p.skills = list(skills)
    p.media.clear()
    db.flush()
    for i, m in enumerate(data.media):
        p.media.append(ProjectMedia(media_id=m.media_id, caption=m.caption, sort_order=i))


@router.get("", response_model=list[s.ProjectAdminOut])
def list_projects(published: bool | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Project).where(Project.deleted_at.is_(None)).options(*LOAD).order_by(Project.sort_order, Project.created_at.desc())
    if published is not None:
        stmt = stmt.where(Project.is_published.is_(published))
    if q:
        stmt = stmt.where(Project.title.ilike(f"%{q.strip()}%"))
    return [_out(p) for p in db.scalars(stmt).all()]


@router.post("", response_model=s.ProjectAdminOut, status_code=201)
def create_project(data: s.ProjectIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    p = Project(title=data.title, is_published=False)  # always starts as a draft
    db.add(p)
    _apply(db, p, data)
    db.flush()
    audit(db, user, "project_created", request, "project", p.id, title=p.title)
    commit(db)
    return _out(p)


@router.get("/{id}", response_model=s.ProjectAdminOut)
def get_project(id: uuid.UUID, db: Session = Depends(get_db)):
    p = db.scalars(select(Project).where(Project.id == id, Project.deleted_at.is_(None)).options(*LOAD)).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return _out(p)


@router.get("/{id}/preview", response_model=pub.ProjectDetailOut)
def preview_project(id: uuid.UUID, db: Session = Depends(get_db)):
    """Renders exactly what visitors will see, including for unpublished drafts."""
    from app.api.v1.public import _card

    p = db.scalars(select(Project).where(Project.id == id, Project.deleted_at.is_(None)).options(
        selectinload(Project.category), selectinload(Project.main_image), selectinload(Project.service), *LOAD)).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return pub.ProjectDetailOut(
        **_card(p).model_dump(), description=p.description, problem=p.problem, solution=p.solution,
        architecture=p.architecture, how_it_works=p.how_it_works, challenges=p.challenges, results=p.results,
        github_url=p.github_url, live_url=p.live_url, docs_url=p.docs_url,
        service_slug=p.service.slug if p.service else None, service_title=p.service.title if p.service else None,
        skills=[k.name for k in p.skills if k.deleted_at is None],
        media=[pub.ProjectMediaOut(caption=m.caption, asset=m.asset) for m in p.media],
    )


@router.put("/{id}", response_model=s.ProjectAdminOut)
def update_project(id: uuid.UUID, data: s.ProjectIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    p = get_or_404(db, Project, id, "Project")
    _apply(db, p, data)
    audit(db, user, "project_updated", request, "project", id)
    commit(db)
    return _out(p)


@router.post("/{id}/publish", response_model=s.ProjectAdminOut)
def publish_project(id: uuid.UUID, data: s.PublishIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    p = get_or_404(db, Project, id, "Project")
    if data.published and not p.short_description.strip():
        raise HTTPException(422, "Add a short description before publishing")
    p.is_published = data.published
    audit(db, user, "project_published" if data.published else "project_unpublished", request, "project", id)
    commit(db)
    return _out(p)


@router.delete("/{id}", status_code=204)
def delete_project(id: uuid.UUID, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    p = get_or_404(db, Project, id, "Project")
    p.deleted_at = datetime.now(timezone.utc)
    p.is_published = False
    audit(db, user, "project_deleted", request, "project", id, title=p.title)
    commit(db)


@router.post("/reorder", status_code=204)
def reorder_projects(data: s.ReorderIn, db: Session = Depends(get_db)):
    rows = {p.id: p for p in db.scalars(select(Project).where(Project.id.in_(data.ids), Project.deleted_at.is_(None))).all()}
    if len(rows) != len(set(data.ids)):
        raise HTTPException(422, "Unknown project in list")
    for i, pid in enumerate(data.ids):
        rows[pid].sort_order = i
    commit(db)
