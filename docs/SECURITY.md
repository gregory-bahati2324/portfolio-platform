# Security overview

What is implemented and how it was checked (automated tests unless noted).

| Area | Implementation | Verified by |
|---|---|---|
| Passwords | Argon2; 12+ character minimum; timing-safe login for unknown emails | tests |
| Sessions | JWT in `HttpOnly` + `Secure` + `SameSite=Lax` cookie; 60 min; revoked on password change/reset | tests |
| CSRF | double-submit token required on every unsafe admin request | tests |
| Brute force | login 10/15 min per IP; reset/forgot/inquiry/chat/newsletter/analytics all limited; Redis-backed and shared across workers | tests + live 2-worker run |
| Password reset | single-use, 30 min, stored hashed, identical response for unknown emails, signs out all sessions | tests |
| Authorization | every `/admin` route needs a valid session; roles stored; audit log on sensitive actions | tests |
| Input | Pydantic validation on every body; SQLAlchemy parameters (no string SQL); injection strings fuzzed; NUL bytes handled | tests (SQLite and PostgreSQL) |
| Uploads | type from file content, allow-list, size limits, re-encoded images, random names, SVG refused | tests |
| XSS | no `innerHTML`; custom Markdown renderer drops raw HTML and unsafe URLs; owner URLs must be http(s); SEO tags HTML-escaped | tests |
| Headers | CSP, HSTS (production), nosniff, frame deny, referrer policy; `no-store` on admin/auth | tests + real nginx |
| Config | production refuses weak `SECRET_KEY`, insecure cookies, wildcard CORS/hosts, in-memory rate limiting | tests + live boot |
| Chatbot | key server-side only; grounded in public data; delimited visitor text; unknown links stripped; prompt-leak filter; no tools | tests (simulated model) |
| Privacy | analytics cookie-free, daily-rotating anonymous hash, DNT/GPC honoured; chat history deletable | tests |
| Dependencies | `pip-audit` and `npm audit` both report 0 known vulnerabilities (CI repeats this) | audit run |
| Static analysis | `bandit` (no medium+ findings) and `ruff` security rules clean | run |

## Real-browser verification
`e2e/` drives headless Chromium against the production nginx config (including its CSP) and reports no console errors,
CSP violations or failed requests on any page, an httpOnly session cookie, no horizontal scrolling at 375 px, and no
serious/critical axe-core WCAG A/AA violations on 7 pages. This run also found and fixed: a blank project page caused by a
React effect cleanup, stale lists caused by browser-side caching, a Sign out button that did not leave the dashboard, and
a needless session check (401) on every public page.

## Not covered / your responsibility
- No independent penetration test. The chatbot's prompt-injection defences reduce risk but cannot make an LLM
  perfectly obedient; its safety rests mainly on having no tools and no private data.
- The Docker images, TLS issuance and server hardening (SSH keys, firewall, OS updates) were not tested here.
- Single-factor admin login. Use a long unique passphrase; consider putting `/admin` behind Cloudflare Access or a VPN.
- `Server: uvicorn` appears on direct API responses; nginx replaces it for public traffic.
