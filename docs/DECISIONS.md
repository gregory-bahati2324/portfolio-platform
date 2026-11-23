# Architecture decisions

- **Monorepo**, one Vite React app; `/admin/*` routes are lazy-loaded into a separate chunk.
- **Modular monolith** FastAPI: routers -> services -> repositories. No microservices.
- **Sync SQLAlchemy 2.0** with psycopg; Alembic for all schema changes (baseline `0001` is empty on purpose).
- **Errors** share one shape: `{"error": {"code", "message", "details?"}}`.
- **Config** only through environment variables (`app/core/config.py`); production refuses the default `SECRET_KEY`.
- **Docs** (`/docs`, `/openapi.json`) are disabled when `ENVIRONMENT=production`.
- **Brand color** is a CSS variable (`--brand`) so Site Settings can change it at runtime (Phase 3).
- Later phases: auth cookies + CSRF (3), `StorageBackend` and presigned video upload (3), `LLMProvider`/Gemini (4).

## Phase 2
- Public API is read-only except `POST /inquiries`; only `is_published` and not soft-deleted projects, and visible skills/services, are returned.
- Inquiries are committed to the database before anything else happens, so a future notifier failure cannot lose one. Spam control: hidden honeypot field plus an in-process rate limit (5/hour/IP), to be replaced by Redis before multi-worker deployment.
- Seed data contains only text from the brief (hero copy, skill names, service outlines, project categories). It never creates projects, statistics, proficiency ratings or testimonials.
- Skill proficiency is stored but only displayed when `site_settings.show_proficiency` is true.
- Empty states are explicit on every public page; About sections and stats render only when the owner has filled them in.
- Brand color is read from site settings at runtime and applied as the `--brand` CSS variable.

## Phase 3
- **Auth:** Argon2 hashes; JWT in an HTTP-only, SameSite=Lax cookie (Secure when `COOKIE_SECURE=true`); CSRF via double-submit cookie (`csrf_token` cookie must equal the `X-CSRF-Token` header on every unsafe admin request). Unknown-email logins verify against a dummy hash so timing does not reveal accounts. Login is limited to 10 attempts per 15 minutes per IP.
- **Authorization:** every `/api/v1/admin/*` route requires a valid session and CSRF; inactive users are rejected immediately. Roles exist (`owner`, `editor`); only `owner` is created today.
- **Audit log:** login success and failure, password change, profile/settings/service/project changes, publish and unpublish, deletes and media operations are written in the same transaction as the change.
- **URLs** typed by the owner (social, GitHub, live, docs) must be http(s); `javascript:` and similar are rejected server-side because they are rendered as links publicly.
- **Media:** type is decided from file content, never filename or client MIME. Allowed: JPEG, PNG, WebP, GIF (re-encoded to WebP, max 2000 px, metadata stripped, 480 px thumbnail), MP4, WebM, PDF. SVG and everything else are refused. Size limits are configurable. Storage keys are random UUIDs. Deleting media that is still referenced returns 409.
- **Storage:** `StorageBackend` with `LocalStorage` (served from `/media`) and `S3Storage` (R2/S3, includes presigned PUT for large videos). S3 is implemented but not tested against a real bucket.
- **Projects** are always created as drafts; publishing requires a short description; drafts can be previewed by the admin; delete is a soft delete.
- **Notifications:** inquiry is committed first, then an SMTP email is attempted in a background task; failure is logged and never affects the stored inquiry.
- **Known limits:** animated GIFs become still WebP; login rate limiting is per-process; no password-reset-by-email yet (use `python -m app.create_admin` to reset).

## Phase 4
- **Provider abstraction:** `app/integrations/llm.py` defines `LLMProvider`/`LLMError`; `GeminiProvider` talks to the Gemini REST API with `httpx`. The API key is sent in a header only (never in a URL, log line or response). Model names are validated (`[A-Za-z0-9._-]`) because they become part of the request path. Add another provider by implementing `generate`.
- **Model is configurable** three ways: `GEMINI_MODEL` env default, a per-dashboard override, and a draft override in the test panel. Max tokens, temperature and timeout also come from env and can be overridden in the dashboard.
- **Grounding:** each request builds SITE DATA from the database: public profile fields, visible services and skills, published non-deleted projects with their real status. Drafts, hidden skills and soft-deleted items never enter the prompt. The master prompt from the brief is used as written, plus owner additions and a security block that always comes last.
- **Context:** conversation history is stored and replayed server-side (last 10 messages). The browser holds only a random session id, so clients cannot forge assistant turns.
- **Prompt injection and leakage:** visitor text is length-capped, stripped of control characters and delimiter tags, and wrapped in `<visitor_message>`. Replies are post-processed: any link or URL not supplied by the application is removed; replies containing a per-process canary or an 8-word run from the instruction text are replaced by a refusal. This reduces risk but is not a guarantee against every attack, so the assistant has no tools and no access to private data.
- **No fake submissions:** the assistant cannot create inquiries. The widget's contact form posts to the normal inquiry endpoint; the chat only shows a reference after the backend returns one. Chat-originated inquiries are linked to the conversation and counted.
- **Limits:** 4 messages per 10 s and a configurable hourly limit per IP (IP stored only as a salted hash), a configurable per-conversation cap, 1000 characters per message, and a separate limit on the admin test endpoint. In-process for now; Redis is planned for Phase 6.
- **Failures:** timeouts, quota, auth, safety blocks and malformed responses map to typed errors; visitors see a friendly message pointing to the contact form and failed turns are not stored.
- **Privacy:** conversations are stored so the owner can review leads; the widget says so. The dashboard can delete conversations older than N days.

## Phase 5
- **Articles:** Markdown content rendered by a custom renderer that never uses `innerHTML`; raw HTML, `javascript:` links and non-`/media`/non-HTTPS images are dropped (covered by tests, including a hostile-input termination test that caught a real infinite loop). Drafts, scheduled (future `published_at`) and deleted articles are never public.
- **Testimonials:** entered by the owner only (no public submission, nothing generated), created unapproved, and editing the text withdraws approval.
- **CV:** uploaded through the Profile page (PDF in the media library); the Home hero and About page show "Download CV" only when one exists.
- **Analytics:** first-party, cookie-free. A visitor id is a SHA-256 of secret + date + IP + user agent, so it rotates daily and no raw IP is stored. Do Not Track and Global Privacy Control are honoured (client and server), bots and `/admin` are ignored, unpublished projects are not counted. "Visits" = unique visitors per day, summed. Figures are intentionally conservative.
- **SEO:** `/sitemap.xml` and `/robots.txt` come from the backend (`PUBLIC_SITE_URL` sets the origin). Because the site is a SPA, `/_meta?path=` returns real title, description, canonical, Open Graph and JSON-LD for link-preview bots; `nginx.conf` routes known crawler user agents there. Googlebot-style crawlers also see the same tags set client-side. All values are HTML-escaped and JSON-LD escapes `<`.
- **Newsletter:** double opt-in. Subscribe always returns the same message (no subscriber enumeration); confirmation and unsubscribe are POSTs so email scanners that prefetch links cannot confirm or unsubscribe anyone. The CSV export contains confirmed, active addresses only. Without SMTP configured, sign-ups stay pending.
- **Inquiry notes** are private to the admin; follow-up dates are stored per inquiry.
