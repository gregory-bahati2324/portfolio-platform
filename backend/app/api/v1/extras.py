import hashlib
import logging
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.db import get_db
from app.core.ratelimit import RateLimiter
from app.models import Article, ArticleCategory, NewsletterSubscriber, Project, Testimonial, VisitorEvent
from app.schemas import extras as s
from app.services.notify import send_email

log = logging.getLogger("app.extras")
router = APIRouter(tags=["public"])
subscribe_limiter = RateLimiter(limit=5, window_seconds=3600, name="subscribe")
event_limiter = RateLimiter(limit=120, window_seconds=60, name="event")
BOT_RE = re.compile(r"bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python-requests", re.I)


def now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(d: datetime | None) -> datetime | None:
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def _live_articles():
    return select(Article).where(Article.is_published.is_(True), Article.deleted_at.is_(None), Article.published_at <= now())


def _card(a: Article) -> s.ArticleCardOut:
    out = s.ArticleCardOut(
        slug=a.slug, title=a.title, excerpt=a.excerpt, tags=a.tags or [], published_at=a.published_at,
        category_name=a.category.name if a.category else None, category_slug=a.category.slug if a.category else None,
        cover=a.cover, reading_minutes=max(1, round(len((a.content or "").split()) / 220)),
    )
    return out


# ---- articles -----------------------------------------------------------------
@router.get("/article-categories", response_model=list[s.CategoryOut])
def article_categories(db: Session = Depends(get_db)):
    return db.scalars(select(ArticleCategory).order_by(ArticleCategory.sort_order)).all()


@router.get("/articles", response_model=s.ArticlePage)
def list_articles(q: str | None = Query(None, max_length=100), category: str | None = None, tag: str | None = Query(None, max_length=40),
                  page: int = Query(1, ge=1), page_size: int = Query(9, ge=1, le=50), db: Session = Depends(get_db)):
    stmt = _live_articles().options(selectinload(Article.category), selectinload(Article.cover))
    if category:
        stmt = stmt.join(ArticleCategory, Article.category_id == ArticleCategory.id).where(ArticleCategory.slug == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Article.title.ilike(like), Article.excerpt.ilike(like), Article.content.ilike(like)))
    ordered = stmt.order_by(Article.published_at.desc())
    if tag:  # JSON containment differs between databases, so tag filtering is done in Python
        rows = [a for a in db.scalars(ordered).all() if tag in (a.tags or [])]
        start = (page - 1) * page_size
        return s.ArticlePage(items=[_card(a) for a in rows[start:start + page_size]], total=len(rows), page=page, page_size=page_size)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(ordered.offset((page - 1) * page_size).limit(page_size)).all()
    return s.ArticlePage(items=[_card(a) for a in rows], total=total, page=page, page_size=page_size)


@router.get("/articles/{slug}", response_model=s.ArticleDetailOut)
def get_article(slug: str, db: Session = Depends(get_db)):
    a = db.scalars(_live_articles().where(Article.slug == slug).options(selectinload(Article.category), selectinload(Article.cover))).first()
    if not a:
        raise HTTPException(404, "Article not found")
    return s.ArticleDetailOut(**_card(a).model_dump(), content=a.content, seo_description=a.seo_description)


# ---- testimonials ------------------------------------------------------------------
@router.get("/testimonials", response_model=list[s.TestimonialOut])
def list_testimonials(db: Session = Depends(get_db)):
    return db.scalars(select(Testimonial).where(Testimonial.is_approved.is_(True), Testimonial.deleted_at.is_(None)).order_by(Testimonial.sort_order)).all()


# ---- newsletter (double opt-in) -------------------------------------------------------
@router.post("/newsletter/subscribe", status_code=202)
def subscribe(data: s.SubscribeIn, background: BackgroundTasks, db: Session = Depends(get_db), _: None = Depends(subscribe_limiter)):
    generic = {"message": "If this address is valid, a confirmation email is on its way. Please click the link in it to finish subscribing."}
    if data.website:
        return generic
    email = data.email.lower()
    sub = db.scalars(select(NewsletterSubscriber).where(NewsletterSubscriber.email == email)).first()
    if sub and sub.confirmed_at and not sub.unsubscribed_at:
        return generic  # no information leak about existing subscribers
    if not sub:
        sub = NewsletterSubscriber(email=email, token=secrets.token_urlsafe(32))
        db.add(sub)
    sub.unsubscribed_at = None
    db.commit()
    site = get_settings().public_site_url.rstrip("/")
    background.add_task(send_email, email, "Confirm your subscription", f"Please confirm your subscription to Gregory Bahati's technology updates:\n\n{site}/newsletter/confirm?token={sub.token}\n\nIf you did not request this, ignore this email.")
    return generic


@router.post("/newsletter/confirm")
def confirm(token: str = Query(..., max_length=64), db: Session = Depends(get_db)):
    sub = db.scalars(select(NewsletterSubscriber).where(NewsletterSubscriber.token == token)).first()
    if not sub:
        raise HTTPException(404, "Invalid or expired link")
    if not sub.confirmed_at:
        sub.confirmed_at = now()
    sub.unsubscribed_at = None
    db.commit()
    return {"message": "You are subscribed. Thank you!"}


@router.post("/newsletter/unsubscribe")
def unsubscribe(token: str = Query(..., max_length=64), db: Session = Depends(get_db)):
    sub = db.scalars(select(NewsletterSubscriber).where(NewsletterSubscriber.token == token)).first()
    if not sub:
        raise HTTPException(404, "Invalid link")
    sub.unsubscribed_at = now()
    db.commit()
    return {"message": "You have been unsubscribed."}


# ---- analytics (no cookies, no raw IPs, honours DNT / GPC) ------------------------------
@router.post("/analytics/event", status_code=204)
def track(data: s.EventIn, request: Request, db: Session = Depends(get_db), _: None = Depends(event_limiter)):
    h = request.headers
    ua = h.get("user-agent", "")
    if h.get("dnt") == "1" or h.get("sec-gpc") == "1" or not ua or BOT_RE.search(ua) or data.path.startswith("/admin"):
        return Response(status_code=204)
    ip = request.client.host if request.client else ""
    day = now().strftime("%Y-%m-%d")
    visitor = hashlib.sha256(f"{get_settings().secret_key}:{day}:{ip}:{ua}".encode()).hexdigest()
    project_id = None
    if data.type == "project_view":
        if not data.slug:
            raise HTTPException(422, "slug is required for project_view")
        p = db.scalars(select(Project).where(Project.slug == data.slug, Project.is_published.is_(True), Project.deleted_at.is_(None))).first()
        if not p:
            return Response(status_code=204)
        project_id = p.id
    host = ""
    if data.referrer:
        host = (urlparse(data.referrer).hostname or "")[:120]
        if host == urlparse(get_settings().public_site_url).hostname:
            host = ""
    db.add(VisitorEvent(event_type=data.type, path=data.path, project_id=project_id, visitor_hash=visitor, referrer_host=host))
    db.commit()
    return Response(status_code=204)
