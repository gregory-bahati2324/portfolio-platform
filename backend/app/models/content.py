import uuid
from datetime import date, datetime

from sqlalchemy import func, JSON, Boolean, Date, DateTime, ForeignKey, Integer, String, Table, Text, Column, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDMixin

project_skills = Table(
    "project_skills",
    Base.metadata,
    Column("project_id", Uuid, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("skill_id", Uuid, ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True),
)


class MediaAsset(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "media_assets"
    kind: Mapped[str] = mapped_column(String(16), index=True)  # image | video | document
    url: Mapped[str] = mapped_column(String(1024))
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024))
    storage_key: Mapped[str | None] = mapped_column(String(512), unique=True)
    thumb_key: Mapped[str | None] = mapped_column(String(512))
    mime_type: Mapped[str | None] = mapped_column(String(128))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    alt_text: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str | None] = mapped_column(String(64))
    original_filename: Mapped[str] = mapped_column(String(255), default="")


class Profile(UUIDMixin, TimestampMixin, Base):
    """Singleton row holding the owner's public profile."""

    __tablename__ = "profiles"
    full_name: Mapped[str] = mapped_column(String(120))
    professional_title: Mapped[str] = mapped_column(String(300), default="")
    headline: Mapped[str] = mapped_column(String(300), default="")
    hero_description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(254), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    whatsapp: Mapped[str] = mapped_column(String(40), default="")
    availability: Mapped[str] = mapped_column(String(40), default="")
    # {"introduction": "...", "philosophy": "...", ...} - keys fixed by the About page
    bio_sections: Mapped[dict] = mapped_column(JSON, default=dict)
    # [{"label": "Projects completed", "value": "12"}] - owner supplied only
    stats: Mapped[list] = mapped_column(JSON, default=list)
    photo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    cv_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    photo: Mapped[MediaAsset | None] = relationship(foreign_keys=[photo_id])
    cv: Mapped[MediaAsset | None] = relationship(foreign_keys=[cv_id])


class SiteSettings(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "site_settings"
    site_title: Mapped[str] = mapped_column(String(200), default="")
    meta_description: Mapped[str] = mapped_column(String(320), default="")
    primary_color: Mapped[str] = mapped_column(String(7), default="#2563EB")
    footer_text: Mapped[str] = mapped_column(String(500), default="")
    show_proficiency: Mapped[bool] = mapped_column(Boolean, default=False)
    logo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))


class SocialLink(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "social_links"
    platform: Mapped[str] = mapped_column(String(40))
    url: Mapped[str] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)


class SkillCategory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "skill_categories"
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    icon: Mapped[str] = mapped_column(String(40), default="code")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    skills: Mapped[list["Skill"]] = relationship(back_populates="category", order_by="Skill.sort_order", cascade="all, delete-orphan")


class Skill(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "skills"
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skill_categories.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    technologies: Mapped[list] = mapped_column(JSON, default=list)
    proficiency: Mapped[int | None] = mapped_column(Integer)  # 0-100, optional, shown only if enabled
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    category: Mapped[SkillCategory] = relationship(back_populates="skills")
    projects: Mapped[list["Project"]] = relationship(secondary=project_skills, back_populates="skills")


class Service(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "services"
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    problems_solved: Mapped[list] = mapped_column(JSON, default=list)
    deliverables: Mapped[list] = mapped_column(JSON, default=list)
    technologies: Mapped[list] = mapped_column(JSON, default=list)
    icon: Mapped[str] = mapped_column(String(40), default="code")
    cta_label: Mapped[str] = mapped_column(String(80), default="Request a quote")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    projects: Mapped[list["Project"]] = relationship(back_populates="service")


class ProjectCategory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "project_categories"
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Project(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    short_description: Mapped[str] = mapped_column(String(500), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    problem: Mapped[str] = mapped_column(Text, default="")
    solution: Mapped[str] = mapped_column(Text, default="")
    architecture: Mapped[str] = mapped_column(Text, default="")
    how_it_works: Mapped[str] = mapped_column(Text, default="")
    challenges: Mapped[str] = mapped_column(Text, default="")
    results: Mapped[str] = mapped_column(Text, default="")
    technologies: Mapped[list] = mapped_column(JSON, default=list)
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("project_categories.id", ondelete="SET NULL"), index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"))
    main_image_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    github_url: Mapped[str] = mapped_column(String(500), default="")
    live_url: Mapped[str] = mapped_column(String(500), default="")
    docs_url: Mapped[str] = mapped_column(String(500), default="")
    completed_on: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(24), default="in_progress")  # completed | in_progress | prototype | research
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped[ProjectCategory | None] = relationship()
    service: Mapped[Service | None] = relationship(back_populates="projects")
    main_image: Mapped[MediaAsset | None] = relationship(foreign_keys=[main_image_id])
    skills: Mapped[list[Skill]] = relationship(secondary=project_skills, back_populates="projects")
    media: Mapped[list["ProjectMedia"]] = relationship(back_populates="project", order_by="ProjectMedia.sort_order", cascade="all, delete-orphan")


class ProjectMedia(UUIDMixin, Base):
    __tablename__ = "project_media"
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    media_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_assets.id", ondelete="RESTRICT"))
    caption: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    project: Mapped[Project] = relationship(back_populates="media")
    asset: Mapped[MediaAsset] = relationship()


class CustomerInquiry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "customer_inquiries"
    reference: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(200), default="")
    service_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"))
    message: Mapped[str] = mapped_column(Text)
    budget_range: Mapped[str] = mapped_column(String(80), default="")
    timeline: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(24), default="new", index=True)
    source: Mapped[str] = mapped_column(String(24), default="contact_form")
    follow_up_on: Mapped[date | None] = mapped_column(Date)


DEFAULT_WELCOME = (
    "Hello! Welcome to Gregory Bahati's portfolio. I'm Gregory's AI assistant. I can help you explore his projects, "
    "understand his technical expertise, and discover how he can help you build your next solution. What would you like to know?"
)
DEFAULT_QUESTIONS = [
    "Who is Gregory Bahati?", "What technologies does Gregory work with?", "Can you show me his AI projects?",
    "Can Gregory develop a business management system?", "Does Gregory offer AI integration?",
    "How can I hire Gregory?", "Can I discuss a project with him?",
]


class ChatbotConfiguration(UUIDMixin, TimestampMixin, Base):
    """Singleton. The API key is NEVER stored here; it lives only in the GEMINI_API_KEY env var."""

    __tablename__ = "chatbot_configurations"
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    model: Mapped[str] = mapped_column(String(80), default="")  # empty -> GEMINI_MODEL env default
    welcome_message: Mapped[str] = mapped_column(Text, default=DEFAULT_WELCOME)
    suggested_questions: Mapped[list] = mapped_column(JSON, default=lambda: list(DEFAULT_QUESTIONS))
    system_instructions: Mapped[str] = mapped_column(Text, default="")  # owner additions to the master prompt
    knowledge_base: Mapped[str] = mapped_column(Text, default="")
    max_output_tokens: Mapped[int | None] = mapped_column(Integer)
    temperature: Mapped[float | None] = mapped_column()
    per_ip_hourly_limit: Mapped[int] = mapped_column(Integer, default=30)
    per_session_message_limit: Mapped[int] = mapped_column(Integer, default=40)


class ChatConversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chat_conversations"
    session_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), default="")
    message_count: Mapped[int] = mapped_column(Integer, default=0)  # visitor messages answered
    inquiry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customer_inquiries.id", ondelete="SET NULL"))
    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="conversation", order_by="ChatMessage.created_at", cascade="all, delete-orphan")


class ChatMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "chat_messages"
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    conversation: Mapped[ChatConversation] = relationship(back_populates="messages")


class ArticleCategory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "article_categories"
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Article(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "articles"
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    title: Mapped[str] = mapped_column(String(220))
    excerpt: Mapped[str] = mapped_column(String(500), default="")
    content: Mapped[str] = mapped_column(Text, default="")  # Markdown
    cover_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    category_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("article_categories.id", ondelete="SET NULL"))
    tags: Mapped[list] = mapped_column(JSON, default=list)
    seo_description: Mapped[str] = mapped_column(String(320), default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    cover: Mapped[MediaAsset | None] = relationship(foreign_keys=[cover_id])
    category: Mapped[ArticleCategory | None] = relationship()


class Testimonial(UUIDMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Entered and approved by the owner only. Nothing is generated or shown until approved."""

    __tablename__ = "testimonials"
    author_name: Mapped[str] = mapped_column(String(120))
    author_role: Mapped[str] = mapped_column(String(160), default="")
    company: Mapped[str] = mapped_column(String(160), default="")
    quote: Mapped[str] = mapped_column(Text)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class NewsletterSubscriber(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "newsletter_subscribers"
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unsubscribed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InquiryNote(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "inquiry_notes"
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("customer_inquiries.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(Text)


class VisitorEvent(UUIDMixin, Base):
    """Privacy-friendly analytics: no cookies, no raw IPs. visitor_hash rotates daily."""

    __tablename__ = "visitor_events"
    event_type: Mapped[str] = mapped_column(String(16), index=True)  # page_view | project_view
    path: Mapped[str] = mapped_column(String(300))
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    visitor_hash: Mapped[str] = mapped_column(String(64))
    referrer_host: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
