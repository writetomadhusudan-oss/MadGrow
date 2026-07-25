#!/usr/bin/env bash
# Nightly PostgreSQL backup for MadGrow, gzip-compressed, 14-day retention.
# Installed on the server at /usr/local/bin/madgrow-backup.sh and run by cron
# (30 2 * * *). Restore with:
#   gunzip -c /root/backups/madgrow-YYYYMMDD-HHMMSS.sql.gz | sudo -u postgres psql madgrow
set -euo pipefail
BACKUP_DIR=/root/backups
RETENTION_DAYS=14
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/madgrow-$STAMP.sql.gz"
sudo -u postgres pg_dump madgrow | gzip > "$FILE"
echo "$(date -Is) backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
find "$BACKUP_DIR" -name 'madgrow-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
