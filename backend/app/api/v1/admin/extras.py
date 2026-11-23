import csv
import io
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.admin.common import ADMIN_DEPS, check_media, commit, get_or_404, unique_slug
from app.core.db import get_db
from app.core.security import current_admin
from app.models import (
    AdminUser, Article, ArticleCategory, CustomerInquiry, InquiryNote, NewsletterSubscriber, Project, Testimonial, VisitorEvent,
)
from app.schemas import extras as s
from app.services.audit import audit

router = APIRouter(dependencies=ADMIN_DEPS)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---- articles ------------------------------------------------------------------
@router.get("/article-categories", response_model=list[s.ArticleCategoryOut])
def list_cats(db: Session = Depends(get_db)):
    return db.scalars(select(ArticleCategory).order_by(ArticleCategory.sort_order)).all()


@router.post("/article-categories", response_model=s.ArticleCategoryOut, status_code=201)
def create_cat(data: s.ArticleCategoryIn, db: Session = Depends(get_db)):
    c = ArticleCategory(**data.model_dump(), slug=unique_slug(db, ArticleCategory, data.name))
    db.add(c)
    commit(db)
    return c


@router.delete("/article-categories/{id}", status_code=204)
def delete_cat(id: uuid.UUID, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, ArticleCategory, id, "Category"))
    commit(db)


@router.get("/articles", response_model=list[s.ArticleAdminOut])
def list_articles(db: Session = Depends(get_db)):
    return db.scalars(select(Article).where(Article.deleted_at.is_(None)).order_by(Article.updated_at.desc())).all()


def _apply_article(db: Session, a: Article, d: s.ArticleIn) -> None:
    check_media(db, d.cover_id)
    if d.category_id:
        get_or_404(db, ArticleCategory, d.category_id, "Category")
    for k, v in d.model_dump(exclude={"slug"}).items():
        setattr(a, k, v)
    a.slug = unique_slug(db, Article, d.slug or a.slug or d.title, exclude_id=a.id if a.id else None)


@router.post("/articles", response_model=s.ArticleAdminOut, status_code=201)
def create_article(data: s.ArticleIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    a = Article(title=data.title, is_published=False)
    db.add(a)
    _apply_article(db, a, data)
    db.flush()
    audit(db, user, "article_created", request, "article", a.id)
    commit(db)
    return a


@router.get("/articles/{id}", response_model=s.ArticleAdminOut)
def get_article(id: uuid.UUID, db: Session = Depends(get_db)):
    return get_or_404(db, Article, id, "Article")


@router.put("/articles/{id}", response_model=s.ArticleAdminOut)
def update_article(id: uuid.UUID, data: s.ArticleIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    a = get_or_404(db, Article, id, "Article")
    _apply_article(db, a, data)
    audit(db, user, "article_updated", request, "article", id)
    commit(db)
    return a


@router.post("/articles/{id}/publish", response_model=s.ArticleAdminOut)
def publish_article(id: uuid.UUID, body: dict, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    a = get_or_404(db, Article, id, "Article")
    publish = bool(body.get("published"))
    if publish:
        if not a.title.strip() or not (a.content or "").strip():
            raise HTTPException(422, "Add content before publishing")
        if not a.published_at:
            a.published_at = _now()
    a.is_published = publish
    audit(db, user, "article_published" if publish else "article_unpublished", request, "article", id)
    commit(db)
    return a


@router.delete("/articles/{id}", status_code=204)
def delete_article(id: uuid.UUID, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    a = get_or_404(db, Article, id, "Article")
    a.deleted_at, a.is_published = _now(), False
    audit(db, user, "article_deleted", request, "article", id)
    commit(db)


# ---- testimonials (owner-entered, approval required) ------------------------------------
@router.get("/testimonials", response_model=list[s.TestimonialAdminOut])
def list_testimonials(db: Session = Depends(get_db)):
    return db.scalars(select(Testimonial).where(Testimonial.deleted_at.is_(None)).order_by(Testimonial.sort_order, Testimonial.created_at)).all()


@router.post("/testimonials", response_model=s.TestimonialAdminOut, status_code=201)
def create_testimonial(data: s.TestimonialIn, db: Session = Depends(get_db)):
    t = Testimonial(**data.model_dump(), is_approved=False)  # always pending
    db.add(t)
    commit(db)
    return t


@router.put("/testimonials/{id}", response_model=s.TestimonialAdminOut)
def update_testimonial(id: uuid.UUID, data: s.TestimonialIn, db: Session = Depends(get_db)):
    t = get_or_404(db, Testimonial, id, "Testimonial")
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    t.is_approved = False  # editing the text requires re-approval
    commit(db)
    return t


@router.post("/testimonials/{id}/approve", response_model=s.TestimonialAdminOut)
def approve_testimonial(id: uuid.UUID, body: dict, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    t = get_or_404(db, Testimonial, id, "Testimonial")
    t.is_approved = bool(body.get("approved"))
    audit(db, user, "testimonial_approved" if t.is_approved else "testimonial_unapproved", request, "testimonial", id)
    commit(db)
    return t


@router.delete("/testimonials/{id}", status_code=204)
def delete_testimonial(id: uuid.UUID, db: Session = Depends(get_db)):
    t = get_or_404(db, Testimonial, id, "Testimonial")
    t.deleted_at, t.is_approved = _now(), False
    commit(db)


# ---- newsletter ----------------------------------------------------------------------------
@router.get("/subscribers", response_model=list[s.SubscriberOut])
def subscribers(db: Session = Depends(get_db)):
    return db.scalars(select(NewsletterSubscriber).order_by(NewsletterSubscriber.created_at.desc()).limit(2000)).all()


@router.get("/subscribers/export.csv")
def export_subscribers(db: Session = Depends(get_db)):
    """Confirmed, still-subscribed addresses only."""
    rows = db.scalars(select(NewsletterSubscriber).where(NewsletterSubscriber.confirmed_at.isnot(None), NewsletterSubscriber.unsubscribed_at.is_(None))).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["email", "confirmed_at"])
    for r in rows:
        w.writerow([r.email.replace("\n", ""), r.confirmed_at.isoformat() if r.confirmed_at else ""])
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=subscribers.csv"})


@router.delete("/subscribers/{id}", status_code=204)
def delete_subscriber(id: uuid.UUID, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, NewsletterSubscriber, id, "Subscriber"))
    commit(db)


# ---- inquiry notes & follow-up -----------------------------------------------------------------
@router.get("/inquiries/{id}/notes", response_model=list[s.NoteOut])
def list_notes(id: uuid.UUID, db: Session = Depends(get_db)):
    get_or_404(db, CustomerInquiry, id, "Inquiry")
    return db.scalars(select(InquiryNote).where(InquiryNote.inquiry_id == id).order_by(InquiryNote.created_at)).all()


@router.post("/inquiries/{id}/notes", response_model=s.NoteOut, status_code=201)
def add_note(id: uuid.UUID, data: s.NoteIn, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    get_or_404(db, CustomerInquiry, id, "Inquiry")
    n = InquiryNote(inquiry_id=id, author_id=user.id, body=data.body.strip())
    db.add(n)
    commit(db)
    return n


@router.delete("/inquiries/{id}/notes/{note_id}", status_code=204)
def delete_note(id: uuid.UUID, note_id: uuid.UUID, db: Session = Depends(get_db)):
    n = db.get(InquiryNote, note_id)
    if not n or n.inquiry_id != id:
        raise HTTPException(404, "Note not found")
    db.delete(n)
    commit(db)


@router.put("/inquiries/{id}/follow-up")
def set_follow_up(id: uuid.UUID, data: s.FollowUpIn, db: Session = Depends(get_db)):
    i = get_or_404(db, CustomerInquiry, id, "Inquiry")
    i.follow_up_on = data.follow_up_on
    commit(db)
    return {"follow_up_on": i.follow_up_on}


# ---- analytics -----------------------------------------------------------------------------------
def summarize(db: Session, days: int) -> dict:
    since = _now() - timedelta(days=days)
    ev = db.scalars(select(VisitorEvent).where(VisitorEvent.created_at >= since).limit(300_000)).all()
    daily_views: Counter = Counter()
    daily_visitors: dict[str, set] = defaultdict(set)
    pages, refs = Counter(), Counter()
    proj: Counter = Counter()
    for e in ev:
        d = e.created_at.date().isoformat()
        if e.event_type == "page_view":
            daily_views[d] += 1
            daily_visitors[d].add(e.visitor_hash)
            pages[e.path] += 1
            if e.referrer_host:
                refs[e.referrer_host] += 1
        elif e.project_id:
            proj[e.project_id] += 1
    names = {p.id: (p.title, p.slug) for p in db.scalars(select(Project).where(Project.id.in_(list(proj) or [uuid.UUID(int=0)]))).all()}
    series = []
    for i in range(days - 1, -1, -1):
        d = (_now() - timedelta(days=i)).date().isoformat()
        series.append({"date": d, "page_views": daily_views[d], "visitors": len(daily_visitors[d])})
    return {
        "days": days,
        "page_views": sum(daily_views.values()),
        "visits": sum(len(v) for v in daily_visitors.values()),  # unique visitors per day, summed
        "project_views": sum(proj.values()),
        "daily": series,
        "top_projects": [{"title": names[pid][0], "slug": names[pid][1], "views": n} for pid, n in proj.most_common(10) if pid in names],
        "top_pages": [{"path": p, "views": n} for p, n in pages.most_common(10)],
        "top_referrers": [{"host": h, "views": n} for h, n in refs.most_common(10)],
    }


@router.get("/analytics")
def analytics(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    return summarize(db, days)
