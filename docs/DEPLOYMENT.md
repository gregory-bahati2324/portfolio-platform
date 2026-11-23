# Deployment (single VPS with Docker)

Tested here: the application code, migrations, production-mode startup (gunicorn, PostgreSQL, Redis), the nginx
config, backup/restore and the Caddyfile syntax. **Not tested here:** the Docker images themselves (Docker was not
available) and real TLS issuance, so do the smoke test at the end on your server.

## 1. Server
Any Linux VPS with Docker + the Compose plugin, ports 80/443 open, and a DNS **A record** for your domain (and `www`).

## 2. Configure
    git clone <your repo> portfolio && cd portfolio
    cp .env.example .env
Edit `.env`. These are required in production and the API **refuses to start** if they are unsafe:

| Variable | Value |
|---|---|
| `SECRET_KEY` | random, 32+ chars: `python3 -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `COOKIE_SECURE` | `true` |
| `PUBLIC_SITE_URL` | `https://your-domain` |
| `CORS_ORIGINS` | `["https://your-domain"]` |
| `ALLOWED_HOSTS` | `["your-domain","www.your-domain"]` |
| `DOMAIN` | `your-domain` (used by Caddy for HTTPS) |
| `POSTGRES_*`, `REDIS_PASSWORD` | strong unique passwords |
| `GEMINI_API_KEY` | from Google AI Studio (server-side only) |
| `SMTP_*`, `NOTIFY_EMAIL_TO` | needed for inquiry alerts, password reset and newsletter confirmation |
| `STORAGE_BACKEND` | `local` (Docker volume) or `s3` (Cloudflare R2: set `S3_*`) |

## 3. Start
    docker compose -f docker-compose.prod.yml --env-file .env up -d --build
    docker compose -f docker-compose.prod.yml exec backend env ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-passphrase' python -m app.create_admin
Migrations and starter content are applied automatically on every backend start. Only Caddy publishes ports; the
database, Redis and API are on the internal network only.

## 4. Smoke test (do this once)
1. `https://your-domain` loads with a valid certificate; `https://your-domain/admin` signs in.
2. `https://your-domain/api/v1/health/ready` returns `{"status":"ok","database":"up"}`.
3. Upload an image in the Media library, attach it to a draft project, preview, publish; it appears publicly.
4. Submit the contact form: a reference appears, the inquiry is in the dashboard, and (with SMTP) an email arrives.
5. Share a project link on WhatsApp/LinkedIn: the preview shows the title and image.
6. `https://your-domain/sitemap.xml` and `/robots.txt` load. Submit the sitemap in Google Search Console.
7. Ask the chatbot a question (needs `GEMINI_API_KEY`).

## 5. Updating
    git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build
Take a backup first (see OPERATIONS.md). Migrations run automatically; to roll back run `alembic downgrade -1` in the backend container.

## Scaling notes
The API is stateless (sessions are signed cookies, rate limits live in Redis), so you can raise `WEB_CONCURRENCY`
or run more backend replicas. Put Cloudflare (or any CDN) in front of Caddy to absorb traffic; public JSON is sent
with `Cache-Control: public, max-age=0, s-maxage=15`, so a CDN may cache it for 15 s while browsers always
revalidate (your dashboard edits show immediately in your own browser). Use `STORAGE_BACKEND=s3` before running more than one
server so uploads are shared.
