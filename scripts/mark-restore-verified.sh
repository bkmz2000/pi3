#!/bin/sh
# Preserve one encrypted artifact after an operator completed an off-host restore drill.
set -eu

BACKUP_DIR=${BACKUP_DIR:-/srv/pi3/backups}
MANIFEST="$BACKUP_DIR/manifest.jsonl"
PROTECTED_BACKUP="$BACKUP_DIR/pi3-restore-verified.db.age"
PROTECTED_META="$BACKUP_DIR/pi3-restore-verified.json"
artifact=${1:?usage: mark-restore-verified.sh <backup-file.db.age> --restore-drill-passed}
confirmation=${2:-}

case "$artifact" in
  pi3-daily-*.db.age|pi3-weekly-*.db.age|pi3-monthly-*.db.age) ;;
  *) echo 'ERROR: artifact must be a named daily, weekly, or monthly backup' >&2; exit 1 ;;
esac
case "$artifact" in *[!A-Za-z0-9._-]*|*..*) echo 'ERROR: invalid artifact path' >&2; exit 1 ;; esac
[ "$confirmation" = '--restore-drill-passed' ] || {
  echo 'ERROR: run only after a full off-host restore drill passes; confirm with --restore-drill-passed' >&2; exit 1;
}

source_file="$BACKUP_DIR/$artifact"
[ -s "$source_file" ] || { echo 'ERROR: encrypted backup is missing or empty' >&2; exit 1; }
[ -s "$MANIFEST" ] || { echo 'ERROR: backup manifest is missing' >&2; exit 1; }
sha=$(sha256sum "$source_file" | awk '{print $1}')
grep -F '"file":"'"$artifact"'"' "$MANIFEST" | \
  grep -Fq '"encryptedSha256":"'"$sha"'"' || {
  echo 'ERROR: backup file and encrypted checksum are not recorded together in the manifest' >&2; exit 1;
}

operator=${SUDO_USER:-$(id -un)}
case "$operator" in *[!A-Za-z0-9._-]*) echo 'ERROR: operator name contains unsupported characters' >&2; exit 1 ;; esac
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
tmp_backup="$BACKUP_DIR/.pi3-restore-verified.$$.db.age"
tmp_meta="$BACKUP_DIR/.pi3-restore-verified.$$.json"
trap 'rm -f "$tmp_backup" "$tmp_meta"' EXIT HUP INT TERM
cp "$source_file" "$tmp_backup"
chmod 600 "$tmp_backup"
[ "$(sha256sum "$tmp_backup" | awk '{print $1}')" = "$sha" ] || {
  echo 'ERROR: protected copy checksum mismatch' >&2; exit 1;
}
printf '{"verifiedAt":"%s","sourceFile":"%s","encryptedSha256":"%s","operator":"%s","verification":"off-host-restore-drill"}\n' \
  "$ts" "$artifact" "$sha" "${SUDO_USER:-$(id -un)}" > "$tmp_meta"
chmod 600 "$tmp_meta"
# Publish metadata before the protected copy; if interrupted, the backup job's
# fail-closed checksum check prevents rotation until this command is retried.
mv -f "$tmp_meta" "$PROTECTED_META"
mv -f "$tmp_backup" "$PROTECTED_BACKUP"
echo "✓ Protected restore-verified artifact: $artifact ($sha)"
notifier=${PI3_TELEGRAM_NOTIFY_SCRIPT:-/usr/local/sbin/pi3-telegram-notify}
"$notifier" "✅ PI3 full off-host restore drill passed at $ts; protected backup refreshed by $operator." || \
  echo 'WARNING: restore verification was recorded, but Telegram notification failed' >&2
