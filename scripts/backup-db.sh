#!/bin/sh
# Create a consistent SQLite online backup and store an encrypted copy on the
# VPS host-mounted backup directory. Suitable for cron/systemd or pre-deploy use.
set -eu

DB_PATH=${DB_PATH:-/app/db/pi3.db}
BACKUP_DIR=${BACKUP_DIR:-/app/backups}
AGE_RECIPIENT=${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to an age public recipient}
RELEASE_ID=${RELEASE_ID:-${PI3_BUILD_ID:-unknown}}

command -v age >/dev/null 2>&1 || { echo 'ERROR: age is required' >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo 'ERROR: node is required' >&2; exit 1; }
[ -d "$BACKUP_DIR" ] && awk '$2 == "/app/backups" { mounted=1 } END { exit !mounted }' /proc/mounts || {
  echo 'ERROR: /app/backups is not a mounted host directory; refusing to write into the container layer' >&2
  exit 1
}
mkdir -p "$BACKUP_DIR"
ts=$(date -u +%Y%m%dT%H%M%SZ)
tmp="$BACKUP_DIR/.pi3-$ts.db.tmp"
plain="$BACKUP_DIR/pi3-$ts.db"
enc="$plain.age"
meta="$BACKUP_DIR/.pi3-$ts.json"
trap 'rm -f "$tmp" "$meta" "$plain"' EXIT HUP INT TERM

META_PATH="$meta" RELEASE_ID="$RELEASE_ID" node - "$DB_PATH" "$tmp" <<'NODE'
const Database = require('better-sqlite3');
const fs = require('fs');
const [dbPath, outputPath] = process.argv.slice(2);
(async () => {
  const source = new Database(dbPath, { readonly: true });
  await source.backup(outputPath);
  source.close();
  const snapshot = new Database(outputPath, { readonly: true });
  const count = table => snapshot.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
  const integrity = snapshot.pragma('integrity_check')[0].integrity_check;
  if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
  const data = {
    timestamp: new Date().toISOString(),
    release: process.env.RELEASE_ID || 'unknown',
    projects: count('projects'),
    users: count('users'),
    migrations: count('schema_migrations'),
    integrity,
  };
  fs.writeFileSync(process.env.META_PATH, JSON.stringify(data) + '\n', { mode: 0o600 });
  snapshot.close();
})().catch(error => { console.error(error); process.exit(1); });
NODE
mv "$tmp" "$plain"
plain_sha=$(sha256sum "$plain" | awk '{print $1}')
size=$(wc -c < "$plain" | tr -d ' ')
age -r "$AGE_RECIPIENT" -o "$enc" "$plain"
enc_sha=$(sha256sum "$enc" | awk '{print $1}')
printf '{"release":"%s","sha256":"%s","encryptedSha256":"%s","bytes":%s,"metadata":%s}\n' \
  "$RELEASE_ID" "$plain_sha" "$enc_sha" "$size" "$(cat "$meta")" >> "$BACKUP_DIR/manifest.jsonl"

echo "Backup created on VPS host storage: $enc (sha256=$enc_sha, bytes=$size)"
cat "$meta"
