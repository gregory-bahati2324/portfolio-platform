"""Sitemap, robots.txt and crawler-friendly page metadata.

The site is a single-page app, so link-preview bots (WhatsApp, LinkedIn, Slack, X) and
non-rendering crawlers would otherwise see only the empty shell. The reverse proxy sends
their requests to /_meta, which returns real <title>/Open Graph/JSON-LD tags (and a
redirect for any human who lands there)."""
import html
import json
from datetime import timezone
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.extras import _live_articles
from app.core.config import get_settings
from app.core.db import get_db
from app.models import Article, Profile, Project, SiteSettings

router = APIRouter(include_in_schema=False)
STATIC = {"/": 1.0, "/about": 0.7, "/skills": 0.7, "/services": 0.8, "/projects": 0.9, "/articles": 0.6, "/contact": 0.8}


def site() -> str:
    return get_settings().public_site_url.rstrip("/")


def _abs(url: str | None) -> str | None:
    if not url:
        return None
    return url if url.startswith("http") else f"{site()}{url}"


@router.get("/robots.txt")
def robots():
    return PlainTextResponse(f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: {site()}/sitemap.xml\n")


@router.get("/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    urls: list[tuple[str, str | None, float]] = [(p, None, w) for p, w in STATIC.items()]
    for p in db.scalars(select(Project).where(Project.is_published.is_(True), Project.deleted_at.is_(None))).all():
        urls.append((f"/projects/{p.slug}", p.updated_at.astimezone(timezone.utc).date().isoformat() if p.updated_at else None, 0.8))
    for a in db.scalars(_live_articles()).all():
        urls.append((f"/articles/{a.slug}", (a.updated_at or a.published_at).astimezone(timezone.utc).date().isoformat() if (a.updated_at or a.published_at) else None, 0.6))
    body = "".join(f"<url><loc>{html.escape(site() + path)}</loc>{f'<lastmod>{m}</lastmod>' if m else ''}<priority>{w}</priority></url>" for path, m, w in urls)
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>', media_type="application/xml")


@router.get("/_meta", response_class=HTMLResponse)
def page_meta(path: str = Query("/", max_length=300), db: Session = Depends(get_db)):
    path = urlsplit(path).path or "/"
    if not path.startswith("/") or path.startswith("//"):
        path = "/"
    st = db.scalars(select(SiteSettings).limit(1)).first()
    prof = db.scalars(select(Profile).limit(1)).first()
    title = (st.site_title if st and st.site_title else "Gregory Bahati | GregTech")
    desc = (st.meta_description if st and st.meta_description else "Software developer, AI/ML engineer and system architect.")
    image = _abs(prof.photo.url) if prof and prof.photo else None
    og_type, ld = "website", None
    page_titles = {"/about": "About", "/skills": "Skills", "/services": "Services", "/projects": "Projects", "/articles": "Articles", "/contact": "Contact"}
    if path in page_titles:
        title = f"{page_titles[path]} | {title}"
    if path.startswith("/projects/"):
        p = db.scalars(select(Project).where(Project.slug == path[10:], Project.is_published.is_(True), Project.deleted_at.is_(None)).options(selectinload(Project.main_image))).first()
        if p:
            title, desc, og_type = f"{p.title} | Gregory Bahati", p.short_description or desc, "article"
            image = _abs(p.main_image.url) if p.main_image else image
            ld = {"@context": "https://schema.org", "@type": "CreativeWork", "name": p.title, "description": p.short_description, "author": {"@type": "Person", "name": prof.full_name if prof else "Gregory Bahati"}, "url": site() + path}
    elif path.startswith("/articles/"):
        a = db.scalars(_live_articles().where(Article.slug == path[10:]).options(selectinload(Article.cover))).first()
        if a:
            title, desc, og_type = f"{a.title} | Gregory Bahati", a.seo_description or a.excerpt or desc, "article"
            image = _abs(a.cover.url) if a.cover else image
            ld = {"@context": "https://schema.org", "@type": "Article", "headline": a.title, "description": desc, "datePublished": a.published_at.isoformat() if a.published_at else None, "author": {"@type": "Person", "name": prof.full_name if prof else "Gregory Bahati"}, "url": site() + path}
    elif path == "/" and prof:
        ld = {"@context": "https://schema.org", "@type": "Person", "name": prof.full_name, "jobTitle": prof.professional_title, "url": site(), "email": prof.email or None}
    url = site() + (path if path != "/" else "")
    e = html.escape
    tags = [f"<title>{e(title)}</title>", f'<meta name="description" content="{e(desc[:320])}">', f'<link rel="canonical" href="{e(url or site())}">',
            f'<meta property="og:title" content="{e(title)}">', f'<meta property="og:description" content="{e(desc[:320])}">',
            f'<meta property="og:type" content="{og_type}">', f'<meta property="og:url" content="{e(url or site())}">',
            f'<meta name="twitter:card" content="{"summary_large_image" if image else "summary"}">']
    if image:
        tags += [f'<meta property="og:image" content="{e(image)}">', f'<meta name="twitter:image" content="{e(image)}">']
    if ld:
        ld = {k: v for k, v in ld.items() if v is not None}
        tags.append('<script type="application/ld+json">' + json.dumps(ld).replace("<", "\\u003c") + "</script>")
    page = f'<!doctype html><html lang="en"><head><meta charset="utf-8">{"".join(tags)}<meta http-equiv="refresh" content="0;url={e(url or site())}"></head><body><a href="{e(url or site())}">{e(title)}</a></body></html>'
    return HTMLResponse(page)
