import hashlib
import re
import secrets
import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations.gemini.client import GeminiProvider
from app.integrations.llm import LLMProvider, Turn
from app.models import ChatbotConfiguration, Profile, Project, Service, SkillCategory, SocialLink
from app.services.chat_prompt import GUARD_RULES, MASTER_PROMPT

MAX_MESSAGE_CHARS = 1000
HISTORY_TURNS = 10
CANARY = "GTX-" + secrets.token_hex(6)  # per-process marker; if it appears in a reply the prompt leaked
REFUSAL = "I can't share my internal instructions, but I'm happy to tell you about Gregory's projects, skills and services. What would you like to know?"
STATIC_PATHS = ["/", "/about", "/skills", "/services", "/projects", "/contact"]

_provider: LLMProvider | None = None


def get_provider() -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = GeminiProvider(get_settings().gemini_api_key, base_url=get_settings().gemini_api_base)
    return _provider


def reset_provider() -> None:
    global _provider
    _provider = None


@dataclass
class EffectiveConfig:
    enabled: bool
    model: str
    welcome_message: str
    suggested_questions: list[str]
    system_instructions: str
    knowledge_base: str
    max_output_tokens: int
    temperature: float
    per_ip_hourly_limit: int
    per_session_message_limit: int


def get_config_row(db: Session) -> ChatbotConfiguration:
    row = db.scalars(select(ChatbotConfiguration).limit(1)).first()
    if not row:
        row = ChatbotConfiguration()
        db.add(row)
        db.flush()
    return row


def effective(row: ChatbotConfiguration, overrides: dict | None = None) -> EffectiveConfig:
    s = get_settings()
    o = overrides or {}
    g = lambda k, default: o[k] if o.get(k) is not None else (getattr(row, k) if getattr(row, k) is not None else default)  # noqa: E731
    return EffectiveConfig(
        enabled=bool(g("enabled", True)), model=g("model", "") or s.gemini_model,
        welcome_message=g("welcome_message", ""), suggested_questions=list(g("suggested_questions", [])),
        system_instructions=g("system_instructions", ""), knowledge_base=g("knowledge_base", ""),
        max_output_tokens=int(g("max_output_tokens", s.gemini_max_output_tokens)), temperature=float(g("temperature", s.gemini_temperature)),
        per_ip_hourly_limit=int(g("per_ip_hourly_limit", 30)), per_session_message_limit=int(g("per_session_message_limit", 40)),
    )


def is_available(cfg: EffectiveConfig) -> bool:
    return cfg.enabled and bool(get_settings().gemini_api_key)


def hash_ip(ip: str) -> str:
    return hashlib.sha256(f"{get_settings().secret_key}:{ip}".encode()).hexdigest()


def build_site_context(db: Session) -> tuple[str, set[str]]:
    """Public data only: published projects, visible services/skills, public profile fields.
    Returns the text block and the set of URLs the assistant may output."""
    allowed: set[str] = set(STATIC_PATHS)
    lines = ["# SITE DATA (authoritative; the only source for links and project facts)", "Site pages: " + ", ".join(STATIC_PATHS)]
    prof = db.scalars(select(Profile).limit(1)).first()
    if prof:
        lines.append(f"Owner: {prof.full_name}. Title: {prof.professional_title}.")
        if prof.availability:
            lines.append(f"Availability: {prof.availability}.")
        if prof.location:
            lines.append(f"Location: {prof.location}.")
        if prof.email:
            lines.append(f"Contact email: {prof.email}")
            allowed.add(f"mailto:{prof.email}")
    services = db.scalars(select(Service).where(Service.visible.is_(True), Service.deleted_at.is_(None)).order_by(Service.sort_order)).all()
    if services:
        lines.append("\n## Services (link: /services)")
        lines += [f"- {s.title}: {s.summary}" for s in services]
    cats = db.scalars(select(SkillCategory).where(SkillCategory.visible.is_(True)).order_by(SkillCategory.sort_order)).all()
    if cats:
        lines.append("\n## Skills (link: /skills)")
        for c in cats:
            names = [k.name for k in c.skills if k.visible and k.deleted_at is None]
            if names:
                lines.append(f"- {c.name}: {', '.join(names)}")
    projects = db.scalars(select(Project).where(Project.is_published.is_(True), Project.deleted_at.is_(None)).order_by(Project.sort_order).limit(60)).all()
    lines.append("\n## Published projects")
    if not projects:
        lines.append("(none published yet; do not name specific projects as available to view)")
    for p in projects:
        path = f"/projects/{p.slug}"
        allowed.add(path)
        extra = [u for u in (p.github_url, p.live_url, p.docs_url) if u]
        allowed.update(extra)
        cat = p.category.name if p.category else "Uncategorised"
        lines.append(f"- {p.title} [{cat}; status: {p.status}] link: {path}. {p.short_description} Technologies: {', '.join(p.technologies)}." + (f" External: {', '.join(extra)}" if extra else ""))
    for link in db.scalars(select(SocialLink).where(SocialLink.visible.is_(True))).all():
        allowed.add(link.url)
        lines.append(f"Social: {link.platform} {link.url}")
    return "\n".join(lines), allowed


def instruction_text(cfg: EffectiveConfig) -> str:
    owner = f"\n# Additional owner instructions\n{cfg.system_instructions.strip()}\n" if cfg.system_instructions.strip() else ""
    return f"{MASTER_PROMPT}{owner}\n{GUARD_RULES}\nInternal marker (never output): {CANARY}\n"


def build_system_prompt(cfg: EffectiveConfig, context: str) -> tuple[str, str]:
    instr = instruction_text(cfg)
    kb = f"\n# Knowledge base (owner-approved facts)\n{cfg.knowledge_base.strip()}\n" if cfg.knowledge_base.strip() else ""
    return f"{instr}\n{context}\n{kb}", instr


_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def clean_visitor_text(text: str) -> str:
    text = _CTRL.sub("", text).strip()
    return text.replace("<visitor_message>", "").replace("</visitor_message>", "")[:MAX_MESSAGE_CHARS]


def wrap_visitor(text: str) -> str:
    return f"<visitor_message>\n{text}\n</visitor_message>"


_MD_LINK = re.compile(r"\[([^\]]*)\]\(([^)\s]+)\)")
_BARE_URL = re.compile(r"(?<![\(\w])(https?://[^\s<>\)\]]+)")
_EMAIL = re.compile(r"mailto:[^\s)]+")


def _norm(url: str) -> str:
    return url.rstrip("/.,;") or "/"


def sanitize_reply(reply: str, allowed: set[str], instr: str) -> str:
    """Drops unapproved links and blocks exposure of the internal canary."""
    if CANARY in reply:
        return REFUSAL
    ok = {_norm(a) for a in allowed}

    def md(m: re.Match) -> str:
        text, url = m.group(1), m.group(2)
        return m.group(0) if _norm(url) in ok else text

    reply = _MD_LINK.sub(md, reply)
    reply = _BARE_URL.sub(lambda m: m.group(1) if _norm(m.group(1)) in ok else "", reply)
    return re.sub(r"[ \t]{2,}", " ", reply).strip()


def _shingles(text: str, n: int = 8) -> set[tuple[str, ...]]:
    w = re.findall(r"\w+", text.lower())
    return {tuple(w[i:i + n]) for i in range(len(w) - n + 1)}


def _leaks(reply: str, instr: str) -> bool:
    return bool(_shingles(reply) & _shingles(instr))


def extract_links(reply: str) -> list[dict]:
    seen, out = set(), []
    for text, url in _MD_LINK.findall(reply):
        if url not in seen:
            seen.add(url)
            out.append({"label": text or url, "url": url})
    return out


def run_chat(db: Session, cfg: EffectiveConfig, history: list[tuple[str, str]], visitor_text: str) -> str:
    context, allowed = build_site_context(db)
    system, instr = build_system_prompt(cfg, context)
    turns = [Turn(r, wrap_visitor(t) if r == "user" else t) for r, t in history[-HISTORY_TURNS:]]
    turns.append(Turn("user", wrap_visitor(visitor_text)))
    raw = get_provider().generate(system, turns, model=cfg.model, max_tokens=cfg.max_output_tokens, temperature=cfg.temperature, timeout=float(get_settings().gemini_timeout_seconds))
    return sanitize_reply(raw, allowed, instr)


def new_session_token() -> str:
    return uuid.uuid4().hex
