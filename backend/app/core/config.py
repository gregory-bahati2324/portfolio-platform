from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "GregTech Portfolio API"
    environment: str = "development"  # development | production | test
    log_level: str = "INFO"
    log_json: bool = False

    database_url: str = "postgresql+psycopg://portfolio:portfolio@db:5432/portfolio"
    redis_url: str = "redis://redis:6379/0"
    rate_limit_backend: str = "memory"  # memory | redis (use redis in production)

    allowed_hosts: list[str] = Field(default_factory=lambda: ["*"])  # e.g. ["gregtech.example","www.gregtech.example"]
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # Auth (Phase 3)
    secret_key: str = "change-me"
    access_token_minutes: int = 60
    cookie_secure: bool = False

    # Gemini (Phase 4) - server-side only
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_max_output_tokens: int = 800
    gemini_temperature: float = 0.4
    gemini_timeout_seconds: int = 40
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"  # override for a proxy or a local test double

    # Media storage
    storage_backend: str = "local"  # local | s3
    local_media_dir: str = "./media"
    max_image_mb: int = 10
    max_video_mb: int = 200
    max_document_mb: int = 20
    s3_bucket: str = ""
    s3_endpoint_url: str = ""  # Cloudflare R2: https://<account>.r2.cloudflarestorage.com
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_base_url: str = ""  # public/CDN URL prefix for stored objects
    s3_region: str = "eu-west-1"

    public_site_url: str = "http://localhost:5173"  # canonical origin for sitemap, links and emails

    # Notifications (optional). Failures never lose an inquiry.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notify_email_to: str = ""
    notify_email_from: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production:
        problems = []
        if s.secret_key == "change-me" or len(s.secret_key) < 32:
            problems.append("SECRET_KEY must be a random string of at least 32 characters")
        if not s.cookie_secure:
            problems.append("COOKIE_SECURE must be true")
        if not s.public_site_url.startswith("https://"):
            problems.append("PUBLIC_SITE_URL must be an https:// URL")
        if "*" in s.cors_origins or not s.cors_origins:
            problems.append("CORS_ORIGINS must list explicit origins (no '*')")
        if s.allowed_hosts == ["*"]:
            problems.append("ALLOWED_HOSTS must list your domain(s)")
        if s.rate_limit_backend != "redis":
            problems.append("RATE_LIMIT_BACKEND should be 'redis' so limits are shared across workers")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))
    return s
