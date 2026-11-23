"""Sliding-window rate limiting.

Backend is chosen by RATE_LIMIT_BACKEND: "memory" (single process, default for dev and tests) or
"redis" (shared across workers and restarts; used in production). If Redis becomes unreachable the
limiter falls back to the in-process window and logs a warning, so a Redis outage degrades
protection instead of taking the site down."""
import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.core.config import get_settings

log = logging.getLogger("app.ratelimit")
_redis = None
_redis_failed_at = 0.0


def _client():
    """Shared Redis client, or None when disabled or recently failing (retry after 30 s)."""
    global _redis, _redis_failed_at
    s = get_settings()
    if s.rate_limit_backend != "redis":
        return None
    if _redis_failed_at and time.monotonic() - _redis_failed_at < 30:
        return None
    if _redis is None:
        import redis

        _redis = redis.Redis.from_url(s.redis_url, socket_connect_timeout=0.3, socket_timeout=0.3)
    return _redis


def reset_client() -> None:
    global _redis, _redis_failed_at
    _redis, _redis_failed_at = None, 0.0


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, name: str = ""):
        self.limit, self.window, self.name = limit, window_seconds, name or f"rl{id(self)}"
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        self.check(request.client.host if request.client else "unknown")

    def check(self, key: str, limit: int | None = None, window: int | None = None) -> None:
        limit, window = limit or self.limit, window or self.window
        allowed = self._redis_allow(key, limit, window)
        if allowed is None:
            allowed = self._memory_allow(key, limit, window)
        if not allowed:
            raise HTTPException(429, "Too many requests, please try again later")

    def _memory_allow(self, key: str, limit: int, window: int) -> bool:
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True

    def _redis_allow(self, key: str, limit: int, window: int) -> bool | None:
        global _redis_failed_at
        r = _client()
        if r is None:
            return None
        rk = f"rl:{self.name}:{key}"
        now = time.time()
        try:
            pipe = r.pipeline()
            pipe.zremrangebyscore(rk, 0, now - window)
            pipe.zcard(rk)
            _, count = pipe.execute()
            if count >= limit:
                return False
            pipe = r.pipeline()
            pipe.zadd(rk, {f"{now}:{uuid.uuid4().hex[:8]}": now})
            pipe.expire(rk, window + 1)
            pipe.execute()
            return True
        except Exception:
            _redis_failed_at = time.monotonic()
            log.warning("redis unavailable for rate limiting; using in-process fallback")
            return None

    def reset(self) -> None:
        self.hits.clear()
        r = _client()
        if r is not None:
            try:
                for k in r.scan_iter(f"rl:{self.name}:*"):
                    r.delete(k)
            except Exception:
                log.debug("could not clear redis rate-limit keys")
