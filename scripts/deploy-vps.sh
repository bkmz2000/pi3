#!/bin/sh
# Run on the production VPS. Args: immutable-image-ref release-sha age-recipient expected-app-origin deployment-profile
set -eu

encrypt_predeploy_snapshot() {
  image_ref=$1
  recipient=$2
  snapshot=$3
  destination=$4
  temporary="$destination.tmp.$$"
  if ! (umask 077; docker run --rm --network none --read-only \
    --mount "type=bind,src=$snapshot,dst=/snapshot/pi3.db,readonly" \
    --entrypoint age "$image_ref" -r "$recipient" /snapshot/pi3.db > "$temporary"); then
    rm -f "$temporary"
    return 1
  fi
  if [ ! -s "$temporary" ]; then
    rm -f "$temporary"
    return 1
  fi
  chmod 600 "$temporary"
  mv -f "$temporary" "$destination"
}

# Keep this operation independently testable with a stub Docker CLI; normal
# deployment still invokes the exact same function after validating the live snapshot.
if [ "${1:-}" = --encrypt-predeploy-snapshot ]; then
  shift
  [ "$#" -eq 4 ] || { echo 'usage: deploy-vps.sh --encrypt-predeploy-snapshot IMAGE RECIPIENT SNAPSHOT OUTPUT' >&2; exit 2; }
  encrypt_predeploy_snapshot "$@"
  exit $?
fi

IMAGE_REF=${1:?immutable image ref required}
RELEASE_SHA=${2:?release SHA required}
AGE_RECIPIENT=${3:?age public recipient required}
CANARY_BASE_URL=${4:?canary/app origin required}
DEPLOYMENT_PROFILE=${5:?deployment profile required}
CONTAINER=pi3
HEALTH=http://127.0.0.1:8080/api/health
BACKUP_DIR=/srv/pi3/backups

case "$IMAGE_REF" in
  ghcr.io/bkmz2000/pi3@sha256:*) image_digest=${IMAGE_REF##*@sha256:} ;;
  *) echo 'ERROR: image ref must be the approved pi3 registry digest' >&2; exit 1 ;;
esac
[ "${#image_digest}" -eq 64 ] || { echo 'ERROR: image digest must be SHA-256' >&2; exit 1; }
case "$image_digest" in *[!0123456789abcdef]*) echo 'ERROR: malformed image digest' >&2; exit 1 ;; esac
case "$RELEASE_SHA" in *[!0123456789abcdef]*|'') echo 'ERROR: malformed release SHA' >&2; exit 1 ;; esac
case "$DEPLOYMENT_PROFILE" in institutional|public) ;; *) echo 'ERROR: invalid deployment profile' >&2; exit 1 ;; esac
[ "${#RELEASE_SHA}" -eq 40 ] || [ "${#RELEASE_SHA}" -eq 64 ] || {
  echo 'ERROR: release SHA must be 40 or 64 hexadecimal characters' >&2; exit 1;
}
case "$AGE_RECIPIENT" in age1*) ;; *) echo 'ERROR: invalid age public recipient' >&2; exit 1 ;; esac
case "$AGE_RECIPIENT" in *[!a-z0-9]*) echo 'ERROR: malformed age public recipient' >&2; exit 1 ;; esac
case "$CANARY_BASE_URL" in https://*) ;; *) echo 'ERROR: expected app origin must use HTTPS' >&2; exit 1 ;; esac
origin_host=${CANARY_BASE_URL#https://}
case "$origin_host" in ''|*/*|*@*|*\?*|*\#*) echo 'ERROR: expected app origin must be a bare HTTPS origin' >&2; exit 1 ;; esac
CANARY_BASE_URL=${CANARY_BASE_URL%/}

cd /app/pi3
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

set_compose_image() {
  image_ref=$1
  [ ! -L .env ] || { echo 'ERROR: refusing to replace a symlinked production .env' >&2; return 1; }
  tmp=.env.pi3-image.$$
  if [ -f .env ]; then
    awk -v image="$image_ref" '
      BEGIN { replaced = 0 }
      /^PI3_IMAGE=/ { if (!replaced) print "PI3_IMAGE=" image; replaced = 1; next }
      { print }
      END { if (!replaced) print "PI3_IMAGE=" image }
    ' .env > "$tmp"
    chmod --reference=.env "$tmp" 2>/dev/null || chmod 600 "$tmp"
  else
    (umask 077; printf 'PI3_IMAGE=%s\n' "$image_ref" > "$tmp")
    chmod 600 "$tmp"
  fi
  mv -f "$tmp" .env
}

pin_previous_compose() {
  source_file=$1
  image_ref=$2
  output_file=$3
  awk -v image="$image_ref" '
    /^  pi3:[[:space:]]*$/ { in_pi3 = 1; print; next }
    in_pi3 && /^  [^ ]/ { in_pi3 = 0 }
    in_pi3 && /^    image:[[:space:]]*/ { print "    image: " image; changed = 1; next }
    { print }
    END { if (!changed) exit 3 }
  ' "$source_file" > "$output_file" || { rm -f "$output_file"; return 1; }
  chmod --reference="$source_file" "$output_file" 2>/dev/null || chmod 600 "$output_file"
}

assert_backup_storage_not_mounted() {
  while IFS= read -r source; do
    [ -n "$source" ] || continue
    source=$(realpath -m "$source") || return 1
    source=${source%/}
    [ -n "$source" ] || source=/
    if [ "$source" = "/" ]; then
      echo 'ERROR: container has a host-root bind mount; backup isolation cannot be established' >&2
      return 1
    fi
    case "$source" in /|/srv|/srv/pi3)
      echo 'ERROR: container bind mount exposes the host backup directory' >&2
      return 1 ;;
    esac
    case "$source" in /srv/pi3/backups|/srv/pi3/backups/*)
      echo 'ERROR: container bind mount is inside the host backup directory' >&2
      return 1 ;;
    esac
  done <<EOF
$(docker inspect "$CONTAINER" --format '{{range .Mounts}}{{if eq .Type "bind"}}{{println .Source}}{{end}}{{end}}')
EOF
}

[ -s .pi3-compose.previous ] || { echo 'ERROR: previous Compose file was not preserved before deployment' >&2; exit 1; }
current_app_origin=$(docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{.}} {{end}}' | tr ' ' '\n' | sed -n 's/^APP_BASE_URL=//p' | head -n 1)
[ "${current_app_origin%/}" = "$CANARY_BASE_URL" ] || {
  echo 'ERROR: canary origin does not match the running deployment origin' >&2; exit 1;
}
current_image_id=$(docker inspect "$CONTAINER" --format '{{.Image}}')
current_digest=$(docker image inspect "$current_image_id" --format '{{range .RepoDigests}}{{println .}}{{end}}' | grep -F 'ghcr.io/bkmz2000/pi3@sha256:' | head -n 1 || true)
case "$current_digest" in *@sha256:*) ;; *) echo 'ERROR: cannot resolve current rollback image digest' >&2; exit 1 ;; esac
assert_backup_storage_not_mounted
previous_release_sha=$(cat .pi3-current-release-sha 2>/dev/null || printf 'unknown')
set_compose_image "$current_digest"
pin_previous_compose .pi3-compose.previous "$current_digest" .pi3-compose.rollback || {
  echo 'ERROR: could not create a digest-pinned rollback Compose file' >&2; exit 1;
}

# Pulling the candidate only populates the local image cache; it does not alter
# the running service. The candidate image provides the age CLI used below.
docker pull "$IMAGE_REF"
candidate_build_id=$(docker image inspect "$IMAGE_REF" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
candidate_profile=$(docker image inspect "$IMAGE_REF" --format '{{index .Config.Labels "org.pi3.deployment-profile"}}')
[ "$candidate_build_id" = "$RELEASE_SHA" ] || { echo 'ERROR: candidate revision label mismatch' >&2; exit 1; }
[ "$candidate_profile" = "$DEPLOYMENT_PROFILE" ] || { echo 'ERROR: candidate profile label mismatch' >&2; exit 1; }
ts=$(date -u +%Y%m%dT%H%M%SZ)
backup_name="pi3-predeploy-$ts.db"
backup="$BACKUP_DIR/$backup_name"
encrypted_backup="$backup.age"
encrypted_tmp="$encrypted_backup.tmp.$$"
meta="$BACKUP_DIR/.pi3-predeploy-$ts.json"
container_backup="/tmp/$backup_name"
container_meta="/tmp/.pi3-predeploy-$ts.json"
deploy_attempted=0
encrypted_ready=0

cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  # Never leave a plaintext production database in the backup directory.
  rm -f "$backup" "$encrypted_tmp" 2>/dev/null || true
  if [ "$encrypted_ready" -eq 0 ]; then rm -f "$encrypted_backup" 2>/dev/null || true; fi
  docker compose exec -T "$CONTAINER" rm -f "$container_backup" "$container_meta" 2>/dev/null || true

  if [ "$status" -ne 0 ] && [ "$deploy_attempted" -eq 1 ]; then
    echo 'ERROR: deployment failed; attempting to restore the previous image' >&2
    if [ -s .pi3-compose.rollback ]; then
      cp -p .pi3-compose.rollback docker-compose.yml
      set_compose_image "$current_digest" || true
    fi
    if docker compose pull "$CONTAINER" && docker compose up -d --no-deps "$CONTAINER"; then
      rollback_image=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || true)
      rollback_id=$(docker inspect "$CONTAINER" --format '{{.Image}}' 2>/dev/null || true)
      rollback_digest=$(docker image inspect "$rollback_id" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null | grep -F 'ghcr.io/bkmz2000/pi3@sha256:' | head -n 1 || true)
      if [ "$rollback_image" = "$current_digest" ] && [ "$rollback_digest" = "$current_digest" ] && curl -fsS "$HEALTH" >/dev/null 2>&1; then
        printf '%s\n' "$current_digest" > .pi3-current-image
        printf '%s\n' "$previous_release_sha" > .pi3-current-release-sha
        rm -f .pi3-compose.previous .pi3-compose.rollback .pi3-previous-image .pi3-previous-release-sha
        echo "✓ Previous image and pinned Compose restored and healthy: $current_digest" >&2
      else
        echo 'ERROR: rollback did not restore the expected image digest and health' >&2
      fi
    else
      echo 'ERROR: rollback command failed; production state needs operator attention' >&2
    fi
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Snapshot the live DB with SQLite's online backup API, then validate the
# snapshot against the source before any application container is replaced.
docker compose exec -T "$CONTAINER" node -e '
const D=require("better-sqlite3"),fs=require("fs"),crypto=require("crypto"),d=new D("/app/db/pi3.db");
const out=process.argv[1],meta=process.argv[2],q=(db,t)=>db.prepare("select count(*) n from \""+t+"\"").get().n;
const readProject=(db,id)=>db.prepare("select id,name,user_id,version,files,assets,tilemaps,sounds,sheet,current_file from projects where id=?").get(id);
const hashProject=row=>crypto.createHash("sha256").update(JSON.stringify([row.id,row.name,row.user_id,row.version,row.files,row.assets,row.tilemaps,row.sounds,row.sheet,row.current_file])).digest("hex");
(async()=>{await d.backup(out);const b=new D(out,{readonly:true});const integrity=b.pragma("integrity_check")[0].integrity_check;if(integrity!=="ok")throw Error("backup integrity check failed");const counts={projects:q(d,"projects"),users:q(d,"users"),migrations:q(d,"schema_migrations")};const restored={projects:q(b,"projects"),users:q(b,"users"),migrations:q(b,"schema_migrations")};if(counts.projects!==restored.projects||counts.users!==restored.users||counts.migrations!==restored.migrations)throw Error("backup row counts differ from source");const migrationNames=d.prepare("select filename from schema_migrations order by filename").all().map(r=>r.filename);const canary=d.prepare("select id from projects order by updated_at desc limit 1").get();if(!canary)throw Error("no project available for pre-deploy read-back");const sourceProject=readProject(d,canary.id),backupProject=readProject(b,canary.id);const contentSha256=hashProject(sourceProject);if(contentSha256!==hashProject(backupProject))throw Error("backup project content differs from live source");fs.writeFileSync(meta,JSON.stringify({integrity,...counts,migrationNames,canary:{id:canary.id,contentSha256}}));b.close();d.close()})().catch(e=>{console.error(e.message);process.exit(1)})' "$container_backup" "$container_meta"
docker compose cp "$CONTAINER:$container_backup" "$backup" >/dev/null
docker compose cp "$CONTAINER:$container_meta" "$meta" >/dev/null
[ -s "$backup" ] && [ -s "$meta" ] || { echo 'ERROR: pre-deploy snapshot or metadata is missing' >&2; exit 1; }

plain_sha=$(sha256sum "$backup" | awk '{print $1}')
bytes=$(wc -c < "$backup" | tr -d ' ')
# The candidate sees only this snapshot read-only, with networking disabled;
# ciphertext is streamed to a private host temp file, never a backup-dir mount.
if ! encrypt_predeploy_snapshot "$IMAGE_REF" "$AGE_RECIPIENT" "$backup" "$encrypted_backup"; then
  echo 'ERROR: candidate could not encrypt the verified pre-deploy snapshot' >&2
  exit 1
fi
enc_sha=$(sha256sum "$encrypted_backup" | awk '{print $1}')
encrypted_ready=1
# Run the exact candidate's initDb() in the pinned image, with no network,
# production credentials, or writable access to the host snapshot. The image
# sees only a disposable tmpfs copy; a migration failure cannot touch live DB.
docker run --rm --network none --read-only --user 0 \
  --tmpfs /app/db:rw,mode=0700,size=1g --tmpfs /tmp:rw,mode=0700,size=64m \
  --mount "type=bind,src=$backup,dst=/snapshot/pi3.db,readonly" \
  --mount "type=bind,src=$meta,dst=/snapshot/metadata.json,readonly" \
  -e DB_PATH=/app/db/pi3.db --entrypoint /bin/sh "$IMAGE_REF" -ec \
  'cp /snapshot/pi3.db /app/db/pi3.db && exec node /app/scripts/verify-candidate-migrations.mjs /app/db/pi3.db /snapshot/metadata.json'
metadata=$(cat "$meta")
printf '{"timestamp":"%s","release":"%s","sourceImage":"%s","sha256":"%s","encryptedSha256":"%s","bytes":%s,"path":"%s","metadata":%s}\n' \
  "$ts" "$RELEASE_SHA" "$current_digest" "$plain_sha" "$enc_sha" "$bytes" "$backup_name.age" "$metadata" >> "$BACKUP_DIR/manifest.jsonl"
rm -f "$backup"
# Prune only after a new encrypted snapshot and its pre-deploy checks succeeded.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'pi3-predeploy-*.db.age' -mtime +30 -delete

# Record the rollback target before changing the service. Keep metadata until
# the post-deploy DB read-back has passed; cleanup preserves it on failure.
printf '%s\n' "$current_digest" > .pi3-previous-image
printf '%s\n' "$previous_release_sha" > .pi3-previous-release-sha
PI3_IMAGE="$IMAGE_REF" docker compose pull "$CONTAINER"
set_compose_image "$IMAGE_REF"
deploy_attempted=1
# Mark the attempt before `up`: Compose can partially replace a service and then
# return non-zero, so the EXIT trap must roll back even when this command fails.
docker compose up -d --no-deps "$CONTAINER"
actual=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}')
[ "$actual" = "$IMAGE_REF" ] || { echo "ERROR: running image mismatch: $actual" >&2; exit 1; }
actual_image_id=$(docker inspect "$CONTAINER" --format '{{.Image}}')
actual_digest=$(docker image inspect "$actual_image_id" --format '{{range .RepoDigests}}{{println .}}{{end}}' | grep -F 'ghcr.io/bkmz2000/pi3@sha256:' | head -n 1 || true)
[ "$actual_digest" = "$IMAGE_REF" ] || { echo 'ERROR: running image digest differs from the approved candidate' >&2; exit 1; }
assert_backup_storage_not_mounted
new_app_origin=$(docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{.}} {{end}}' | tr ' ' '\n' | sed -n 's/^APP_BASE_URL=//p' | head -n 1)
[ "${new_app_origin%/}" = "$CANARY_BASE_URL" ] || { echo 'ERROR: deployed app origin differs from canary origin' >&2; exit 1; }
curl -fsS "$HEALTH" >/dev/null

cat "$meta" | docker compose exec -T "$CONTAINER" node -e '
const D=require("better-sqlite3"),fs=require("fs"),crypto=require("crypto"),d=new D("/app/db/pi3.db"),q=t=>d.prepare("select count(*) n from \""+t+"\"").get().n;
(async()=>{
  const {assertMigrationSet}=await import("./dist-server/db/migrationSafety.js");
  const expected=JSON.parse(fs.readFileSync(0,"utf8"));
  const project=d.prepare("select id,name,user_id,version,files,assets,tilemaps,sounds,sheet,current_file from projects where id=?").get(expected.canary.id);
  const contentSha256=project&&crypto.createHash("sha256").update(JSON.stringify([project.id,project.name,project.user_id,project.version,project.files,project.assets,project.tilemaps,project.sounds,project.sheet,project.current_file])).digest("hex");
  const applied=d.prepare("select filename from schema_migrations order by filename").all().map(r=>r.filename);
  const available=fs.readdirSync("/app/dist-server/db/migrations").filter(f=>f.endsWith(".sql")).sort();
  assertMigrationSet(applied,available,expected.migrationNames||[]);
  const actual={projects:q("projects"),users:q("users"),migrations:q("schema_migrations")};
  if(actual.projects!==expected.projects||actual.users!==expected.users||actual.migrations!==applied.length||contentSha256!==expected.canary.contentSha256)throw Error("post-deploy row-count, migration-set, or project-content read-back mismatch");
  console.log(JSON.stringify({...actual,migrationSet:applied,projectReadBackVerified:true}));
})().then(()=>d.close()).catch(e=>{console.error(e.message);d.close();process.exit(1)})'

printf '%s\n' "$IMAGE_REF" > .pi3-current-image
printf '%s\n' "$RELEASE_SHA" > .pi3-current-release-sha
rm -f "$meta"
deploy_attempted=0
echo "✓ Deployed $IMAGE_REF; encrypted pre-deploy backup stored at $encrypted_backup; health and DB read-back passed."
