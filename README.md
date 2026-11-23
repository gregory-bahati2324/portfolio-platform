# GregTech Portfolio Platform

React + TypeScript + Tailwind frontend, FastAPI + PostgreSQL + Redis backend.

## Run with Docker
    cp .env.example .env
    docker compose up --build
Frontend http://localhost:5173, API docs http://localhost:8000/docs.

## First login
    docker compose exec backend env ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at-least-12-chars' python -m app.create_admin
Then open http://localhost:5173/admin. Re-running the command resets that account's password.

## Enable the AI assistant
Set `GEMINI_API_KEY` (from Google AI Studio) in `.env` and restart the backend. The key stays on the server; the chat button only appears for visitors when a key is set and the chatbot is enabled in Admin > AI chatbot. `GEMINI_MODEL` is the default model and can be overridden from the dashboard.

## Run tests
    cd backend && pip install -r requirements.txt && pytest
    cd frontend && npm ci && npm run typecheck && npm test && npm run build

## Status
All six phases complete. See docs/DEPLOYMENT.md, docs/OPERATIONS.md and docs/SECURITY.md. See docs/DECISIONS.md.

Seed starter structure (no projects, stats or testimonials are created): `python -m app.seed` (runs automatically in Docker).
