# Operations

## Backups
The `backup` service writes a verified PostgreSQL dump (and an archive of locally stored media) to the `backups` volume
every 24 h and deletes files older than `BACKUP_RETENTION_DAYS`. `scripts/backup.sh` refuses to keep a dump that
`pg_restore --list` cannot read. Tested here: backup, restore into an empty database with identical row counts, media
archive, retention pruning.

**Copy backups off the server.** A backup on the same disk does not protect you from losing the server. Options: set
`BACKUP_S3_URI` (needs the `aws` CLI in the image), or `rsync`/`rclone` the `backups` volume nightly. If you use
`STORAGE_BACKEND=s3`, enable versioning on the bucket instead of archiving media.

**Restore drill (do it once, now, and after major changes):**
    docker compose -f docker-compose.prod.yml exec db createdb -U $POSTGRES_USER portfolio_restore
    docker compose -f docker-compose.prod.yml run --rm -e PGDATABASE=portfolio_restore backup /scripts/restore.sh /backups/db-<timestamp>.dump
Then point `DATABASE_URL` at `portfolio_restore` for a test start, or restore into the live database after stopping
the backend. Recovery point objective is up to 24 h; run `/scripts/backup.sh` manually before risky changes.

## Monitoring
- **Liveness** `GET /api/v1/health`, **readiness** `GET /api/v1/health/ready` (checks the database). Docker uses these.
- Point a free uptime monitor (UptimeRobot, Better Stack) at `/api/v1/health/ready` and the homepage.
- Logs are JSON when `LOG_JSON=true` (set it in production): one line per request with id, path, status and duration.
  `docker compose logs -f backend`. Every response carries `X-Request-ID` to correlate reports.
- Watch for: repeated `login_failed` audit rows (dashboard > Overview > activity), 5xx counts, disk usage of the
  `pgdata`, `media` and `backups` volumes.

## Routine tasks
- **Reset admin password**: use "Forgot your password?" (needs SMTP) or `python -m app.create_admin`.
- **Rotate `SECRET_KEY`**: signs everyone out (fine for a single owner); restart the backend.
- **Rotate the Gemini key**: change `GEMINI_API_KEY`, restart the backend.
- **Delete old chatbot conversations**: dashboard > AI chatbot > Conversations > Delete older than N days.
- **Dependency updates**: CI runs `pip-audit` and `npm audit`; update monthly.

## Known limits
Analytics undercount by design (no cookies, DNT honoured). Local media storage is not shared between servers.
Animated GIFs become still images. The newsletter collects subscribers but has no send tool; export the CSV to your
mailing provider.
