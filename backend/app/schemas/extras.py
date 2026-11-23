import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.public import MediaOut


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ArticleCardOut(BaseModel):
    slug: str
    title: str
    excerpt: str
    tags: list[str]
    published_at: datetime | None
    category_name: str | None = None
    category_slug: str | None = None
    cover: MediaOut | None = None
    reading_minutes: int = 1


class ArticleDetailOut(ArticleCardOut):
    content: str
    seo_description: str


class ArticlePage(BaseModel):
    items: list[ArticleCardOut]
    total: int
    page: int
    page_size: int


class CategoryOut(ORM):
    name: str
    slug: str


class TestimonialOut(ORM):
    id: uuid.UUID
    author_name: str
    author_role: str
    company: str
    quote: str


class SubscribeIn(BaseModel):
    email: EmailStr
    website: str = Field(default="", max_length=200)  # honeypot


class EventIn(BaseModel):
    type: str = Field(pattern="^(page_view|project_view)$")
    path: str = Field(min_length=1, max_length=300, pattern=r"^/[^\s?#]*$")
    slug: str | None = Field(None, max_length=160)
    referrer: str | None = Field(None, max_length=500)


# ---- admin -------------------------------------------------------------------
Tag = Annotated[str, Field(min_length=1, max_length=40)]


class ArticleIn(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    slug: str | None = Field(None, max_length=180)
    excerpt: str = Field(default="", max_length=500)
    content: str = Field(default="", max_length=100000)
    cover_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    tags: list[Tag] = Field(default_factory=list, max_length=12)
    seo_description: str = Field(default="", max_length=320)
    published_at: datetime | None = None  # future date = scheduled


class ArticleAdminOut(ORM):
    id: uuid.UUID
    slug: str
    title: str
    excerpt: str
    content: str
    cover_id: uuid.UUID | None
    category_id: uuid.UUID | None
    tags: list[str]
    seo_description: str
    is_published: bool
    published_at: datetime | None
    updated_at: datetime


class ArticleCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = 0


class ArticleCategoryOut(ArticleCategoryIn, ORM):
    id: uuid.UUID
    slug: str


class TestimonialIn(BaseModel):
    author_name: str = Field(min_length=1, max_length=120)
    author_role: str = Field(default="", max_length=160)
    company: str = Field(default="", max_length=160)
    quote: str = Field(min_length=10, max_length=3000)
    sort_order: int = 0


class TestimonialAdminOut(TestimonialIn, ORM):
    id: uuid.UUID
    is_approved: bool


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class NoteOut(ORM):
    id: uuid.UUID
    body: str
    created_at: datetime


class FollowUpIn(BaseModel):
    follow_up_on: date | None = None


class SubscriberOut(ORM):
    id: uuid.UUID
    email: str
    confirmed_at: datetime | None
    unsubscribed_at: datetime | None
    created_at: datetime
