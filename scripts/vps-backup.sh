#!/bin/sh
# Host-side nightly SQLite backup. Run from /app/pi3 via systemd.
set -eu

cd /app/pi3
BACKUP_DIR=/srv/pi3/backups
RECIPIENT_FILE=/etc/pi3-backup.env
MANIFEST="$BACKUP_DIR/manifest.jsonl"
PROTECTED_BACKUP="$BACKUP_DIR/pi3-restore-verified.db.age"
PROTECTED_META="$BACKUP_DIR/pi3-restore-verified.json"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ ! -r "$RECIPIENT_FILE" ]; then
  echo 'Backup encryption configuration is missing' >&2
  exit 1
fi
# shellcheck disable=SC1090,SC1091
. "$RECIPIENT_FILE"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

source_image=$(docker inspect pi3 --format '{{.Config.Image}}')
source_release=$(docker inspect pi3 --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
if [ -s .pi3-current-image ] && [ "$(head -n 1 .pi3-current-image)" != "$source_image" ]; then
  echo 'Tracked image digest differs from the running container; refusing to mislabel the backup' >&2
  exit 1
fi
if [ -s .pi3-current-release-sha ] && [ "$(head -n 1 .pi3-current-release-sha)" != "$source_release" ]; then
  echo 'Tracked release SHA differs from the running container; refusing to mislabel the backup' >&2
  exit 1
fi
[ -n "$source_image" ] && [ -n "$source_release" ] || {
  echo 'Current release/image identity is missing; refusing to create an untraceable backup' >&2; exit 1;
}
case "$source_image" in *@sha256:*) ;; *) echo 'Current image is not digest-pinned' >&2; exit 1 ;; esac
case "$source_image" in *[!A-Za-z0-9._/:@-]*) echo 'Current image reference contains unsupported characters' >&2; exit 1 ;; esac
case "$source_release" in *[!0123456789abcdef]*|'') echo 'Current release SHA is malformed' >&2; exit 1 ;; esac
[ "${#source_release}" -eq 40 ] || [ "${#source_release}" -eq 64 ] || {
  echo 'Current release SHA must be 40 or 64 hexadecimal characters' >&2; exit 1;
}

ts=$(date -u +%Y%m%dT%H%M%SZ)
day=$(date -u +%Y-%m-%d)
month=$(date -u +%Y-%m)
tmp_db="/tmp/pi3-backup-$ts.db"
plain_tmp="$BACKUP_DIR/.pi3-$ts.db"

cleanup() {
  rm -f "$plain_tmp" "$plain_tmp.age"
  docker compose exec -T pi3 rm -f "$tmp_db" 2>/dev/null || true
}

notify_backup_result() {
  status=$?
  trap - EXIT
  cleanup
  notifier=${PI3_TELEGRAM_NOTIFY_SCRIPT:-/usr/local/sbin/pi3-telegram-notify}
  if [ "$status" -eq 0 ]; then
    "$notifier" "✅ PI3 daily database backup completed and verified at $(date -u +%Y-%m-%dT%H:%M:%SZ)." || \
      echo 'WARNING: backup succeeded, but Telegram notification failed' >&2
  else
    "$notifier" "🚨 PI3 daily database backup FAILED at $(date -u +%Y-%m-%dT%H:%M:%SZ) (exit $status). Check systemd journal for pi3-backup.service." || \
      echo 'WARNING: backup failed and Telegram notification also failed' >&2
  fi
  exit "$status"
}
trap notify_backup_result EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# If an operator recorded a successful off-host restore drill, verify its
# protected encrypted copy before doing any rotation. This path is outside all
# daily/weekly/monthly globs and is never pruned by this job.
if [ -e "$PROTECTED_BACKUP" ] || [ -e "$PROTECTED_META" ]; then
  if [ ! -s "$PROTECTED_BACKUP" ] || [ ! -s "$PROTECTED_META" ]; then
    echo 'Protected restore-verified backup metadata is incomplete' >&2
    exit 1
  fi
  protected_sha=$(sha256sum "$PROTECTED_BACKUP" | awk '{print $1}')
  grep -Fq '"encryptedSha256":"'"$protected_sha"'"' "$PROTECTED_META" || {
    echo 'Protected restore-verified backup checksum does not match its metadata' >&2; exit 1;
  }
fi

# better-sqlite3's online backup API safely snapshots a live WAL database.
meta=$(docker compose exec -T pi3 node -e '
const D=require("better-sqlite3"),d=new D("/app/db/pi3.db"),out=process.argv[1];
const sourceRelease=process.argv[2],sourceImage=process.argv[3];
const q=(db,t)=>db.prepare("select count(*) n from \""+t+"\"").get().n;
const readProject=(db,id)=>db.prepare("select id,name,user_id,version,files,assets,tilemaps,sounds,sheet,current_file from projects where id=?").get(id);
const hashProject=row=>require("crypto").createHash("sha256").update(JSON.stringify([row.id,row.name,row.user_id,row.version,row.files,row.assets,row.tilemaps,row.sounds,row.sheet,row.current_file])).digest("hex");
(async()=>{
  await d.backup(out);
  const b=new D(out,{readonly:true});
  const integrity=b.pragma("integrity_check")[0].integrity_check;
  if(integrity!=="ok")throw Error("integrity_check: "+integrity);
  const counts={projects:q(d,"projects"),users:q(d,"users"),migrations:q(d,"schema_migrations")};
  for(const [k,t] of [["projects","projects"],["users","users"],["migrations","schema_migrations"]])if(counts[k]!==q(b,t))throw Error("backup row-count mismatch: "+k);
  const migrationNames=d.prepare("select filename from schema_migrations order by filename").all().map(r=>r.filename);
  const canary=d.prepare("select id from projects order by updated_at desc limit 1").get();
  if(!canary)throw Error("no project row available for verification");
  const sourceHash=hashProject(readProject(d,canary.id));
  const backupHash=hashProject(readProject(b,canary.id));
  if(sourceHash!==backupHash)throw Error("backup project read-back differs from live source");
  console.log(JSON.stringify({integrity,...counts,migrationNames,projectReadBack:{id:canary.id,contentSha256:sourceHash},sourceRelease,sourceImage}));
  b.close();d.close();
})().catch(e=>{console.error(e);process.exit(1)})' "$tmp_db" "$source_release" "$source_image")
docker compose cp "pi3:$tmp_db" "$plain_tmp" >/dev/null
chmod 600 "$plain_tmp"
plain_sha=$(sha256sum "$plain_tmp" | awk '{print $1}')
bytes=$(wc -c < "$plain_tmp" | tr -d ' ')
age -r "$BACKUP_AGE_RECIPIENT" -o "$plain_tmp.age" "$plain_tmp"
enc_sha=$(sha256sum "$plain_tmp.age" | awk '{print $1}')

record_manifest() {
  kind=$1
  file=$2
  printf '{"timestamp":"%s","kind":"%s","file":"%s","release":"%s","sourceImage":"%s","sha256":"%s","encryptedSha256":"%s","bytes":%s,"metadata":%s}\n' \
    "$ts" "$kind" "$file" "$source_release" "$source_image" "$plain_sha" "$enc_sha" "$bytes" "$meta" >> "$MANIFEST"
}

publish() {
  kind=$1
  name=$2
  file="$name.db.age"
  final="$BACKUP_DIR/$file"
  mv "$plain_tmp.age" "$final"
  chmod 600 "$final"
  record_manifest "$kind" "$file"
  echo "Saved $kind backup $final"
}

publish daily "pi3-daily-$day"
weekday=$(date -u +%u)
monthday=$(date -u +%d)
if [ "$weekday" = 7 ]; then
  file="pi3-weekly-$day.db.age"
  cp "$BACKUP_DIR/pi3-daily-$day.db.age" "$BACKUP_DIR/$file"
  chmod 600 "$BACKUP_DIR/$file"
  record_manifest weekly "$file"
fi
if [ "$monthday" = 01 ]; then
  file="pi3-monthly-$month.db.age"
  cp "$BACKUP_DIR/pi3-daily-$day.db.age" "$BACKUP_DIR/$file"
  chmod 600 "$BACKUP_DIR/$file"
  record_manifest monthly "$file"
fi

# Bounded local rotation; the helper explicitly excludes the protected copy.
sh scripts/backup-retention.sh "$BACKUP_DIR"
rm -f "$BACKUP_DIR/.restore-$ts.db"
