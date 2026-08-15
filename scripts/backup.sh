#!/bin/sh
set -eu
STAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
docker compose exec -T postgres pg_dump -U postgres -d pos_system -Fc > "backups/pos_${STAMP}.dump"
find backups -type f -name "pos_*.dump" -mtime +14 -delete
echo "Backup created: backups/pos_${STAMP}.dump"
