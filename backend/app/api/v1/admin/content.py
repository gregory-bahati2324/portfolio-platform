import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.admin.common import ADMIN_DEPS, check_media, commit, get_or_404, unique_slug
from app.core.db import get_db
from app.core.security import current_admin
from app.models import (
    AdminUser, AuditLog, ChatConversation, CustomerInquiry, Profile, Project, ProjectCategory, Service, SiteSettings, Skill,
    SkillCategory, SocialLink,
)
from app.schemas import admin as s
from app.api.v1.admin.extras import summarize
from app.services.audit import audit

router = APIRouter(dependencies=ADMIN_DEPS)


def _singleton(db: Session, model, **defaults):
    obj = db.scalars(select(model).limit(1)).first()
    if not obj:
        obj = model(**defaults)
        db.add(obj)
        db.flush()
    return obj


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    """Real counts only. Visitor, project-view and chatbot metrics are added with their
    tracking in Phases 4 and 5 and are deliberately absent until then."""
    live = Project.deleted_at.is_(None)
    count = lambda *w: db.scalar(select(func.count()).select_from(Project).where(live, *w)) or 0  # noqa: E731
    inquiries = db.scalar(select(func.count()).select_from(CustomerInquiry)) or 0
    new = db.scalar(select(func.count()).select_from(CustomerInquiry).where(CustomerInquiry.status == "new")) or 0
    recent = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(8)).all()
    return {
        "published_projects": count(Project.is_published.is_(True)),
        "draft_projects": count(Project.is_published.is_(False)),
        "total_inquiries": inquiries,
        "visits_last_30_days": summarize(db, 30)["visits"],
        "project_views_last_30_days": summarize(db, 30)["project_views"],
        "new_inquiries": new,
        "chat_conversations": db.scalar(select(func.count()).select_from(ChatConversation).where(ChatConversation.message_count > 0)) or 0,
        "chatbot_inquiries": db.scalar(select(func.count()).select_from(CustomerInquiry).where(CustomerInquiry.source == "chatbot")) or 0,
        "recent_activity": [{"action": a.action, "entity": a.entity, "created_at": a.created_at} for a in recent],
    }


# ---- profile & settings -------------------------------------------------
@router.get("/profile", response_model=s.ProfileAdminOut)
def get_profile(db: Session = Depends(get_db)):
    return _singleton(db, Profile, full_name="Gregory Bahati")


@router.put("/profile", response_model=s.ProfileAdminOut)
def update_profile(data: s.ProfileIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    p = _singleton(db, Profile, full_name="Gregory Bahati")
    check_media(db, data.photo_id, data.cv_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    audit(db, user, "profile_updated", request, "profile", p.id)
    commit(db)
    return p


@router.get("/settings", response_model=s.SiteAdminOut)
def get_settings_(db: Session = Depends(get_db)):
    return _singleton(db, SiteSettings)


@router.put("/settings", response_model=s.SiteAdminOut)
def update_settings(data: s.SiteIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    st = _singleton(db, SiteSettings)
    payload = data.model_dump(exclude_unset=True)
    if payload.get("primary_color") is not None and not s.HEX.match(payload["primary_color"]):
        raise HTTPException(422, "primary_color must be a #RRGGBB hex value")
    check_media(db, data.logo_id)
    for k, v in payload.items():
        setattr(st, k, v)
    audit(db, user, "settings_updated", request, "site_settings", st.id)
    commit(db)
    return st


# ---- social links ---------------------------------------------------------
@router.get("/social-links", response_model=list[s.SocialOut])
def list_social(db: Session = Depends(get_db)):
    return db.scalars(select(SocialLink).order_by(SocialLink.sort_order)).all()


@router.post("/social-links", response_model=s.SocialOut, status_code=201)
def create_social(data: s.SocialIn, db: Session = Depends(get_db)):
    obj = SocialLink(**data.model_dump())
    db.add(obj)
    commit(db)
    return obj


@router.put("/social-links/{id}", response_model=s.SocialOut)
def update_social(id: uuid.UUID, data: s.SocialIn, db: Session = Depends(get_db)):
    obj = get_or_404(db, SocialLink, id, "Link")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    commit(db)
    return obj


@router.delete("/social-links/{id}", status_code=204)
def delete_social(id: uuid.UUID, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, SocialLink, id, "Link"))
    commit(db)


# ---- skills ----------------------------------------------------------------
@router.get("/skill-categories", response_model=list[s.SkillCategoryOut])
def list_skill_categories(db: Session = Depends(get_db)):
    return db.scalars(select(SkillCategory).order_by(SkillCategory.sort_order)).all()


@router.post("/skill-categories", response_model=s.SkillCategoryOut, status_code=201)
def create_skill_category(data: s.SkillCategoryIn, db: Session = Depends(get_db)):
    obj = SkillCategory(**data.model_dump(), slug=unique_slug(db, SkillCategory, data.name))
    db.add(obj)
    commit(db)
    return obj


@router.put("/skill-categories/{id}", response_model=s.SkillCategoryOut)
def update_skill_category(id: uuid.UUID, data: s.SkillCategoryIn, db: Session = Depends(get_db)):
    obj = get_or_404(db, SkillCategory, id, "Category")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    commit(db)
    return obj


@router.delete("/skill-categories/{id}", status_code=204)
def delete_skill_category(id: uuid.UUID, db: Session = Depends(get_db)):
    obj = get_or_404(db, SkillCategory, id, "Category")
    if db.scalar(select(func.count()).select_from(Skill).where(Skill.category_id == id, Skill.deleted_at.is_(None))):
        raise HTTPException(409, "Category still has skills. Move or delete them first.")
    db.delete(obj)
    commit(db)


@router.get("/skills", response_model=list[s.SkillOut])
def list_skills(db: Session = Depends(get_db)):
    return db.scalars(select(Skill).where(Skill.deleted_at.is_(None)).order_by(Skill.category_id, Skill.sort_order)).all()


@router.post("/skills", response_model=s.SkillOut, status_code=201)
def create_skill(data: s.SkillIn, db: Session = Depends(get_db)):
    get_or_404(db, SkillCategory, data.category_id, "Category")
    obj = Skill(**data.model_dump())
    db.add(obj)
    commit(db)
    return obj


@router.put("/skills/{id}", response_model=s.SkillOut)
def update_skill(id: uuid.UUID, data: s.SkillIn, db: Session = Depends(get_db)):
    obj = get_or_404(db, Skill, id, "Skill")
    get_or_404(db, SkillCategory, data.category_id, "Category")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    commit(db)
    return obj


@router.delete("/skills/{id}", status_code=204)
def delete_skill(id: uuid.UUID, db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    get_or_404(db, Skill, id, "Skill").deleted_at = datetime.now(timezone.utc)
    commit(db)


# ---- services -----------------------------------------------------------------
@router.get("/services", response_model=list[s.ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.scalars(select(Service).where(Service.deleted_at.is_(None)).order_by(Service.sort_order)).all()


@router.post("/services", response_model=s.ServiceOut, status_code=201)
def create_service(data: s.ServiceIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    d = data.model_dump()
    d["slug"] = unique_slug(db, Service, d.get("slug") or data.title)
    obj = Service(**d)
    db.add(obj)
    db.flush()
    audit(db, user, "service_created", request, "service", obj.id)
    commit(db)
    return obj


@router.put("/services/{id}", response_model=s.ServiceOut)
def update_service(id: uuid.UUID, data: s.ServiceIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    obj = get_or_404(db, Service, id, "Service")
    d = data.model_dump()
    d["slug"] = unique_slug(db, Service, d.get("slug") or obj.slug, exclude_id=id)
    for k, v in d.items():
        setattr(obj, k, v)
    audit(db, user, "service_updated", request, "service", id)
    commit(db)
    return obj


@router.delete("/services/{id}", status_code=204)
def delete_service(id: uuid.UUID, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    obj = get_or_404(db, Service, id, "Service")
    obj.deleted_at = datetime.now(timezone.utc)
    obj.visible = False
    audit(db, user, "service_deleted", request, "service", id)
    commit(db)


# ---- project categories --------------------------------------------------------
@router.get("/project-categories", response_model=list[s.ProjectCategoryOut])
def list_project_categories(db: Session = Depends(get_db)):
    return db.scalars(select(ProjectCategory).order_by(ProjectCategory.sort_order)).all()


@router.post("/project-categories", response_model=s.ProjectCategoryOut, status_code=201)
def create_project_category(data: s.ProjectCategoryIn, db: Session = Depends(get_db)):
    obj = ProjectCategory(**data.model_dump(), slug=unique_slug(db, ProjectCategory, data.name))
    db.add(obj)
    commit(db)
    return obj


@router.put("/project-categories/{id}", response_model=s.ProjectCategoryOut)
def update_project_category(id: uuid.UUID, data: s.ProjectCategoryIn, db: Session = Depends(get_db)):
    obj = get_or_404(db, ProjectCategory, id, "Category")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    commit(db)
    return obj


@router.delete("/project-categories/{id}", status_code=204)
def delete_project_category(id: uuid.UUID, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, ProjectCategory, id, "Category"))  # projects keep existing, category set NULL
    commit(db)


# ---- inquiries -------------------------------------------------------------------
@router.get("/inquiries", response_model=list[s.InquiryAdminOut])
def list_inquiries(status: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(CustomerInquiry).order_by(CustomerInquiry.created_at.desc()).limit(500)
    if status:
        stmt = stmt.where(CustomerInquiry.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(CustomerInquiry.name.ilike(like) | CustomerInquiry.email.ilike(like) | CustomerInquiry.reference.ilike(like))
    return db.scalars(stmt).all()


@router.patch("/inquiries/{id}/status", response_model=s.InquiryAdminOut)
def set_inquiry_status(id: uuid.UUID, data: s.InquiryStatusIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    obj = get_or_404(db, CustomerInquiry, id, "Inquiry")
    obj.status = data.status
    audit(db, user, "inquiry_status", request, "inquiry", id, status=data.status)
    commit(db)
    return obj
