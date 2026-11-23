# Browser end-to-end test

`e2e.mjs` drives a real headless Chromium through the whole product: public pages, admin sign-in/out, media upload,
creating and publishing a project, contact form, chatbot, newsletter, mobile layouts, keyboard focus order and an
axe-core WCAG A/AA scan. It also fails on any console error, CSP violation or failed request.
`fake_gemini.py` is a local stand-in for the Gemini API (set `GEMINI_API_BASE=http://127.0.0.1:9099`) so the chat
flow can be tested without a real key; it returns a project link, a phishing link and a prompt-leak attempt on demand.

Last result: **72 / 72 checks passed** against production nginx config + gunicorn + PostgreSQL + Redis.

Run (paths are fixed to /tmp because it was run in a sandbox; adjust if needed):
1. Empty PostgreSQL database; `alembic upgrade head`; `python -m app.seed`; create admin `owner@example.com` /
   `e2e-long-passphrase-123` with `python -m app.create_admin`.
2. `python e2e/fake_gemini.py &`, start the API on :8000 with `GEMINI_API_KEY=fake-e2e-key GEMINI_API_BASE=http://127.0.0.1:9099`.
3. Build the frontend and serve it with `frontend/nginx.conf` on :8081 (the `backend` host must resolve to the API).
4. `cd e2e && npm install && node e2e.mjs` (needs the usual Chromium system libraries).
Use a throw-away database: the test creates content and an admin session.
