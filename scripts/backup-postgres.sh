#!/usr/bin/env bash
#
# Scheduled logical backup for the production Postgres database.
#
# Runs as the long-lived "backup" companion service in
# docker-compose.prod.yml:
#
#   1. It sleeps until the configured hour
#   2. Takes a compressed pg_dump (hehe) over the Compose network
#   3. Rotates old dumps (hehe)
#   4. Sleeps again
#
# For on-demand backups, pass "once" as the first argument to take a single
# backup and exit.
#
# Nothing is hardcoded in this script, and the database is never published
# off the Compose network.

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
SCHEDULE_HOUR="${BACKUP_SCHEDULE_HOUR:-3}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"

ENCRYPTION_PASSPHRASE="${BACKUP_ENCRYPTION_PASSPHRASE:-}"

log() {
  printf '%s backup: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1"
}

prune() {
  directory="$1"
  keep="$2"
  # deletes the oldest dumps
  count="$(find "$directory" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.enc' \) | wc -l | tr -d ' ')"
  remove=$(( count - keep ))
  if [ "$remove" -gt 0 ]; then
    find "$directory" -maxdepth 1 -type f \( -name '*.dump' -o -name '*.dump.enc' \) | sort | head -n "$remove" | while read -r stale; do
      rm -f "$stale"
      log "pruned $(basename "$stale")"
    done
  fi
}

run_backup() {
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"
  # performs a self-heal in case there's any orphaned files
  find "$DAILY_DIR" -maxdepth 1 -type f -name '*.partial' -delete
  stamp="$(date -u '+%Y-%m-%d')"
  if [ -n "$ENCRYPTION_PASSPHRASE" ]; then
    daily_file="${DAILY_DIR}/linklater-${stamp}.dump.enc"
  else
    daily_file="${DAILY_DIR}/linklater-${stamp}.dump"
  fi
  partial="${daily_file}.partial"

  log "starting dump of ${PGDATABASE} on ${PGHOST}"
  if [ -n "$ENCRYPTION_PASSPHRASE" ]; then
    dump_ok=0
    pg_dump -Fc \
      | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
          -pass env:BACKUP_ENCRYPTION_PASSPHRASE -out "$partial" \
      || dump_ok=1
  else
    log "WARNING: BACKUP_ENCRYPTION_PASSPHRASE is not set; writing an UNENCRYPTED dump"
    dump_ok=0
    pg_dump -Fc -f "$partial" || dump_ok=1
  fi
  if [ "$dump_ok" -ne 0 ]; then
    log "pg_dump failed; leaving previous backups untouched"
    rm -f "$partial"
    return 1
  fi
  mv "$partial" "$daily_file"
  log "wrote ${daily_file}"

  # saves a weekly copy on the first backup of each week
  if [ "$(date -u '+%u')" = "1" ]; then
    cp "$daily_file" "${WEEKLY_DIR}/$(basename "$daily_file")"
    log "wrote weekly copy for ${stamp}"
  fi

  prune "$DAILY_DIR" "$KEEP_DAILY"
  prune "$WEEKLY_DIR" "$KEEP_WEEKLY"
}

seconds_until_next_run() {
  now_secs=$(( 10#$(date -u +%H) * 3600 + 10#$(date -u +%M) * 60 + 10#$(date -u +%S) ))
  target_secs=$(( 10#$SCHEDULE_HOUR * 3600 ))
  delay=$(( target_secs - now_secs ))
  if [ "$delay" -le 0 ]; then
    delay=$(( delay + 86400 ))
  fi
  echo "$delay"
}

# performs an on-demand single backup
if [ "${1:-}" = "once" ]; then
  if run_backup; then
    exit 0
  fi
  exit 1
fi

log "backup service started; schedule ${SCHEDULE_HOUR}:00 UTC, retention ${KEEP_DAILY} daily / ${KEEP_WEEKLY} weekly"
while true; do
  delay="$(seconds_until_next_run)"
  log "sleeping ${delay}s until the next scheduled run"
  sleep "$delay"
  if run_backup; then
    log "backup complete"
  else
    log "backup failed; will retry at the next scheduled run"
  fi
done
