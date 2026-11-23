import re
import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

MODEL_RE = re.compile(r"^[A-Za-z0-9._-]{0,80}$")


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    session_id: str | None = Field(None, max_length=64, pattern=r"^[a-f0-9]{32}$")


class ChatLink(BaseModel):
    label: str
    url: str


class ChatOut(BaseModel):
    session_id: str
    reply: str
    links: list[ChatLink] = []


class ChatPublicConfig(BaseModel):
    enabled: bool
    welcome_message: str
    suggested_questions: list[str]


class ChatbotConfigIn(BaseModel):
    enabled: bool | None = None
    model: str | None = None
    welcome_message: str | None = Field(None, max_length=2000)
    suggested_questions: list[str] | None = Field(None, max_length=12)
    system_instructions: str | None = Field(None, max_length=8000)
    knowledge_base: str | None = Field(None, max_length=30000)
    max_output_tokens: int | None = Field(None, ge=64, le=4096)
    temperature: float | None = Field(None, ge=0, le=1.5)
    per_ip_hourly_limit: int | None = Field(None, ge=1, le=1000)
    per_session_message_limit: int | None = Field(None, ge=1, le=500)

    @field_validator("model")
    @classmethod
    def model_ok(cls, v):
        if v is not None and not MODEL_RE.match(v):
            raise ValueError("Model name may only contain letters, digits, '.', '_' and '-'")
        return v

    @field_validator("suggested_questions")
    @classmethod
    def q_ok(cls, v):
        if v is None:
            return v
        out = [q.strip() for q in v if q.strip()]
        if any(len(q) > 200 for q in out):
            raise ValueError("Each suggested question must be 200 characters or fewer")
        return out


class ChatbotConfigOut(BaseModel):
    enabled: bool
    model: str
    default_model: str
    welcome_message: str
    suggested_questions: list[str]
    system_instructions: str
    knowledge_base: str
    max_output_tokens: int | None
    temperature: float | None
    per_ip_hourly_limit: int
    per_session_message_limit: int
    api_key_configured: bool  # the key itself is never returned


class ChatTestIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[dict] = Field(default_factory=list, max_length=20)
    draft: ChatbotConfigIn | None = None  # unsaved settings to try before publishing


class ConversationListItem(BaseModel):
    id: uuid.UUID
    created_at: datetime
    message_count: int
    preview: str
    has_inquiry: bool


class ConversationMessage(BaseModel):
    role: str
    content: str
    created_at: datetime
