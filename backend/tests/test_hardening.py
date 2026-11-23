import pytest

from app.core.config import Settings, get_settings

A = "/api/v1/admin"
PROD_OK = {
    "ENVIRONMENT": "production", "SECRET_KEY": "x" * 40, "COOKIE_SECURE": "true", "PUBLIC_SITE_URL": "https://gregtech.example",
    "CORS_ORIGINS": '["https://gregtech.example"]', "ALLOWED_HOSTS": '["gregtech.example"]', "RATE_LIMIT_BACKEND": "redis",
}


def _set(monkeypatch, **env):
    for k in PROD_OK:
        monkeypatch.delenv(k, raising=False)
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _restore():
    yield
    get_settings.cache_clear()


def test_good_production_config_loads(monkeypatch):
    _set(monkeypatch, **PROD_OK)
    assert get_settings().is_production


@pytest.mark.parametrize("bad", [
    {"SECRET_KEY": "change-me"}, {"SECRET_KEY": "short"}, {"COOKIE_SECURE": "false"}, {"PUBLIC_SITE_URL": "http://gregtech.example"},
    {"CORS_ORIGINS": '["*"]'}, {"ALLOWED_HOSTS": '["*"]'}, {"RATE_LIMIT_BACKEND": "memory"},
])
def test_unsafe_production_config_refuses_to_start(monkeypatch, bad):
    _set(monkeypatch, **{**PROD_OK, **bad})
    with pytest.raises(RuntimeError, match="Unsafe production configuration"):
        get_settings()


def test_development_defaults_stay_permissive(monkeypatch):
    _set(monkeypatch)
    assert Settings().environment in ("development", "test")


def test_security_headers_on_every_api_response(client):
    r = client.get("/api/v1/health")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"


def test_admin_and_auth_responses_are_never_cached(admin):
    assert admin.get(f"{A}/overview").headers["cache-control"] == "no-store"
    assert admin.get("/api/v1/auth/me").headers["cache-control"] == "no-store"


def test_media_is_cached_immutably(admin, client):
    import io

    from PIL import Image

    b = io.BytesIO()
    Image.new("RGB", (10, 10)).save(b, "PNG")
    url = admin.post(f"{A}/media", files={"file": ("a.png", b.getvalue())}).json()["url"]
    assert "immutable" in client.get(url).headers["cache-control"]


def test_json_is_gzip_compressed_when_large(client, db):
    from app.models import Project

    for i in range(40):
        db.add(Project(slug=f"p{i}", title=f"Project {i}", short_description="x" * 80, is_published=True))
    db.commit()
    r = client.get("/api/v1/projects", params={"page_size": 40}, headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip" and r.json()["total"] == 40


def test_session_cookie_is_secure_when_configured(monkeypatch, db):
    from fastapi.testclient import TestClient

    from app.core.security import hash_password
    from app.main import app
    from app.models import AdminUser

    monkeypatch.setenv("COOKIE_SECURE", "true")
    get_settings.cache_clear()
    db.add(AdminUser(email="o@example.com", password_hash=hash_password("correct-horse-battery")))
    db.commit()
    r = TestClient(app).post("/api/v1/auth/login", json={"email": "o@example.com", "password": "correct-horse-battery"})
    cookies = r.headers.get_list("set-cookie")
    assert all("Secure" in c for c in cookies) and any("HttpOnly" in c and c.startswith("access_token") for c in cookies)


def test_cors_rejects_unlisted_origins(client):
    ok = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    bad = client.get("/api/v1/health", headers={"Origin": "https://evil.example"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers


@pytest.mark.parametrize("payload", ["' OR 1=1 --", "'; DROP TABLE projects; --", "%", "_", "\\", "a" * 100, "\x00", "<script>alert(1)</script>"])
def test_search_inputs_cannot_inject_or_crash(client, db, payload):
    from app.models import Project

    db.add(Project(slug="safe", title="Safe", short_description="x", is_published=True))
    db.commit()
    for path in ("/api/v1/projects", "/api/v1/articles"):
        r = client.get(path, params={"q": payload})
        assert r.status_code in (200, 422), (path, payload, r.status_code)
    assert client.get("/api/v1/projects").json()["total"] == 1  # table intact


def test_nul_bytes_in_bodies_never_cause_a_500(client):
    r = client.post("/api/v1/inquiries", json={"name": "Amina Juma", "email": "a@example.com", "message": "hello\u0000 world, need a system"})
    assert r.status_code in (201, 422)  # SQLite stores it, PostgreSQL rejects it; never a 500


def test_api_docs_hidden_in_production(monkeypatch):
    from app.main import create_app

    _set(monkeypatch, **PROD_OK)
    app = create_app()
    assert app.docs_url is None and app.openapi_url is None


def test_trusted_host_blocks_unknown_hosts(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import create_app

    _set(monkeypatch, ENVIRONMENT="test", ALLOWED_HOSTS='["gregtech.example"]')
    c = TestClient(create_app())
    assert c.get("/api/v1/health", headers={"Host": "gregtech.example"}).status_code == 200
    assert c.get("/api/v1/health", headers={"Host": "evil.example"}).status_code == 400


def test_public_content_is_briefly_cacheable_but_private_endpoints_are_not(client, admin):
    for p in ["/api/v1/projects", "/api/v1/site", "/api/v1/skills", "/api/v1/articles", "/api/v1/profile"]:
        cc = client.get(p).headers["cache-control"]
        assert "s-maxage=15" in cc and "max-age=0" in cc and "stale-while-revalidate" not in cc, p
    assert "cache-control" not in client.get("/api/v1/health").headers or "public" not in client.get("/api/v1/health").headers["cache-control"]
    assert admin.get("/api/v1/admin/projects").headers["cache-control"] == "no-store"
    r = client.post("/api/v1/inquiries", json={"name": "Amina Juma", "email": "a@example.com", "message": "Need an inventory system"})
    assert "public" not in r.headers.get("cache-control", "")
    assert "public" not in client.get("/api/v1/projects/does-not-exist").headers.get("cache-control", "")  # errors are never cached


def test_list_endpoints_do_not_issue_one_query_per_row(client, db):
    from sqlalchemy import event

    from app.core.db import get_engine
    from app.models import Article, Project, ProjectCategory, Skill, SkillCategory

    cat = ProjectCategory(name="AI", slug="ai")
    sc = SkillCategory(name="Dev", slug="dev")
    db.add_all([cat, sc])
    db.flush()
    from datetime import datetime, timezone

    for i in range(25):
        db.add(Project(slug=f"p{i}", title=f"P{i}", short_description="d", is_published=True, category_id=cat.id))
        db.add(Article(slug=f"a{i}", title=f"A{i}", content="x", is_published=True, published_at=datetime.now(timezone.utc)))
        db.add(Skill(category_id=sc.id, name=f"S{i}"))
    db.commit()
    count = {"n": 0}

    def tick(*_):
        count["n"] += 1

    event.listen(get_engine(), "before_cursor_execute", tick)
    try:
        for path, limit in [("/api/v1/projects?page_size=25", 5), ("/api/v1/articles?page_size=25", 5), ("/api/v1/skills", 4)]:
            count["n"] = 0
            assert client.get(path).status_code == 200
            assert count["n"] <= limit, f"{path} ran {count['n']} queries for 25 rows"
    finally:
        event.remove(get_engine(), "before_cursor_execute", tick)
