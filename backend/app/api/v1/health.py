import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

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
