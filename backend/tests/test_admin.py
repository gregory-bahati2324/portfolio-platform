import io

from PIL import Image

from app.models import AuditLog, CustomerInquiry

A = "/api/v1/admin"


def png_bytes(size=(64, 48), color=(37, 99, 235)):
    b = io.BytesIO()
    Image.new("RGB", size, color).save(b, "PNG")
    return b.getvalue()


def upload(admin, data, name="pic.png", **form):
    return admin.post(f"{A}/media", files={"file": (name, data)}, data=form)


def test_profile_update_persists_and_is_public(admin, client):
    r = admin.put(f"{A}/profile", json={"headline": "New headline", "stats": [{"label": "Years", "value": "5"}], "bio_sections": {"introduction": "Hello"}})
    assert r.status_code == 200
    pub = client.get("/api/v1/profile").json()
    assert pub["headline"] == "New headline" and pub["stats"] == [{"label": "Years", "value": "5"}]
    assert pub["bio_sections"]["introduction"] == "Hello"


def test_settings_validates_color_and_applies(admin, client):
    assert admin.put(f"{A}/settings", json={"primary_color": "blue"}).status_code == 422
    assert admin.put(f"{A}/settings", json={"primary_color": "#1D4ED8", "show_proficiency": True}).status_code == 200
    site = client.get("/api/v1/site").json()
    assert site["primary_color"] == "#1D4ED8" and site["show_proficiency"] is True


def test_social_links_reject_javascript_urls(admin, client):
    assert admin.post(f"{A}/social-links", json={"platform": "X", "url": "javascript:alert(1)"}).status_code == 422
    assert admin.post(f"{A}/social-links", json={"platform": "GitHub", "url": "https://github.com/example"}).status_code == 201
    assert client.get("/api/v1/site").json()["social_links"][0]["platform"] == "GitHub"


def test_skill_crud_and_visibility(admin, client):
    cat = admin.post(f"{A}/skill-categories", json={"name": "Software Dev"}).json()
    assert cat["slug"] == "software-dev"
    sk = admin.post(f"{A}/skills", json={"category_id": cat["id"], "name": "Python"}).json()
    assert [s["name"] for c in client.get("/api/v1/skills").json() for s in c["skills"]] == ["Python"]
    admin.put(f"{A}/skills/{sk['id']}", json={"category_id": cat["id"], "name": "Python", "visible": False})
    assert client.get("/api/v1/skills").json() == []
    assert admin.post(f"{A}/skills", json={"category_id": cat["id"], "name": "X", "proficiency": 150}).status_code == 422
    assert admin.delete(f"{A}/skill-categories/{cat['id']}").status_code == 409  # still has a skill
    assert admin.delete(f"{A}/skills/{sk['id']}").status_code == 204
    assert admin.delete(f"{A}/skill-categories/{cat['id']}").status_code == 204


def test_service_crud_unique_slug_soft_delete(admin, client):
    a = admin.post(f"{A}/services", json={"title": "Web Development", "summary": "s"}).json()
    b = admin.post(f"{A}/services", json={"title": "Web Development"}).json()
    assert a["slug"] == "web-development" and b["slug"] == "web-development-2"
    assert len(client.get("/api/v1/services").json()) == 2
    admin.delete(f"{A}/services/{a['id']}")
    assert [s["slug"] for s in client.get("/api/v1/services").json()] == ["web-development-2"]


def _project(admin, **over):
    body = {"title": "Cocoa Harvesting", "short_description": "Vision-based harvesting", **over}
    r = admin.post(f"{A}/projects", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_project_lifecycle_draft_publish_unpublish_delete(admin, client):
    p = _project(admin)
    assert p["is_published"] is False and p["slug"] == "cocoa-harvesting"
    assert client.get("/api/v1/projects/cocoa-harvesting").status_code == 404  # draft hidden
    assert admin.get(f"{A}/projects/{p['id']}/preview").status_code == 200  # but previewable
    assert admin.post(f"{A}/projects/{p['id']}/publish", json={"published": True}).json()["is_published"] is True
    assert client.get("/api/v1/projects/cocoa-harvesting").status_code == 200
    admin.post(f"{A}/projects/{p['id']}/publish", json={"published": False})
    assert client.get("/api/v1/projects/cocoa-harvesting").status_code == 404
    admin.post(f"{A}/projects/{p['id']}/publish", json={"published": True})
    assert admin.delete(f"{A}/projects/{p['id']}").status_code == 204
    assert client.get("/api/v1/projects/cocoa-harvesting").status_code == 404
    assert admin.get(f"{A}/projects").json() == []


def test_cannot_publish_without_short_description(admin):
    p = _project(admin, short_description="")
    assert admin.post(f"{A}/projects/{p['id']}/publish", json={"published": True}).status_code == 422


def test_project_url_validation_and_status(admin):
    assert admin.post(f"{A}/projects", json={"title": "x", "github_url": "javascript:alert(1)"}).status_code == 422
    assert admin.post(f"{A}/projects", json={"title": "x", "status": "finished-ish"}).status_code == 422


def test_project_with_media_skills_and_reorder(admin, client):
    img = upload(admin, png_bytes()).json()
    cat = admin.post(f"{A}/skill-categories", json={"name": "AI"}).json()
    sk = admin.post(f"{A}/skills", json={"category_id": cat["id"], "name": "YOLO"}).json()
    p1 = _project(admin, title="One", main_image_id=img["id"], skill_ids=[sk["id"]], media=[{"media_id": img["id"], "caption": "Screen"}])
    p2 = _project(admin, title="Two")
    for p in (p1, p2):
        admin.post(f"{A}/projects/{p['id']}/publish", json={"published": True})
    detail = client.get("/api/v1/projects/one").json()
    assert detail["skills"] == ["YOLO"] and detail["media"][0]["caption"] == "Screen"
    assert detail["main_image"]["url"].startswith("/media/images/")
    assert admin.post(f"{A}/projects/reorder", json={"ids": [p2["id"], p1["id"]]}).status_code == 204
    assert [x["slug"] for x in client.get("/api/v1/projects").json()["items"]] == ["two", "one"]
    assert admin.post(f"{A}/projects", json={"title": "bad", "skill_ids": ["00000000-0000-0000-0000-000000000001"]}).status_code == 422


def test_inquiry_management(admin, client):
    client.post("/api/v1/inquiries", json={"name": "Amina Juma", "email": "a@example.com", "message": "Need an inventory system"})
    items = admin.get(f"{A}/inquiries").json()
    assert len(items) == 1 and items[0]["status"] == "new"
    assert admin.get(f"{A}/inquiries", params={"q": "amina"}).json()[0]["name"] == "Amina Juma"
    r = admin.patch(f"{A}/inquiries/{items[0]['id']}/status", json={"status": "contacted"})
    assert r.json()["status"] == "contacted"
    assert admin.patch(f"{A}/inquiries/{items[0]['id']}/status", json={"status": "bogus"}).status_code == 422
    assert admin.get(f"{A}/overview").json()["new_inquiries"] == 0


def test_overview_reports_real_counts_only(admin):
    p = _project(admin)
    _project(admin, title="Second")
    admin.post(f"{A}/projects/{p['id']}/publish", json={"published": True})
    o = admin.get(f"{A}/overview").json()
    assert (o["published_projects"], o["draft_projects"]) == (1, 1)
    assert o["visits_last_30_days"] == 0 and o["project_views_last_30_days"] == 0


def test_audit_log_records_sensitive_actions(admin, db):
    p = _project(admin)
    admin.post(f"{A}/projects/{p['id']}/publish", json={"published": True})
    admin.delete(f"{A}/projects/{p['id']}")
    actions = {a.action for a in db.query(AuditLog).all()}
    assert {"login", "project_created", "project_published", "project_deleted"} <= actions


def test_notifier_failure_never_loses_inquiry(client, db, monkeypatch):
    from app.services import notify

    monkeypatch.setenv("SMTP_HOST", "invalid.invalid")
    monkeypatch.setenv("NOTIFY_EMAIL_TO", "me@example.com")
    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        r = client.post("/api/v1/inquiries", json={"name": "Amina Juma", "email": "a@example.com", "message": "Need an inventory system"})
        assert r.status_code == 201
        assert db.query(CustomerInquiry).count() == 1
        notify.notify_new_inquiry("GRG-X", "n", "e@example.com", "m")  # must not raise
    finally:
        get_settings.cache_clear()


# ---- media --------------------------------------------------------------
def test_image_upload_optimizes_and_creates_thumbnail(admin, client):
    r = upload(admin, png_bytes((3000, 2000)), alt_text="A blue box", category="screenshot")
    assert r.status_code == 201
    m = r.json()
    assert m["kind"] == "image" and m["mime_type"] == "image/webp" and m["alt_text"] == "A blue box"
    assert m["url"].endswith(".webp") and m["thumbnail_url"].endswith("_thumb.webp")
    full = client.get(m["url"])
    assert full.status_code == 200 and full.headers["content-type"] == "image/webp"
    assert Image.open(io.BytesIO(full.content)).width <= 2000
    assert Image.open(io.BytesIO(client.get(m["thumbnail_url"]).content)).width <= 480


def test_upload_rejects_disguised_and_dangerous_files(admin):
    assert upload(admin, b"MZ\x90\x00fake exe", name="evil.png").status_code == 415
    assert upload(admin, b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", name="x.svg").status_code == 415
    assert upload(admin, b"<?php system($_GET[0]); ?>", name="shell.php").status_code == 415
    assert upload(admin, b"", name="empty.png").status_code == 400
    assert upload(admin, b"\x89PNG\r\n\x1a\ntruncated-not-really-a-png", name="bad.png").status_code == 415


def test_upload_size_limit_enforced(admin, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("MAX_IMAGE_MB", "0")
    get_settings.cache_clear()
    try:
        assert upload(admin, png_bytes()).status_code == 413
    finally:
        get_settings.cache_clear()


def test_video_and_pdf_accepted_by_content(admin, client):
    mp4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64
    r = upload(admin, mp4, name="demo.mp4")
    assert r.status_code == 201 and r.json()["kind"] == "video" and r.json()["url"].endswith(".mp4")
    assert client.get(r.json()["url"]).status_code == 200
    pdf = upload(admin, b"%PDF-1.4\n%%EOF", name="cv.pdf")
    assert pdf.status_code == 201 and pdf.json()["kind"] == "document"


def test_media_requires_auth_and_csrf(client, admin):
    admin.headers.pop("X-CSRF-Token")
    assert upload(admin, png_bytes()).status_code == 403
    admin.post("/api/v1/auth/logout")
    assert client.get(f"{A}/media").status_code == 401


def test_media_search_filter_update(admin):
    upload(admin, png_bytes(), name="hero.png", alt_text="Hero banner")
    upload(admin, b"%PDF-1.4\n%%EOF", name="cv.pdf")
    assert len(admin.get(f"{A}/media").json()) == 2
    assert len(admin.get(f"{A}/media", params={"kind": "document"}).json()) == 1
    assert len(admin.get(f"{A}/media", params={"q": "banner"}).json()) == 1
    mid = admin.get(f"{A}/media", params={"kind": "image"}).json()[0]["id"]
    assert admin.patch(f"{A}/media/{mid}", json={"alt_text": "Updated"}).json()["alt_text"] == "Updated"


def test_media_delete_blocked_when_in_use_then_allowed(admin, client):
    m = upload(admin, png_bytes()).json()
    p = _project(admin, main_image_id=m["id"], media=[{"media_id": m["id"]}])
    r = admin.delete(f"{A}/media/{m['id']}")
    assert r.status_code == 409 and "in use" in r.json()["error"]["message"]
    admin.put(f"{A}/projects/{p['id']}", json={"title": "Cocoa Harvesting", "short_description": "x"})
    assert admin.delete(f"{A}/media/{m['id']}").status_code == 204
    assert admin.get(f"{A}/media").json() == []
