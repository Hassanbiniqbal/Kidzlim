#!/bin/sh
# Nightly backup (brief §7): Postgres dump + both upload volumes, kept for $BACKUP_KEEP_DAYS days.
# Runs inside the `backup` compose service. Copy /backups off the VPS (see README → Backups).
set -eu

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
RUN_AT="${BACKUP_AT:-02:30}"

backup_once() {
  stamp=$(date -u +%Y%m%d-%H%M%S)
  dir="/backups/$stamp"
  mkdir -p "$dir"
  echo "[backup] $stamp starting"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner -f "$dir/db.dump"
  tar -czf "$dir/media.tar.gz" -C /data media
  tar -czf "$dir/protected-media.tar.gz" -C /data protected-media
  (cd "$dir" && sha256sum db.dump media.tar.gz protected-media.tar.gz > SHA256SUMS)
  find /backups -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +
  echo "[backup] $stamp done ($(du -sh "$dir" | cut -f1))"
}

if [ "${1:-}" = "--now" ]; then
  backup_once
  exit 0
fi

while true; do
  now=$(date -u +%H:%M)
  if [ "$now" = "$RUN_AT" ]; then
    backup_once || echo "[backup] FAILED — check the logs above" >&2
    sleep 61
  fi
  sleep 30
done
