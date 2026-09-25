#!/usr/bin/env bash
# Daily local watchdog: alert when the latest verified backup is stale/invalid,
# or when no restore drill has been recorded within the required interval.
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/srv/pi3/backups}
STATE_DIR=${BACKUP_ALERT_STATE_DIR:-/var/lib/pi3-backup/alerts}
NOTIFY=${PI3_TELEGRAM_NOTIFY_SCRIPT:-/usr/local/sbin/pi3-telegram-notify}
MAX_BACKUP_AGE_HOURS=${MAX_BACKUP_AGE_HOURS:-36}
MAX_RESTORE_AGE_DAYS=${MAX_RESTORE_AGE_DAYS:-35}
CONFIG_FILE=${PI3_BACKUP_ENV_FILE:-/etc/pi3-backup.env}

if [ -r "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN is required for backup monitoring}"
: "${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID is required for backup monitoring}"
[ -x "$NOTIFY" ] || { echo "Telegram notifier is not executable: $NOTIFY" >&2; exit 1; }
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

issues=$(python3 - "$BACKUP_DIR" "$MAX_BACKUP_AGE_HOURS" "$MAX_RESTORE_AGE_DAYS" <<'PY'
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import sys

backup_dir = pathlib.Path(sys.argv[1])
max_backup_age = int(sys.argv[2]) * 3600
max_restore_age = int(sys.argv[3]) * 86400
now = dt.datetime.now(dt.timezone.utc)
issues = []

def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()

manifest = backup_dir / 'manifest.jsonl'
rows = []
try:
    with manifest.open() as f:
        rows = [json.loads(line) for line in f if line.strip()]
except (OSError, ValueError):
    rows = []

daily = [row for row in rows if row.get('kind') == 'daily']
if not daily:
    issues.append('No daily backup record is present in the manifest.')
else:
    row = max(daily, key=lambda r: str(r.get('timestamp', '')))
    stamp = row.get('timestamp', '')
    try:
        completed = dt.datetime.strptime(stamp, '%Y%m%dT%H%M%SZ').replace(tzinfo=dt.timezone.utc)
    except (TypeError, ValueError):
        completed = None
    if completed is None:
        issues.append('The latest daily backup has an invalid timestamp.')
    else:
        age = (now - completed).total_seconds()
        if age > max_backup_age:
            issues.append(f'The latest daily backup is {int(age // 3600)} hours old (limit {max_backup_age // 3600}h).')
        filename = row.get('file') or f"pi3-daily-{completed:%Y-%m-%d}.db.age"
        if not isinstance(filename, str) or not re.fullmatch(r'pi3-daily-[0-9]{4}-[0-9]{2}-[0-9]{2}\.db\.age', filename):
            issues.append('The latest daily backup manifest filename is invalid.')
        else:
            artifact = backup_dir / filename
            if not artifact.is_file() or artifact.stat().st_size == 0:
                issues.append('The latest daily backup artifact is missing or empty.')
            else:
                expected = row.get('encryptedSha256')
                if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected):
                    issues.append('The latest daily backup has no valid encrypted checksum in the manifest.')
                else:
                    digest = sha256_file(artifact)
                    if digest != expected:
                        issues.append('The latest daily backup checksum does not match its manifest.')

restore_meta = backup_dir / 'pi3-restore-verified.json'
try:
    data = json.loads(restore_meta.read_text())
    verified = dt.datetime.fromisoformat(data['verifiedAt'].replace('Z', '+00:00'))
    restore_artifact = backup_dir / 'pi3-restore-verified.db.age'
    if not restore_artifact.is_file() or restore_artifact.stat().st_size == 0:
        raise ValueError('protected artifact missing')
    expected = data.get('encryptedSha256')
    if not isinstance(expected, str) or sha256_file(restore_artifact) != expected:
        raise ValueError('protected artifact checksum mismatch')
    age = (now - verified.astimezone(dt.timezone.utc)).total_seconds()
    if age > max_restore_age:
        issues.append(f'The last verified restore drill is {int(age // 86400)} days old (limit {max_restore_age // 86400}d).')
except (OSError, ValueError, KeyError, TypeError):
    issues.append('No valid protected restore-verified backup/drill record is present.')

for issue in issues:
    print(issue)
PY
)

handle_state() {
  key=$1
  problem=$2
  message=$3
  marker="$STATE_DIR/$key.active"
  if [ -n "$problem" ]; then
    now=$(date +%s)
    last=0
    if [ -r "$marker" ]; then
      last=$(cat "$marker")
      case "$last" in *[!0-9]*|'') last=0 ;; esac
    fi
    if [ "$last" -eq 0 ] || [ $((now - last)) -ge 604800 ]; then
      if [ "$last" -eq 0 ]; then
        "$NOTIFY" "🚨 PI3 backup monitor: $message $problem"
      else
        "$NOTIFY" "🚨 PI3 backup monitor reminder: $message $problem"
      fi
      (umask 077; printf '%s\n' "$now" > "$marker")
    fi
  elif [ -e "$marker" ]; then
    "$NOTIFY" "✅ PI3 backup monitor: $message condition is resolved."
    rm -f "$marker"
  fi
}

backup_issue=$(printf '%s\n' "$issues" | grep -E 'daily backup' | paste -sd ' ' - || true)
restore_issue=$(printf '%s\n' "$issues" | grep -E 'restore drill|restore-verified' | paste -sd ' ' - || true)
handle_state backup "$backup_issue" 'Backup freshness/validity issue:'
handle_state restore "$restore_issue" 'Restore-drill freshness/validity issue:'
