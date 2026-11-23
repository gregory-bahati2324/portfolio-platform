import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.ratelimit import RateLimiter
from app.integrations.llm import LLMError
from app.models import ChatConversation, ChatMessage
from app.schemas.chat import ChatIn, ChatLink, ChatOut, ChatPublicConfig
from app.services import chatbot as bot

log = logging.getLogger("app.chat")
router = APIRouter(prefix="/chat", tags=["chat"])
ip_limiter = RateLimiter(limit=30, window_seconds=3600, name="chat-ip")
burst_limiter = RateLimiter(limit=4, window_seconds=10, name="chat-burst")

UNAVAILABLE = "The assistant is unavailable right now. Please use the contact form and Gregory will reply personally."


def _err(status: int, message: str) -> HTTPException:
    return HTTPException(status, message)


@router.get("/config", response_model=ChatPublicConfig)
def public_config(db: Session = Depends(get_db)):
    cfg = bot.effective(bot.get_config_row(db))
    db.commit()
    return ChatPublicConfig(enabled=bot.is_available(cfg), welcome_message=cfg.welcome_message, suggested_questions=cfg.suggested_questions)


@router.post("", response_model=ChatOut)
def chat(data: ChatIn, request: Request, db: Session = Depends(get_db)):
    cfg = bot.effective(bot.get_config_row(db))
    if not bot.is_available(cfg):
        raise _err(503, UNAVAILABLE)
    ip = request.client.host if request.client else "unknown"
    key = bot.hash_ip(ip)
    burst_limiter.check(key)
    ip_limiter.check(key, cfg.per_ip_hourly_limit, 3600)

    conv = db.scalars(select(ChatConversation).where(ChatConversation.session_token == data.session_id)).first() if data.session_id else None
    if conv is None:
        conv = ChatConversation(session_token=bot.new_session_token(), ip_hash=key)
        db.add(conv)
        db.flush()
    if conv.message_count >= cfg.per_session_message_limit:
        raise _err(429, "This conversation has reached its message limit. Please contact Gregory directly through the contact form.")

    text = bot.clean_visitor_text(data.message)
    if not text:
        raise _err(422, "Message is empty")
    history = [(m.role, m.content) for m in conv.messages]
    start = time.perf_counter()
    try:
        reply = bot.run_chat(db, cfg, history, text)
    except LLMError as e:
        db.rollback()
        log.warning("chat model error", extra={"status": e.kind})
        if e.kind == "blocked":
            raise _err(422, "I can't help with that message. Could you rephrase it?") from None
        raise _err(503, UNAVAILABLE) from None
    conv.messages.append(ChatMessage(role="user", content=text))
    conv.messages.append(ChatMessage(role="assistant", content=reply))
    conv.message_count += 1
    db.commit()
    log.info("chat reply", extra={"duration_ms": round((time.perf_counter() - start) * 1000)})
    return ChatOut(session_id=conv.session_token, reply=reply, links=[ChatLink(**lnk) for lnk in bot.extract_links(reply)])
