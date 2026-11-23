from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AdminUser, AuditLog


def audit(db: Session, user: AdminUser | None, action: str, request: Request | None = None, entity: str = "", entity_id: str = "", **detail) -> None:
    """Adds an audit row to the current transaction (committed with the change itself)."""
    db.add(AuditLog(
        user_id=user.id if user else None, action=action, entity=entity, entity_id=str(entity_id),
        detail=detail, ip=(request.client.host if request and request.client else ""),
    ))
