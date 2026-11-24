import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.ratelimit import RateLimiter
from app.core.security import (
    CSRF_COOKIE, clear_auth_cookies, csrf_protect, current_admin, hash_password, set_auth_cookies, verify_password,
)
from app.core.config import get_settings
from app.models import AdminUser, PasswordResetToken
from app.schemas.admin import AdminOut, ForgotPasswordIn, LoginIn, PasswordChangeIn, ResetPasswordIn
from app.services.audit import audit
from app.services.notify import send_email

router = APIRouter(prefix="/auth", tags=["auth"])
login_limiter = RateLimiter(limit=10, window_seconds=900, name="login")
forgot_limiter = RateLimiter(limit=5, window_seconds=3600, name="forgot")
forgot_email_limiter = RateLimiter(limit=3, window_seconds=3600, name="forgot-email")
reset_limiter = RateLimiter(limit=10, window_seconds=900, name="reset")
RESET_MINUTES = 30
FORGOT_MESSAGE = "If an account exists for that email, a reset link has been sent. It expires in 30 minutes."


@router.post("/login", response_model=AdminOut)
def login(data: LoginIn, request: Request, response: Response, db: Session = Depends(get_db), _: None = Depends(login_limiter)):
    user = db.scalars(select(AdminUser).where(AdminUser.email == data.email.lower())).first()
    ok = verify_password(data.password, user.password_hash if user else None)
    if not ok or not user or not user.is_active:
        audit(db, None, "login_failed", request, detail_email=data.email.lower())
        db.commit()
        raise HTTPException(401, "Incorrect email or password")
    user.last_login_at = datetime.now(timezone.utc)
    audit(db, user, "login", request)
    db.commit()
    set_auth_cookies(response, user)
    return user

@router.get("/csrf")
def get_csrf_token(request: Request, response: Response):
    token = request.cookies.get(CSRF_COOKIE)

    if not token:
        token = secrets.token_urlsafe(32)
        s = get_settings()
        response.set_cookie(
            CSRF_COOKIE,
            token,
            max_age=s.access_token_minutes * 60,
            httponly=False,
            secure=s.cookie_secure,
            samesite="none",
            path="/",
        )

    return {"csrf_token": token}

@router.post("/logout", status_code=204)
def logout(response: Response):
    clear_auth_cookies(response)


@router.get("/me", response_model=AdminOut)
def me(user: AdminUser = Depends(current_admin)):
    return user


@router.post("/change-password", status_code=204, dependencies=[Depends(csrf_protect)])
def change_password(data: PasswordChangeIn, request: Request, response: Response, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    user.password_version = (user.password_version or 0) + 1  # signs out every other session
    audit(db, user, "password_changed", request)
    db.commit()
    set_auth_cookies(response, user)  # keep this session alive


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/forgot-password", status_code=202)
def forgot_password(data: ForgotPasswordIn, request: Request, background: BackgroundTasks, db: Session = Depends(get_db), _: None = Depends(forgot_limiter)):
    """Always answers identically so it cannot be used to discover which emails have accounts."""
    email = data.email.lower()
    forgot_email_limiter.check(email)
    user = db.scalars(select(AdminUser).where(AdminUser.email == email)).first()
    if user and user.is_active:
        for old in db.scalars(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))).all():
            old.used_at = datetime.now(timezone.utc)  # only the newest link works
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(user_id=user.id, token_hash=_hash(token), expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_MINUTES)))
        audit(db, user, "password_reset_requested", request)
        db.commit()
        site = get_settings().public_site_url.rstrip("/")
        background.add_task(send_email, user.email, "Reset your admin password", f"Use this link within {RESET_MINUTES} minutes to choose a new password:\n\n{site}/admin/reset-password?token={token}\n\nIf you did not ask for this, you can ignore this email; your password has not changed.")
    return {"message": FORGOT_MESSAGE}


@router.post("/reset-password", status_code=204)
def reset_password(data: ResetPasswordIn, request: Request, db: Session = Depends(get_db), _: None = Depends(reset_limiter)):
    row = db.scalars(select(PasswordResetToken).where(PasswordResetToken.token_hash == _hash(data.token))).first()
    now = datetime.now(timezone.utc)
    exp = row.expires_at if row and row.expires_at.tzinfo else (row.expires_at.replace(tzinfo=timezone.utc) if row else None)
    if not row or row.used_at or not exp or exp < now:
        raise HTTPException(400, "This reset link is invalid or has expired. Please request a new one.")
    user = db.get(AdminUser, row.user_id)
    if not user or not user.is_active:
        raise HTTPException(400, "This reset link is invalid or has expired. Please request a new one.")
    user.password_hash = hash_password(data.new_password)
    user.password_version = (user.password_version or 0) + 1  # every existing session stops working
    row.used_at = now
    audit(db, user, "password_reset_completed", request)
    db.commit()
