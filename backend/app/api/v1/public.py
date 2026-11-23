import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.db import get_db
from app.core.ratelimit import RateLimiter
from app.services.notify import notify_new_inquiry
from app.models import (
    CustomerInquiry, Profile, Project, ProjectCategory, Service, SiteSettings,
    SkillCategory, SocialLink,
)
from app.schemas.public import (
    InquiryIn, InquiryOut, Page, ProfileOut, ProjectCardOut, ProjectCategoryOut,
    ProjectDetailOut, ProjectMediaOut, ServiceDetailOut, ServiceOut, SiteOut,
    SkillCategoryOut, SkillOut,
)

log = logging.getLogger("app.public")
router = APIRouter(tags=["public"])
inquiry_limiter = RateLimiter(limit=5, window_seconds=3600, name="inquiry")


def _card(p: Project) -> ProjectCardOut:
    out = ProjectCardOut.model_validate(p)
    out.category_name = p.category.name if p.category else None
    out.category_slug = p.category.slug if p.category else None
    return out


def _published():
    return select(Project).where(Project.is_published.is_(True), Project.deleted_at.is_(None))


@router.get("/profile", response_model=ProfileOut | None)
def get_profile(db: Session = Depends(get_db)):
    return db.scalars(select(Profile).limit(1)).first()


@router.get("/site", response_model=SiteOut)
def get_site(db: Session = Depends(get_db)):
    s = db.scalars(select(SiteSettings).limit(1)).first() or SiteSettings(
        site_title="", meta_description="", primary_color="#2563EB", footer_text="", show_proficiency=False
    )
    links = db.scalars(
        select(SocialLink).where(SocialLink.visible.is_(True)).order_by(SocialLink.sort_order)
    ).all()
    return SiteOut(
        site_title=s.site_title or "", meta_description=s.meta_description or "",
        primary_color=s.primary_color or "#2563EB", footer_text=s.footer_text or "",
        show_proficiency=bool(s.show_proficiency), social_links=links, logo=None,
    )


@router.get("/skills", response_model=list[SkillCategoryOut])
def list_skills(db: Session = Depends(get_db)):
    cats = db.scalars(
        select(SkillCategory).where(SkillCategory.visible.is_(True))
        .options(selectinload(SkillCategory.skills)).order_by(SkillCategory.sort_order)
    ).all()
    result = []
    for c in cats:
        skills = [SkillOut.model_validate(s) for s in c.skills if s.visible and s.deleted_at is None]
        if skills:
            result.append(SkillCategoryOut(id=c.id, name=c.name, slug=c.slug, description=c.description, icon=c.icon, skills=skills))
    return result


@router.get("/services", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.scalars(
        select(Service).where(Service.visible.is_(True), Service.deleted_at.is_(None)).order_by(Service.sort_order)
    ).all()


@router.get("/services/{slug}", response_model=ServiceDetailOut)
def get_service(slug: str, db: Session = Depends(get_db)):
    s = db.scalars(select(Service).where(Service.slug == slug, Service.visible.is_(True), Service.deleted_at.is_(None))).first()
    if not s:
        raise HTTPException(404, "Service not found")
    projects = db.scalars(_published().where(Project.service_id == s.id).options(selectinload(Project.category), selectinload(Project.main_image)).order_by(Project.sort_order)).all()
    out = ServiceDetailOut.model_validate(s)
    out.projects = [_card(p) for p in projects]
    return out


@router.get("/project-categories", response_model=list[ProjectCategoryOut])
def list_project_categories(db: Session = Depends(get_db)):
    return db.scalars(select(ProjectCategory).order_by(ProjectCategory.sort_order)).all()


@router.get("/projects", response_model=Page)
def list_projects(
    q: str | None = Query(None, max_length=100),
    category: str | None = None,
    featured: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    stmt = _published().options(selectinload(Project.category), selectinload(Project.main_image))
    if category:
        stmt = stmt.join(ProjectCategory, Project.category_id == ProjectCategory.id).where(ProjectCategory.slug == category)
    if featured is not None:
        stmt = stmt.where(Project.is_featured.is_(featured))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Project.title.ilike(like), Project.short_description.ilike(like), Project.description.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.order_by(Project.sort_order, Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[_card(p) for p in rows], total=total, page=page, page_size=page_size)


@router.get("/projects/{slug}", response_model=ProjectDetailOut)
def get_project(slug: str, db: Session = Depends(get_db)):
    p = db.scalars(
        _published().where(Project.slug == slug).options(
            selectinload(Project.category), selectinload(Project.main_image), selectinload(Project.service),
            selectinload(Project.skills), selectinload(Project.media),
        )
    ).first()
    if not p:
        raise HTTPException(404, "Project not found")
    base = _card(p).model_dump()
    return ProjectDetailOut(
        **base,
        description=p.description, problem=p.problem, solution=p.solution, architecture=p.architecture,
        how_it_works=p.how_it_works, challenges=p.challenges, results=p.results,
        github_url=p.github_url, live_url=p.live_url, docs_url=p.docs_url,
        service_slug=p.service.slug if p.service else None, service_title=p.service.title if p.service else None,
        skills=[s.name for s in p.skills if s.deleted_at is None and s.visible],
        media=[ProjectMediaOut(caption=m.caption, asset=m.asset) for m in p.media],
    )


def _new_reference() -> str:
    return f"GRG-{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"


@router.post("/inquiries", response_model=InquiryOut, status_code=201)
def create_inquiry(data: InquiryIn, background: BackgroundTasks, db: Session = Depends(get_db), _: None = Depends(inquiry_limiter)):
    if data.website:  # honeypot tripped: pretend success, store nothing
        return InquiryOut(reference="GRG-RECEIVED")
    service_id = None
    if data.service_slug:
        svc = db.scalars(select(Service).where(Service.slug == data.service_slug)).first()
        service_id = svc.id if svc else None
    inquiry = CustomerInquiry(
        reference=_new_reference(), name=data.name, email=data.email, phone=data.phone, company=data.company,
        service_id=service_id, message=data.message, budget_range=data.budget_range, timeline=data.timeline,
    )
    conv = None
    if data.chat_session_id:
        from app.models import ChatConversation

        conv = db.scalars(select(ChatConversation).where(ChatConversation.session_token == data.chat_session_id)).first()
        if conv:
            inquiry.source = "chatbot"
    db.add(inquiry)
    db.flush()
    if conv:
        conv.inquiry_id = inquiry.id
    db.commit()  # saved first: a failing notifier (Phase 3/5) can never lose an inquiry
    log.info("inquiry stored", extra={"path": inquiry.reference})
    background.add_task(notify_new_inquiry, inquiry.reference, inquiry.name, inquiry.email, inquiry.message)
    return InquiryOut(reference=inquiry.reference)
