#!/usr/bin/env bash
#
# Scheduled logical backup for the production Postgres database.
#
# Runs as the long-lived "backup" companion service in docker-compose.prod.yml:
# it sleeps until the configured hour, takes a compressed pg_dump over the
# Compose network, rotates old dumps, then sleeps again. Pass "once" as the
# first argument to take a single backup and exit (used for on-demand backups
# and the restore test). See docs/DEPLOYMENT.md "Backups" for the restore
# procedure and the operator offsite step.
#
# Connection details come from the standard libpq PG* variables wired in the
# compose service (which reuse the stack's POSTGRES_* secrets). Nothing is
# hardcoded here, and the database is never published off the Compose network.

set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backups}"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
SCHEDULE_HOUR="${BACKUP_SCHEDULE_HOUR:-3}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"

log() {
  printf '%s backup: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1"
}

prune() {
  directory="$1"
  keep="$2"
  # Dumps are named by ISO date, which sorts chronologically. Delete the oldest
  # ones so only the newest "keep" survive. Counting first (rather than
  # "head -n -N") keeps this portable to any POSIX head.
  count="$(find "$directory" -maxdepth 1 -type f -name '*.dump' | wc -l | tr -d ' ')"
  remove=$(( count - keep ))
  if [ "$remove" -gt 0 ]; then
    find "$directory" -maxdepth 1 -type f -name '*.dump' | sort | head -n "$remove" | while read -r stale; do
      rm -f "$stale"
      log "pruned $(basename "$stale")"
    done
  fi
}

run_backup() {
  mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"
  # Self-heal: a SIGKILL/OOM/host-crash mid-dump can leave an orphaned
  # ".partial" that the prune (which matches "*.dump") never removes. Sweep any
  # left behind before starting so they cannot accumulate.
  find "$DAILY_DIR" -maxdepth 1 -type f -name '*.partial' -delete
  stamp="$(date -u '+%Y-%m-%d')"
  daily_file="${DAILY_DIR}/linklater-${stamp}.dump"
  partial="${daily_file}.partial"

  log "starting dump of ${PGDATABASE} on ${PGHOST}"
  # -Fc: custom format (compressed, restorable with pg_restore). Write to a
  # temp file first so an interrupted dump never leaves a truncated file that
  # looks like a good backup.
  if ! pg_dump -Fc -f "$partial"; then
    log "pg_dump failed; leaving previous backups untouched"
    rm -f "$partial"
    return 1
  fi
  mv "$partial" "$daily_file"
  log "wrote ${daily_file}"

  # On the first backup of each week (Monday), keep a weekly copy so a
  # slow-to-notice corruption is still recoverable weeks later.
  if [ "$(date -u '+%u')" = "1" ]; then
    cp "$daily_file" "${WEEKLY_DIR}/linklater-${stamp}.dump"
    log "wrote weekly copy for ${stamp}"
  fi

  prune "$DAILY_DIR" "$KEEP_DAILY"
  prune "$WEEKLY_DIR" "$KEEP_WEEKLY"
}

seconds_until_next_run() {
  # Seconds from now until the next SCHEDULE_HOUR:00 UTC. Computed from the
  # wall-clock components (no GNU "date -d") so it stays portable. 10# forces
  # base 10 so zero-padded values like 08 or 09 are not read as octal.
  now_secs=$(( 10#$(date -u +%H) * 3600 + 10#$(date -u +%M) * 60 + 10#$(date -u +%S) ))
  target_secs=$(( 10#$SCHEDULE_HOUR * 3600 ))
  delay=$(( target_secs - now_secs ))
  if [ "$delay" -le 0 ]; then
    delay=$(( delay + 86400 ))
  fi
  echo "$delay"
}

# On-demand single backup: take one dump and exit with its status.
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
