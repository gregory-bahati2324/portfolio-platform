#!/bin/sh
# Applies migrations and idempotent starter data, then starts the API.
set -e
alembic upgrade head
python -m app.seed
exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "${WEB_CONCURRENCY:-2}" \
  --bind 0.0.0.0:8000 \
  --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}" \
  --timeout 60 --graceful-timeout 30 --keep-alive 5 --no-control-socket \
  --access-logfile - --error-logfile -
