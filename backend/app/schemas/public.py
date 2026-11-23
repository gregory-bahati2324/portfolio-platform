import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MediaOut(ORM):
    id: uuid.UUID
    kind: str
    url: str
    thumbnail_url: str | None = None
    alt_text: str = ""
    description: str = ""


class StatOut(BaseModel):
    label: str
    value: str


class ProfileOut(ORM):
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
    stats: list[StatOut]
    photo: MediaOut | None = None
    cv: MediaOut | None = None


class SocialLinkOut(ORM):
    platform: str
    url: str


class SiteOut(BaseModel):
    site_title: str
    meta_description: str
    primary_color: str
    footer_text: str
    show_proficiency: bool
    logo: MediaOut | None = None
    social_links: list[SocialLinkOut]


class SkillOut(ORM):
    id: uuid.UUID
    name: str
    description: str
    technologies: list[str]
    proficiency: int | None = None


class SkillCategoryOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    description: str
    icon: str
    skills: list[SkillOut]


class ProjectCardOut(ORM):
    slug: str
    title: str
    short_description: str
    technologies: list[str]
    status: str
    is_featured: bool
    completed_on: date | None = None
    category_name: str | None = None
    category_slug: str | None = None
    main_image: MediaOut | None = None


class ServiceOut(ORM):
    slug: str
    title: str
    summary: str
    description: str
    problems_solved: list[str]
    deliverables: list[str]
    technologies: list[str]
    icon: str
    cta_label: str


class ServiceDetailOut(ServiceOut):
    projects: list[ProjectCardOut] = []


class ProjectMediaOut(BaseModel):
    caption: str
    asset: MediaOut


class ProjectDetailOut(ProjectCardOut):
    description: str
    problem: str
    solution: str
    architecture: str
    how_it_works: str
    challenges: str
    results: str
    github_url: str
    live_url: str
    docs_url: str
    service_slug: str | None = None
    service_title: str | None = None
    skills: list[str] = []
    media: list[ProjectMediaOut] = []


class ProjectCategoryOut(ORM):
    name: str
    slug: str


class Page(BaseModel):
    items: list[ProjectCardOut]
    total: int
    page: int
    page_size: int


class InquiryIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(default="", max_length=40)
    company: str = Field(default="", max_length=200)
    service_slug: str | None = Field(default=None, max_length=140)
    message: str = Field(min_length=10, max_length=5000)
    budget_range: str = Field(default="", max_length=80)
    timeline: str = Field(default="", max_length=80)
    website: str = Field(default="", max_length=200)  # honeypot: must stay empty
    chat_session_id: str | None = Field(default=None, max_length=64, pattern=r"^[a-f0-9]{32}$")

    @field_validator("name", "message", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class InquiryOut(BaseModel):
    reference: str
    message: str = "Thank you. Your inquiry has been received."
