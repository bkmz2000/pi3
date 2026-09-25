#!/bin/sh
# Keep the configured rolling sets without ever pruning the separately protected restore-tested copy.
set -eu
BACKUP_DIR=${1:?usage: backup-retention.sh <backup-directory>}
PROTECTED="$BACKUP_DIR/pi3-restore-verified.db.age"

prune_class() {
  class=$1
  keep=$2
  case "$class" in
    daily) set -- "$BACKUP_DIR"/pi3-daily-*.db.age ;;
    weekly) set -- "$BACKUP_DIR"/pi3-weekly-*.db.age ;;
    monthly) set -- "$BACKUP_DIR"/pi3-monthly-*.db.age ;;
    *) echo "ERROR: unknown backup class: $class" >&2; return 2 ;;
  esac
  count=0
  # Filenames are controlled by vps-backup.sh and contain no whitespace.
  for file in $(ls -1t "$@" 2>/dev/null || true); do
    [ "$file" = "$PROTECTED" ] && continue
    count=$((count + 1))
    if [ "$count" -gt "$keep" ]; then
      rm -f -- "$file"
    fi
  done
}

prune_class daily 7
prune_class weekly 4
prune_class monthly 1
