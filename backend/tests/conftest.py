import os
import tempfile

os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ["LOCAL_MEDIA_DIR"] = tempfile.mkdtemp(prefix="media-test-")
os.environ["SECRET_KEY"] = "test-secret-key-test-secret-key-1234"

import pytest
from fastapi.testclient import TestClient

import app.models  # noqa: F401
from app.api.v1.auth import forgot_email_limiter, forgot_limiter, login_limiter, reset_limiter
from app.api.v1.public import inquiry_limiter
from app.api.v1.chat import burst_limiter, ip_limiter
from app.api.v1.admin.chatbot import test_limiter
from app.api.v1.extras import event_limiter, subscribe_limiter
from app.core.db import get_engine, get_sessionmaker
from app.core.security import hash_password
from app.main import app
from app.models import AdminUser
from app.models.base import Base

PASSWORD = "correct-horse-battery"


@pytest.fixture(autouse=True)
def _db():
    Base.metadata.drop_all(get_engine())
    Base.metadata.create_all(get_engine())
    inquiry_limiter.reset()
    login_limiter.reset()
    forgot_limiter.reset()
    forgot_email_limiter.reset()
    reset_limiter.reset()
    burst_limiter.reset()
    ip_limiter.reset()
    test_limiter.reset()
    event_limiter.reset()
    subscribe_limiter.reset()
    yield


@pytest.fixture
def db():
    s = get_sessionmaker()()
    yield s
    s.close()


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def admin(client, db):
    """Logged-in client: auth cookie set, CSRF header attached to every request."""
    db.add(AdminUser(email="owner@example.com", password_hash=hash_password(PASSWORD), role="owner"))
    db.commit()
    r = client.post("/api/v1/auth/login", json={"email": "owner@example.com", "password": PASSWORD})
    assert r.status_code == 200
    client.headers["X-CSRF-Token"] = client.cookies.get("csrf_token")
    return client
