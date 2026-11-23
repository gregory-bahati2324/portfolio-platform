import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.models import AdminUser

ACCESS_COOKIE = "access_token"
CSRF_COOKIE = "csrf_token"
CSRF_HEADER = "x-csrf-token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_hasher = PasswordHasher()
# Verified against when the email is unknown so response time does not reveal valid accounts.
_DUMMY_HASH = _hasher.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    try:
        return _hasher.verify(hashed or _DUMMY_HASH, password) and hashed is not None
    except (VerifyMismatchError, Exception):
        return False


def create_token(user: AdminUser) -> str:
    s = get_settings()
    exp = datetime.now(timezone.utc) + timedelta(minutes=s.access_token_minutes)
    return jwt.encode({"sub": str(user.id), "role": user.role, "pv": user.password_version or 0, "exp": exp}, s.secret_key, algorithm="HS256")


def set_auth_cookies(response: Response, user: AdminUser) -> None:
    s = get_settings()
    age = s.access_token_minutes * 60
    response.set_cookie(ACCESS_COOKIE, create_token(user), max_age=age, httponly=True, secure=s.cookie_secure, samesite="lax", path="/")
    response.set_cookie(CSRF_COOKIE, secrets.token_urlsafe(32), max_age=age, httponly=False, secure=s.cookie_secure, samesite="lax", path="/")


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def current_admin(request: Request, db: Session = Depends(get_db)) -> AdminUser:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        user = db.get(AdminUser, uuid.UUID(payload["sub"]))
    except Exception:
        raise HTTPException(401, "Invalid or expired session") from None
    if not user or not user.is_active or payload.get("pv", 0) != (user.password_version or 0):
        raise HTTPException(401, "Invalid or expired session")
    return user


def csrf_protect(request: Request) -> None:
    """Double-submit cookie: header must match the (JS-readable) cookie on unsafe methods."""
    if request.method in SAFE_METHODS:
        return
    cookie, header = request.cookies.get(CSRF_COOKIE), request.headers.get(CSRF_HEADER)
    if not cookie or not header or not secrets.compare_digest(cookie, header):
        raise HTTPException(403, "CSRF token missing or invalid")


def require_owner(user: AdminUser = Depends(current_admin)) -> AdminUser:
    if user.role != "owner":
        raise HTTPException(403, "Insufficient permissions")
    return user
