import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.v1.admin.common import ADMIN_DEPS, commit
from app.core.config import get_settings
from app.core.db import get_db
from app.core.ratelimit import RateLimiter
from app.core.security import current_admin
from app.integrations.llm import LLMError
from app.models import AdminUser, ChatConversation, ChatMessage, CustomerInquiry
from app.schemas import chat as s
from app.services import chatbot as bot
from app.services.audit import audit

router = APIRouter(prefix="/chatbot", dependencies=ADMIN_DEPS)
test_limiter = RateLimiter(limit=30, window_seconds=600, name="chat-test")


def _out(row) -> s.ChatbotConfigOut:
    st = get_settings()
    return s.ChatbotConfigOut(
        enabled=row.enabled, model=row.model, default_model=st.gemini_model, welcome_message=row.welcome_message,
        suggested_questions=row.suggested_questions, system_instructions=row.system_instructions, knowledge_base=row.knowledge_base,
        max_output_tokens=row.max_output_tokens, temperature=row.temperature, per_ip_hourly_limit=row.per_ip_hourly_limit,
        per_session_message_limit=row.per_session_message_limit, api_key_configured=bool(st.gemini_api_key),
    )


@router.get("", response_model=s.ChatbotConfigOut)
def get_config(db: Session = Depends(get_db)):
    row = bot.get_config_row(db)
    commit(db)
    return _out(row)


@router.put("", response_model=s.ChatbotConfigOut)
def update_config(data: s.ChatbotConfigIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    row = bot.get_config_row(db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    audit(db, user, "chatbot_updated", request, "chatbot", row.id, fields=sorted(data.model_dump(exclude_unset=True)))
    commit(db)
    return _out(row)


@router.post("/test")
def test_chat(data: s.ChatTestIn, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    """Tries the assistant with UNSAVED draft settings. Nothing is stored."""
    test_limiter.check(str(user.id))
    if not get_settings().gemini_api_key:
        raise HTTPException(503, "GEMINI_API_KEY is not configured on the server")
    row = bot.get_config_row(db)
    cfg = bot.effective(row, data.draft.model_dump(exclude_unset=True) if data.draft else None)
    history = [(m.get("role"), str(m.get("content", ""))[:2000]) for m in data.history if m.get("role") in ("user", "assistant")]
    start = time.perf_counter()
    try:
        reply = bot.run_chat(db, cfg, history, bot.clean_visitor_text(data.message))
    except LLMError as e:
        raise HTTPException(502, f"Model error ({e.kind}): {e}") from None
    return {"reply": reply, "model": cfg.model, "latency_ms": round((time.perf_counter() - start) * 1000), "links": bot.extract_links(reply)}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    week = datetime.now(timezone.utc) - timedelta(days=7)
    one = lambda q: db.scalar(q) or 0  # noqa: E731
    return {
        "conversations": one(select(func.count()).select_from(ChatConversation).where(ChatConversation.message_count > 0)),
        "conversations_last_7_days": one(select(func.count()).select_from(ChatConversation).where(ChatConversation.message_count > 0, ChatConversation.created_at >= week)),
        "visitor_messages": one(select(func.coalesce(func.sum(ChatConversation.message_count), 0))),
        "chatbot_inquiries": one(select(func.count()).select_from(CustomerInquiry).where(CustomerInquiry.source == "chatbot")),
    }


@router.get("/conversations", response_model=list[s.ConversationListItem])
def conversations(db: Session = Depends(get_db)):
    rows = db.scalars(select(ChatConversation).where(ChatConversation.message_count > 0).order_by(ChatConversation.created_at.desc()).limit(100)).all()
    out = []
    for c in rows:
        first = next((m.content for m in c.messages if m.role == "user"), "")
        out.append(s.ConversationListItem(id=c.id, created_at=c.created_at, message_count=c.message_count, preview=first[:120], has_inquiry=c.inquiry_id is not None))
    return out


@router.get("/conversations/{id}", response_model=list[s.ConversationMessage])
def conversation(id: uuid.UUID, db: Session = Depends(get_db)):
    c = db.get(ChatConversation, id)
    if not c:
        raise HTTPException(404, "Conversation not found")
    return [s.ConversationMessage(role=m.role, content=m.content, created_at=m.created_at) for m in c.messages]


@router.delete("/conversations", status_code=204)
def purge(older_than_days: int, request: Request, user: AdminUser = Depends(current_admin), db: Session = Depends(get_db)):
    if older_than_days < 0 or older_than_days > 3650:
        raise HTTPException(422, "older_than_days must be between 0 and 3650")
    cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    ids = db.scalars(select(ChatConversation.id).where(ChatConversation.created_at < cutoff)).all()
    if ids:
        db.execute(delete(ChatMessage).where(ChatMessage.conversation_id.in_(ids)))
        db.execute(delete(ChatConversation).where(ChatConversation.id.in_(ids)))
    audit(db, user, "chat_purged", request, "chat", "", older_than_days=older_than_days, deleted=len(ids))
    commit(db)
