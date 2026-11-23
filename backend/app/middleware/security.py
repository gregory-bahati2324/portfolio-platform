import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import get_settings

log = logging.getLogger("app.request")

PUBLIC_CACHEABLE = (
    "/api/v1/profile", "/api/v1/site", "/api/v1/skills", "/api/v1/services", "/api/v1/projects", "/api/v1/project-categories",
    "/api/v1/articles", "/api/v1/article-categories", "/api/v1/testimonials", "/api/v1/chat/config",
)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        path = request.url.path
        if get_settings().is_production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if path.startswith("/api/"):
            # JSON API: never render as a document, never framed
            response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
            if path.startswith(("/api/v1/admin", "/api/v1/auth")):
                response.headers["Cache-Control"] = "no-store"
            elif request.method == "GET" and response.status_code == 200 and path.startswith(PUBLIC_CACHEABLE) and "cache-control" not in response.headers:
                # Public portfolio content: a shared cache (CDN) may reuse it for 15 s to absorb traffic spikes,
                # but browsers always revalidate (max-age=0), so the owner sees dashboard edits immediately
                # in their own browser. (A browser-side max-age made published projects "not appear".)
                response.headers["Cache-Control"] = "public, max-age=0, s-maxage=15"
        elif path.startswith("/media/"):
            # filenames are random per upload and replaced files get new names, so this is safe
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        return response


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        start = time.perf_counter()
        response = await call_next(request)
        ms = round((time.perf_counter() - start) * 1000, 1)
        response.headers["X-Request-ID"] = rid
        log.info(
            "request",
            extra={
                "request_id": rid,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": ms,
            },
        )
        return response
