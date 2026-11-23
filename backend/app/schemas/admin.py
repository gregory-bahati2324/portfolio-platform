import re
import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _http_url(v: str) -> str:
    v = v.strip()
    if v and not re.match(r"^https?://[^\s<>\"']+$", v, re.I):
        raise ValueError("Must be a valid http(s) URL")
    return v


Url = Annotated[str, Field(max_length=500), AfterValidator(_http_url)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=12, max_length=256)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=12, max_length=256)


class AdminOut(ORM):
    id: uuid.UUID
    email: str
    role: str


class StatIn(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=40)


class ProfileIn(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=120)
    professional_title: str | None = Field(None, max_length=300)
    headline: str | None = Field(None, max_length=300)
    hero_description: str | None = Field(None, max_length=2000)
    location: str | None = Field(None, max_length=200)
    email: str | None = Field(None, max_length=254)
    phone: str | None = Field(None, max_length=40)
    whatsapp: str | None = Field(None, max_length=40)
    availability: str | None = Field(None, max_length=40)
    bio_sections: dict[str, Annotated[str, Field(max_length=10000)]] | None = None
    stats: list[StatIn] | None = Field(None, max_length=8)
    photo_id: uuid.UUID | None = None
    cv_id: uuid.UUID | None = None


class ProfileAdminOut(ORM):
    full_name: str
    professional_title: str
    headline: str
    hero_description: str
    location: str
    email: str
    phone: str
    whatsapp: str
    availability: str
    bio_sections: dict
    stats: list
    photo_id: uuid.UUID | None
    cv_id: uuid.UUID | None


class SiteIn(BaseModel):
    site_title: str | None = Field(None, max_length=200)
    meta_description: str | None = Field(None, max_length=320)
    primary_color: str | None = None
    footer_text: str | None = Field(None, max_length=500)
    show_proficiency: bool | None = None
    logo_id: uuid.UUID | None = None


class SiteAdminOut(ORM):
    site_title: str
    meta_description: str
    primary_color: str
    footer_text: str
    show_proficiency: bool
    logo_id: uuid.UUID | None


class SocialIn(BaseModel):
    platform: str = Field(min_length=1, max_length=40)
    url: Url = Field(min_length=1)
    sort_order: int = 0
    visible: bool = True


class SocialOut(SocialIn, ORM):
    id: uuid.UUID


class SkillCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    icon: str = Field(default="code", max_length=40)
    sort_order: int = 0
    visible: bool = True


class SkillCategoryOut(SkillCategoryIn, ORM):
    id: uuid.UUID
    slug: str


class SkillIn(BaseModel):
    category_id: uuid.UUID
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    technologies: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=30)
    proficiency: int | None = Field(None, ge=0, le=100)
    sort_order: int = 0
    visible: bool = True


class SkillOut(SkillIn, ORM):
    id: uuid.UUID


class ServiceIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(None, max_length=140)
    summary: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=10000)
    problems_solved: list[Annotated[str, Field(max_length=300)]] = Field(default_factory=list, max_length=20)
    deliverables: list[Annotated[str, Field(max_length=300)]] = Field(default_factory=list, max_length=20)
    technologies: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=30)
    icon: str = Field(default="code", max_length=40)
    cta_label: str = Field(default="Request a quote", max_length=80)
    sort_order: int = 0
    visible: bool = True


class ServiceOut(ServiceIn, ORM):
    id: uuid.UUID
    slug: str


class ProjectCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class ProjectCategoryOut(ProjectCategoryIn, ORM):
    id: uuid.UUID
    slug: str


class ProjectMediaIn(BaseModel):
    media_id: uuid.UUID
    caption: str = Field(default="", max_length=300)


class ProjectIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(None, max_length=160)
    short_description: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=20000)
    problem: str = Field(default="", max_length=10000)
    solution: str = Field(default="", max_length=10000)
    architecture: str = Field(default="", max_length=10000)
    how_it_works: str = Field(default="", max_length=10000)
    challenges: str = Field(default="", max_length=10000)
    results: str = Field(default="", max_length=10000)
    technologies: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=40)
    category_id: uuid.UUID | None = None
    service_id: uuid.UUID | None = None
    main_image_id: uuid.UUID | None = None
    github_url: Url = ""
    live_url: Url = ""
    docs_url: Url = ""
    completed_on: date | None = None
    status: str = Field(default="in_progress", pattern="^(completed|in_progress|prototype|research)$")
    is_featured: bool = False
    skill_ids: list[uuid.UUID] = Field(default_factory=list, max_length=60)
    media: list[ProjectMediaIn] = Field(default_factory=list, max_length=60)  # order = display order


class ProjectMediaOut(BaseModel):
    media_id: uuid.UUID
    caption: str
    kind: str
    url: str
    thumbnail_url: str | None


class ProjectAdminOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    short_description: str
    status: str
    is_published: bool
    is_featured: bool
    sort_order: int
    category_id: uuid.UUID | None
    service_id: uuid.UUID | None
    main_image_id: uuid.UUID | None
    description: str = ""
    problem: str = ""
    solution: str = ""
    architecture: str = ""
    how_it_works: str = ""
    challenges: str = ""
    results: str = ""
    technologies: list[str] = []
    github_url: str = ""
    live_url: str = ""
    docs_url: str = ""
    completed_on: date | None = None
    skill_ids: list[uuid.UUID] = []
    media: list[ProjectMediaOut] = []
    updated_at: datetime | None = None


class PublishIn(BaseModel):
    published: bool


class ReorderIn(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=500)


class MediaOut(ORM):
    id: uuid.UUID
    kind: str
    url: str
    thumbnail_url: str | None
    mime_type: str | None
    size_bytes: int | None
    alt_text: str
    description: str
    category: str | None
    original_filename: str
    created_at: datetime
    in_use: bool = False


class MediaUpdate(BaseModel):
    alt_text: str | None = Field(None, max_length=300)
    description: str | None = Field(None, max_length=2000)
    category: str | None = Field(None, max_length=64)


class InquiryAdminOut(ORM):
    id: uuid.UUID
    reference: str
    name: str
    email: str
    phone: str
    company: str
    message: str
    budget_range: str
    timeline: str
    status: str
    source: str
    service_id: uuid.UUID | None
    follow_up_on: date | None = None
    created_at: datetime


class InquiryStatusIn(BaseModel):
    status: str = Field(pattern="^(new|reviewing|contacted|discussion|proposal_sent|converted|closed)$")
