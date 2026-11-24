import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.services.gemini_health import check_gemini

from app.core.db import get_db

router = APIRouter(prefix="/health", tags=["health"])
log = logging.getLogger("app.health")


@router.get("")
def liveness() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def readiness(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        log.exception("database not ready")
        return JSONResponse(
            status_code=503, content={"status": "unavailable", "database": "down"}
        )
    return {"status": "ok", "database": "up"}



@router.get("/gemini")
def gemini_health(db: Session = Depends(get_db)):
    result = check_gemini(db)

    status_code = 200 if result["status"] in ("available", "disabled") else 503

    return JSONResponse(
        status_code=status_code,
        content=result,
    )

