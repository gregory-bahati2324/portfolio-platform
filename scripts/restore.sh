#!/bin/sh
# Restore a backup INTO AN EMPTY DATABASE (create one first: createdb portfolio_restore).
# Usage: PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=portfolio_restore ./restore.sh /backups/db-XXXX.dump
set -eu
[ $# -eq 1 ] || { echo "usage: $0 <dump-file>"; exit 2; }
pg_restore --list "$1" >/dev/null
pg_restore --no-owner --exit-on-error --dbname="$PGDATABASE" "$1"
echo "restored $1 into $PGDATABASE. Point DATABASE_URL at it and run 'alembic current' to confirm the schema version."
