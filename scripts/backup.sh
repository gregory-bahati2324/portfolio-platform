#!/bin/sh
# Daily PostgreSQL backup (+ local media archive if MEDIA_DIR is set).
# Env: PGHOST PGUSER PGPASSWORD PGDATABASE, BACKUP_DIR (default /backups), RETENTION_DAYS (default 14),
#      MEDIA_DIR (optional), BACKUP_S3_URI (optional, needs the aws CLI).
set -eu
DIR="${BACKUP_DIR:-/backups}"; KEEP="${RETENTION_DAYS:-14}"; TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DIR"
DUMP="$DIR/db-$TS.dump"
pg_dump --format=custom --no-owner --file="$DUMP.partial"
pg_restore --list "$DUMP.partial" >/dev/null   # refuse to keep an unreadable archive
mv "$DUMP.partial" "$DUMP"
echo "database backup written: $DUMP ($(wc -c < "$DUMP") bytes)"
if [ -n "${MEDIA_DIR:-}" ] && [ -d "$MEDIA_DIR" ]; then
  tar -czf "$DIR/media-$TS.tar.gz" -C "$MEDIA_DIR" .
  echo "media archive written: $DIR/media-$TS.tar.gz"
fi
if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$DUMP" "$BACKUP_S3_URI/" ${AWS_ENDPOINT_URL:+--endpoint-url "$AWS_ENDPOINT_URL"}
fi
find "$DIR" -type f \( -name 'db-*.dump' -o -name 'media-*.tar.gz' \) -mtime +"$KEEP" -delete
