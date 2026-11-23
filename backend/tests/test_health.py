from sqlalchemy.exc import OperationalError

from app.core.db import get_db
from app.main import app


def test_liveness(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "x-request-id" in r.headers


def test_readiness_ok(client):
    r = client.get("/api/v1/health/ready")
    assert r.status_code == 200
    assert r.json()["database"] == "up"


def test_readiness_db_down(client):
    class Broken:
        def execute(self, *_):
            raise OperationalError("x", {}, Exception("down"))

    app.dependency_overrides[get_db] = lambda: Broken()
    try:
        r = client.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 503


def test_validation_error_shape(client):
    r = client.get("/api/v1/health", params={"x": 1})
    assert r.status_code == 200
    r = client.get("/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "http_error"
