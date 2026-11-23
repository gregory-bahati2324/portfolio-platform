from datetime import datetime, timedelta, timezone

import pytest

from app.models import NewsletterSubscriber, Project, VisitorEvent

A = "/api/v1/admin"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux) Firefox/130.0"}


def article(admin, **over):
    r = admin.post(f"{A}/articles", json={"title": "Edge AI in Practice", "excerpt": "Short", "content": "# Hello\n\nBody text here.", **over})
    assert r.status_code == 201, r.text
    return r.json()


def publish(admin, kind, id, **body):
    return admin.post(f"{A}/{kind}/{id}/publish", json=body)


# ---- articles -------------------------------------------------------------------------
def test_article_lifecycle_and_visibility(admin, client):
    a = article(admin, tags=["ai", "edge"])
    assert a["is_published"] is False and a["slug"] == "edge-ai-in-practice"
    assert client.get("/api/v1/articles/edge-ai-in-practice").status_code == 404
    assert client.get("/api/v1/articles").json()["total"] == 0
    assert publish(admin, "articles", a["id"], published=True).json()["published_at"]
    d = client.get("/api/v1/articles/edge-ai-in-practice").json()
    assert d["title"] == "Edge AI in Practice" and d["reading_minutes"] == 1 and d["content"].startswith("# Hello")
    publish(admin, "articles", a["id"], published=False)
    assert client.get("/api/v1/articles/edge-ai-in-practice").status_code == 404
    publish(admin, "articles", a["id"], published=True)
    assert admin.delete(f"{A}/articles/{a['id']}").status_code == 204
    assert client.get("/api/v1/articles").json()["total"] == 0


def test_scheduled_article_hidden_until_its_date(admin, client):
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    a = article(admin, published_at=future)
    publish(admin, "articles", a["id"], published=True)
    assert client.get("/api/v1/articles").json()["total"] == 0
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    admin.put(f"{A}/articles/{a['id']}", json={"title": "Edge AI in Practice", "content": "x body", "published_at": past})
    assert client.get("/api/v1/articles").json()["total"] == 1


def test_cannot_publish_empty_article(admin):
    a = article(admin, content="")
    assert publish(admin, "articles", a["id"], published=True).status_code == 422


def test_article_filters_and_pagination(admin, client):
    cat = admin.post(f"{A}/article-categories", json={"name": "AI and ML"}).json()
    for t, tags, c in ([("Alpha post", ["ai"], cat["id"]), ("Beta post", ["devops"], None), ("Gamma post", ["ai", "devops"], None)]):
        a = article(admin, title=t, tags=tags, category_id=c)
        publish(admin, "articles", a["id"], published=True)
    get = lambda **p: client.get("/api/v1/articles", params=p).json()  # noqa: E731
    assert get()["total"] == 3
    assert get(category="ai-and-ml")["total"] == 1
    assert get(tag="devops")["total"] == 2
    assert get(q="beta")["total"] == 1
    assert len(get(page_size=2)["items"]) == 2 and len(get(page_size=2, page=2)["items"]) == 1


def test_article_slug_unique_and_tags_validated(admin):
    assert article(admin)["slug"] == "edge-ai-in-practice"
    assert article(admin)["slug"] == "edge-ai-in-practice-2"
    assert admin.post(f"{A}/articles", json={"title": "x", "tags": ["a" * 41]}).status_code == 422


# ---- testimonials ---------------------------------------------------------------------------------
def test_testimonials_need_owner_approval_and_edits_reset_it(admin, client):
    body = {"author_name": "Amina Juma", "quote": "Delivered exactly what we needed.", "company": "Juma Shop"}
    t = admin.post(f"{A}/testimonials", json=body).json()
    assert t["is_approved"] is False and client.get("/api/v1/testimonials").json() == []
    assert admin.post(f"{A}/testimonials/{t['id']}/approve", json={"approved": True}).json()["is_approved"] is True
    assert [x["author_name"] for x in client.get("/api/v1/testimonials").json()] == ["Amina Juma"]
    admin.put(f"{A}/testimonials/{t['id']}", json={**body, "quote": "Edited quote text here."})
    assert client.get("/api/v1/testimonials").json() == []  # edited text must be re-approved
    admin.post(f"{A}/testimonials/{t['id']}/approve", json={"approved": True})
    admin.delete(f"{A}/testimonials/{t['id']}")
    assert client.get("/api/v1/testimonials").json() == []
    assert admin.post(f"{A}/testimonials", json={"author_name": "X", "quote": "short"}).status_code == 422


# ---- newsletter ------------------------------------------------------------------------------------
@pytest.fixture
def mails(monkeypatch):
    sent = []
    monkeypatch.setattr("app.api.v1.extras.send_email", lambda to, subject, body, reply_to=None: sent.append((to, subject, body)) or True)
    return sent


def test_newsletter_double_opt_in(client, admin, db, mails):
    r = client.post("/api/v1/newsletter/subscribe", json={"email": "Reader@Example.com"})
    assert r.status_code == 202
    sub = db.query(NewsletterSubscriber).one()
    assert sub.email == "reader@example.com" and sub.confirmed_at is None
    assert mails[0][0] == "reader@example.com" and f"token={sub.token}" in mails[0][2]
    assert admin.get(f"{A}/subscribers/export.csv").text.strip() == "email,confirmed_at"  # not confirmed yet
    assert client.post("/api/v1/newsletter/confirm", params={"token": "bogus"}).status_code == 404
    assert client.post("/api/v1/newsletter/confirm", params={"token": sub.token}).status_code == 200
    assert "reader@example.com" in admin.get(f"{A}/subscribers/export.csv").text
    assert client.post("/api/v1/newsletter/unsubscribe", params={"token": sub.token}).status_code == 200
    assert "reader@example.com" not in admin.get(f"{A}/subscribers/export.csv").text


def test_newsletter_does_not_reveal_existing_subscribers_and_blocks_spam(client, db, mails):
    first = client.post("/api/v1/newsletter/subscribe", json={"email": "a@example.com"}).json()
    tok = db.query(NewsletterSubscriber).one().token
    client.post("/api/v1/newsletter/confirm", params={"token": tok})
    again = client.post("/api/v1/newsletter/subscribe", json={"email": "a@example.com"}).json()
    assert first == again and len(mails) == 1
    assert client.post("/api/v1/newsletter/subscribe", json={"email": "bad"}).status_code == 422
    client.post("/api/v1/newsletter/subscribe", json={"email": "bot@example.com", "website": "x"})
    assert db.query(NewsletterSubscriber).count() == 1  # honeypot stored nothing


# ---- analytics --------------------------------------------------------------------------------------
def _pub_project(db):
    db.add(Project(slug="vision", title="Vision", short_description="d", is_published=True))
    db.add(Project(slug="draft", title="Draft", is_published=False))
    db.commit()


def ev(client, **body):
    return client.post("/api/v1/analytics/event", json=body, headers=UA)


def test_analytics_records_and_summarizes(client, admin, db):
    _pub_project(db)
    assert ev(client, type="page_view", path="/", referrer="https://news.example.org/post").status_code == 204
    assert ev(client, type="page_view", path="/projects").status_code == 204
    assert ev(client, type="project_view", path="/projects/vision", slug="vision").status_code == 204
    assert ev(client, type="project_view", path="/projects/draft", slug="draft").status_code == 204  # unpublished: ignored
    s = admin.get(f"{A}/analytics", params={"days": 7}).json()
    assert s["page_views"] == 2 and s["visits"] == 1 and s["project_views"] == 1
    assert s["top_projects"] == [{"title": "Vision", "slug": "vision", "views": 1}]
    assert s["top_referrers"][0]["host"] == "news.example.org" and len(s["daily"]) == 7
    assert admin.get(f"{A}/overview").json()["project_views_last_30_days"] == 1


def test_analytics_respects_privacy_signals_and_filters_noise(client, db):
    body = {"type": "page_view", "path": "/"}
    client.post("/api/v1/analytics/event", json=body, headers={**UA, "DNT": "1"})
    client.post("/api/v1/analytics/event", json=body, headers={**UA, "Sec-GPC": "1"})
    client.post("/api/v1/analytics/event", json=body, headers={"User-Agent": "Googlebot/2.1"})
    client.post("/api/v1/analytics/event", json={"type": "page_view", "path": "/admin/projects"}, headers=UA)
    assert db.query(VisitorEvent).count() == 0
    client.post("/api/v1/analytics/event", json=body, headers=UA)
    e = db.query(VisitorEvent).one()
    assert len(e.visitor_hash) == 64 and "127" not in e.visitor_hash and e.path == "/"


def test_analytics_validation(client):
    assert ev(client, type="evil", path="/").status_code == 422
    assert ev(client, type="page_view", path="no-slash").status_code == 422
    assert ev(client, type="page_view", path="/x?query=1").status_code == 422
    assert ev(client, type="project_view", path="/projects/x").status_code == 422  # slug required


def test_analytics_rate_limited(client):
    codes = [ev(client, type="page_view", path="/").status_code for _ in range(121)]
    assert codes[:120] == [204] * 120 and codes[120] == 429


# ---- SEO ------------------------------------------------------------------------------------------------
def test_robots_and_sitemap(client, admin, db):
    _pub_project(db)
    a = article(admin)
    publish(admin, "articles", a["id"], published=True)
    article(admin, title="Hidden draft article")
    r = client.get("/robots.txt")
    assert "Disallow: /admin" in r.text and "Sitemap: http://localhost:5173/sitemap.xml" in r.text
    x = client.get("/sitemap.xml")
    assert x.headers["content-type"].startswith("application/xml")
    assert "/projects/vision" in x.text and "/articles/edge-ai-in-practice" in x.text and "<loc>http://localhost:5173/contact</loc>" in x.text
    assert "/projects/draft" not in x.text and "hidden-draft-article" not in x.text


def test_meta_endpoint_for_project_with_escaping(client, db):
    db.add(Project(slug="xss", title='Bad "title" <script>alert(1)</script>', short_description='desc </script><img src=x onerror=alert(1)>', is_published=True))
    db.commit()
    h = client.get("/_meta", params={"path": "/projects/xss"}).text
    assert "<script>alert(1)" not in h and "<img src=x" not in h
    assert 'rel="canonical" href="http://localhost:5173/projects/xss"' in h and 'property="og:type" content="article"' in h
    assert "application/ld+json" in h and "</script><img" not in h


def test_meta_endpoint_hides_drafts_and_resists_open_redirect(client, db):
    _pub_project(db)
    h = client.get("/_meta", params={"path": "/projects/draft"}).text
    assert "Draft |" not in h and 'rel="canonical" href="http://localhost:5173/projects/draft"' in h  # falls back to site defaults
    for evil in ["//evil.example/x", "https://evil.example", "/\\evil"]:
        out = client.get("/_meta", params={"path": evil}).text
        assert "evil.example" not in out


def test_meta_for_home_has_person_schema(client, db, admin):
    admin.put(f"{A}/profile", json={"full_name": "Gregory Bahati", "professional_title": "Software Developer"})
    h = client.get("/_meta", params={"path": "/"}).text
    assert '"@type": "Person"' in h and "Gregory Bahati" in h


# ---- inquiry notes & follow-up ---------------------------------------------------------------------------
def test_inquiry_notes_and_follow_up_date(client, admin):
    client.post("/api/v1/inquiries", json={"name": "Amina Juma", "email": "a@example.com", "message": "Need an inventory system"})
    iid = admin.get(f"{A}/inquiries").json()[0]["id"]
    n = admin.post(f"{A}/inquiries/{iid}/notes", json={"body": "Called, wants a quote"})
    assert n.status_code == 201
    assert [x["body"] for x in admin.get(f"{A}/inquiries/{iid}/notes").json()] == ["Called, wants a quote"]
    assert admin.put(f"{A}/inquiries/{iid}/follow-up", json={"follow_up_on": "2030-01-15"}).json()["follow_up_on"] == "2030-01-15"
    assert admin.get(f"{A}/inquiries").json()[0]["follow_up_on"] == "2030-01-15"
    assert admin.put(f"{A}/inquiries/{iid}/follow-up", json={"follow_up_on": "not-a-date"}).status_code == 422
    assert admin.delete(f"{A}/inquiries/{iid}/notes/{n.json()['id']}").status_code == 204
    assert admin.get(f"{A}/inquiries/{iid}/notes").json() == []
    assert admin.post(f"{A}/inquiries/{iid}/notes", json={"body": ""}).status_code == 422


def test_new_admin_routes_require_auth_and_csrf(client, admin):
    admin.headers.pop("X-CSRF-Token")
    assert admin.post(f"{A}/articles", json={"title": "x"}).status_code == 403
    assert admin.post(f"{A}/testimonials", json={"author_name": "x", "quote": "a long enough quote"}).status_code == 403
    admin.post("/api/v1/auth/logout")
    for p in ["/articles", "/testimonials", "/subscribers", "/subscribers/export.csv", "/analytics", "/article-categories"]:
        assert client.get(f"{A}{p}").status_code == 401, p
