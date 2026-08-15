#!/bin/sh
set -eu
FILE=${1:-}
if [ -z "$FILE" ]; then
  echo "Usage: ./scripts/restore.sh backups/pos_YYYYMMDD_HHMMSS.dump"
  exit 1
fi
cat "$FILE" | docker compose exec -T postgres pg_restore -U postgres -d pos_system --clean --if-exists
echo "Restore completed."
