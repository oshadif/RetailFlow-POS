$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path backups | Out-Null
docker compose exec -T postgres pg_dump -U postgres -d pos_system -Fc > "backups/pos_$stamp.dump"
Write-Host "Backup created: backups/pos_$stamp.dump"
