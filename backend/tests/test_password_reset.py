import re
from datetime import datetime, timedelta, timezone

import pytest

from app.models import AdminUser, AuditLog, PasswordResetToken
from tests.conftest import PASSWORD

NEW = "a-brand-new-passphrase"


@pytest.fixture
def mails(monkeypatch):
    sent = []
    monkeypatch.setattr("app.api.v1.auth.send_email", lambda to, subject, body, reply_to=None: sent.append((to, subject, body)) or True)
    return sent


def token_from(mails, n=-1):
    return re.search(r"token=([\w-]+)", mails[n][2]).group(1)


def forgot(client, email="owner@example.com"):
    return client.post("/api/v1/auth/forgot-password", json={"email": email})


def reset(client, token, pw=NEW):
    return client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": pw})


def test_forgot_answers_identically_for_known_and_unknown_emails(client, admin, mails):
    known, unknown = forgot(client), forgot(client, "ghost@example.com")
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
    assert len(mails) == 1 and mails[0][0] == "owner@example.com"


def test_token_is_stored_hashed_only(client, admin, mails, db):
    forgot(client)
    tok = token_from(mails)
    rows = db.query(PasswordResetToken).all()
    assert len(rows) == 1 and tok not in rows[0].token_hash and len(rows[0].token_hash) == 64


def test_full_reset_flow_signs_out_old_sessions(client, admin, mails):
    assert admin.get("/api/v1/auth/me").status_code == 200  # session before reset
    forgot(client)
    assert reset(client, token_from(mails)).status_code == 204
    assert admin.get("/api/v1/auth/me").status_code == 401  # old session is dead
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": NEW}).status_code == 200


def test_token_is_single_use(client, admin, mails):
    forgot(client)
    t = token_from(mails)
    assert reset(client, t).status_code == 204
    assert reset(client, t, "another-long-passphrase").status_code == 400


def test_new_request_invalidates_previous_link(client, admin, mails):
    forgot(client)
    forgot(client)
    assert reset(client, token_from(mails, 0)).status_code == 400
    assert reset(client, token_from(mails, 1)).status_code == 204


def test_expired_wrong_and_weak_tokens_rejected(client, admin, mails, db):
    forgot(client)
    t = token_from(mails)
    assert reset(client, "x" * 43).status_code == 400
    assert reset(client, t, "short").status_code == 422
    row = db.query(PasswordResetToken).one()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    r = reset(client, t)
    assert r.status_code == 400 and "expired" in r.json()["error"]["message"]


def test_inactive_user_gets_no_email_and_cannot_reset(client, admin, mails, db):
    forgot(client)
    t = token_from(mails)
    db.query(AdminUser).one().is_active = False
    db.commit()
    assert reset(client, t).status_code == 400
    mails.clear()
    assert forgot(client).status_code == 202 and mails == []


def test_forgot_is_rate_limited_per_email_and_ip(client, admin, mails):
    codes = [forgot(client).status_code for _ in range(4)]
    assert codes == [202, 202, 202, 429]  # 3 per email per hour


def test_reset_attempts_rate_limited(client, admin):
    codes = [reset(client, "x" * 43).status_code for _ in range(11)]
    assert codes[:10] == [400] * 10 and codes[10] == 429


def test_password_change_signs_out_other_sessions_but_keeps_current(admin, client, db):
    from fastapi.testclient import TestClient

    from app.main import app

    other = TestClient(app)
    other.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": PASSWORD})
    assert other.get("/api/v1/auth/me").status_code == 200
    r = admin.post("/api/v1/auth/change-password", json={"current_password": PASSWORD, "new_password": NEW})
    assert r.status_code == 204
    assert admin.get("/api/v1/auth/me").status_code == 200  # current session re-issued
    assert other.get("/api/v1/auth/me").status_code == 401  # other device signed out


def test_reset_events_are_audited(client, admin, mails, db):
    forgot(client)
    reset(client, token_from(mails))
    actions = {a.action for a in db.query(AuditLog).all()}
    assert {"password_reset_requested", "password_reset_completed"} <= actions
