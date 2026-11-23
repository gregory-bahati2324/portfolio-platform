import pytest
import redis as redis_lib
from fastapi import HTTPException

from app.core import ratelimit
from app.core.config import get_settings
from app.core.ratelimit import RateLimiter

URL = "redis://localhost:6379/15"


def _have_redis() -> bool:
    try:
        return bool(redis_lib.Redis.from_url(URL, socket_connect_timeout=0.3).ping())
    except Exception:
        return False


@pytest.fixture
def use_redis(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_BACKEND", "redis")
    monkeypatch.setenv("REDIS_URL", URL)
    get_settings.cache_clear()
    ratelimit.reset_client()
    yield
    get_settings.cache_clear()
    ratelimit.reset_client()


@pytest.mark.skipif(not _have_redis(), reason="no local Redis")
def test_redis_limit_is_shared_between_instances_and_resettable(use_redis):
    a, b = RateLimiter(3, 60, name="t-share"), RateLimiter(3, 60, name="t-share")  # two "workers"
    a.reset()
    a.check("1.2.3.4")
    b.check("1.2.3.4")
    a.check("1.2.3.4")
    with pytest.raises(HTTPException) as e:
        b.check("1.2.3.4")
    assert e.value.status_code == 429
    b.check("5.6.7.8")  # other client unaffected
    a.reset()
    b.check("1.2.3.4")


@pytest.mark.skipif(not _have_redis(), reason="no local Redis")
def test_redis_window_expires(use_redis):
    import time

    r = RateLimiter(1, 1, name="t-expire")
    r.reset()
    r.check("k")
    with pytest.raises(HTTPException):
        r.check("k")
    time.sleep(1.2)
    r.check("k")
    r.reset()


def test_falls_back_to_memory_when_redis_is_down(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_BACKEND", "redis")
    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1/0")  # nothing listens here
    get_settings.cache_clear()
    ratelimit.reset_client()
    try:
        r = RateLimiter(2, 60, name="t-down")
        r.check("x")
        r.check("x")
        with pytest.raises(HTTPException):
            r.check("x")  # still enforced in-process
    finally:
        get_settings.cache_clear()
        ratelimit.reset_client()


def test_memory_backend_default():
    r = RateLimiter(1, 60, name="t-mem")
    r.check("a")
    with pytest.raises(HTTPException):
        r.check("a")
