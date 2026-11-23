from app.models import AuditLog
from tests.conftest import PASSWORD


def _make(db):
    from app.core.security import hash_password
    from app.models import AdminUser

    db.add(AdminUser(email="owner@example.com", password_hash=hash_password(PASSWORD)))
    db.commit()


def test_admin_routes_require_auth(client):
    for path in ["/overview", "/profile", "/projects", "/media", "/inquiries", "/skills", "/services", "/settings"]:
        assert client.get(f"/api/v1/admin{path}").status_code == 401, path


def test_login_success_sets_httponly_cookie(client, db):
    _make(db)
    r = client.post("/api/v1/auth/login", json={"email": "Owner@Example.com", "password": PASSWORD})
    assert r.status_code == 200 and r.json()["email"] == "owner@example.com"
    set_cookie = r.headers.get_list("set-cookie")
    access = next(c for c in set_cookie if c.startswith("access_token="))
    assert "HttpOnly" in access and "SameSite=lax" in access
    assert "password" not in r.text
    assert client.get("/api/v1/auth/me").json()["role"] == "owner"


def test_login_failure_is_generic_and_audited(client, db):
    _make(db)
    wrong_pw = client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "nope-nope-nope"})
    unknown = client.post("/api/v1/auth/login", json={"email": "ghost@example.com", "password": "nope-nope-nope"})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()
    assert db.query(AuditLog).filter_by(action="login_failed").count() == 2


def test_login_rate_limited(client, db):
    _make(db)
    codes = [client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "bad-bad-bad-bad"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429


def test_csrf_required_for_mutations(admin):
    del admin.headers["X-CSRF-Token"]
    r = admin.put("/api/v1/admin/settings", json={"site_title": "x"})
    assert r.status_code == 403
    admin.headers["X-CSRF-Token"] = "wrong"
    assert admin.put("/api/v1/admin/settings", json={"site_title": "x"}).status_code == 403
    admin.headers["X-CSRF-Token"] = admin.cookies.get("csrf_token")
    assert admin.put("/api/v1/admin/settings", json={"site_title": "x"}).status_code == 200


def test_tampered_or_logged_out_session_rejected(admin):
    admin.cookies.set("access_token", "garbage")
    assert admin.get("/api/v1/admin/overview").status_code == 401


def test_logout_clears_session(admin):
    assert admin.post("/api/v1/auth/logout").status_code == 204
    assert admin.get("/api/v1/auth/me").status_code == 401


def test_change_password(admin, client):
    bad = admin.post("/api/v1/auth/change-password", json={"current_password": "wrong", "new_password": "a-new-long-password"})
    assert bad.status_code == 400
    short = admin.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": "short"})
    assert short.status_code == 422
    ok = admin.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": "a-new-long-password"})
    assert ok.status_code == 204
    admin.post("/api/v1/auth/logout")
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": "a-new-long-password"}).status_code == 200


def test_inactive_user_cannot_use_existing_session(admin, db):
    from app.models import AdminUser

    u = db.query(AdminUser).one()
    u.is_active = False
    db.commit()
    assert admin.get("/api/v1/admin/overview").status_code == 401
