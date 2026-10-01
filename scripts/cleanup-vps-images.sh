#!/bin/sh
# Remove only stale pi3 images after the successful finalize-vps Make target.
# Run remotely over SSH; never use docker system/image/container prune here.
set -eu

MODE=${1:?usage: cleanup-vps-images.sh --dry-run|--apply <release-sha>}
RELEASE_SHA=${2:?release SHA required}
case "$MODE" in --dry-run|--apply) ;; *) echo 'ERROR: mode must be --dry-run or --apply' >&2; exit 2 ;; esac
case "$RELEASE_SHA" in *[!0123456789abcdef]*|'') echo 'ERROR: malformed release SHA' >&2; exit 2 ;; esac
[ "${#RELEASE_SHA}" -eq 40 ] || [ "${#RELEASE_SHA}" -eq 64 ] || {
  echo 'ERROR: release SHA must be 40 or 64 hexadecimal characters' >&2; exit 2;
}

fail() { echo "ERROR: pi3 image cleanup: $*" >&2; exit 1; }
ROOT=/app/pi3
BACKUP_DIR=/srv/pi3/backups
if [ "${PI3_CLEANUP_TESTING+x}" = x ]; then
  [ "$PI3_CLEANUP_TESTING" = 1 ] || fail 'invalid test harness flag'
  [ "${PI3_CLEANUP_TEST_ROOT+x}" = x ] && [ -n "$PI3_CLEANUP_TEST_ROOT" ] || fail 'test harness root is required'
  [ "${PI3_CLEANUP_TEST_BACKUP_DIR+x}" = x ] && [ -n "$PI3_CLEANUP_TEST_BACKUP_DIR" ] || fail 'test harness backup path is required'
  [ "$PI3_CLEANUP_TEST_ROOT" != /app/pi3 ] && [ "$PI3_CLEANUP_TEST_BACKUP_DIR" != /srv/pi3/backups ] || fail 'test harness paths must not target production'
  [ -f "$PI3_CLEANUP_TEST_ROOT/.pi3-cleanup-test-fixture" ] && \
    [ ! -L "$PI3_CLEANUP_TEST_ROOT/.pi3-cleanup-test-fixture" ] || fail 'test harness root marker is missing'
  [ -f "$PI3_CLEANUP_TEST_BACKUP_DIR/.pi3-cleanup-test-fixture" ] && \
    [ ! -L "$PI3_CLEANUP_TEST_BACKUP_DIR/.pi3-cleanup-test-fixture" ] || fail 'test harness backup marker is missing'
  ROOT=$PI3_CLEANUP_TEST_ROOT
  BACKUP_DIR=$PI3_CLEANUP_TEST_BACKUP_DIR
elif [ "${PI3_CLEANUP_TEST_ROOT+x}" = x ] || [ "${PI3_CLEANUP_TEST_BACKUP_DIR+x}" = x ]; then
  fail 'test path overrides are not permitted outside the test harness'
fi
valid_digest_ref() {
  case "$1" in ghcr.io/bkmz2000/pi3@sha256:*) ;; *) return 1 ;; esac
  hash=${1##*@sha256:}
  [ "${#hash}" -eq 64 ] || return 1
  case "$hash" in *[!0123456789abcdef]*) return 1 ;; esac
}
managed_ref() {
  case "$1" in
    ghcr.io/bkmz2000/pi3:*|ghcr.io/bkmz2000/pi3@sha256:*|pi3:*) return 0 ;;
    *) return 1 ;;
  esac
}
has_line() {
  needle=$1
  list=$2
  [ -n "$needle" ] || return 1
  printf '%s\n' "$list" | grep -Fxq -- "$needle"
}
image_refs() {
  docker image inspect "$1" --format '{{range .RepoTags}}{{println .}}{{end}}{{range .RepoDigests}}{{println .}}{{end}}'
}
image_label() {
  docker image inspect "$1" --format "{{if .Config.Labels}}{{index .Config.Labels \"$2\"}}{{end}}"
}

cd "$ROOT"
for state_file in .pi3-current-release-sha .pi3-current-image .env docker-compose.yml; do
  [ -f "$state_file" ] && [ ! -L "$state_file" ] || fail "required release state file is missing or symlinked: $state_file"
done
for marker in .pi3-compose.previous .pi3-compose.rollback .pi3-previous-image \
  .pi3-previous-release-sha .pi3-canary-passed-at .pi3-watch-started-at; do
  if [ -e "$marker" ] || [ -L "$marker" ]; then
    fail "pending release/rollback marker remains: $marker"
  fi
done

current_sha=$(cat .pi3-current-release-sha) || fail 'current release SHA missing'
[ "$current_sha" = "$RELEASE_SHA" ] || fail 'requested SHA is not the finalized current release'
current_image=$(cat .pi3-current-image) || fail 'current image marker missing'
valid_digest_ref "$current_image" || fail 'current image marker is not an immutable pi3 digest'
[ "$(grep -c '^PI3_IMAGE=' .env)" -eq 1 ] || fail 'expected exactly one PI3_IMAGE setting'
[ "$(sed -n 's/^PI3_IMAGE=//p' .env)" = "$current_image" ] || fail '.env does not select finalized current image'

# The pre-deploy manifest row records which verified successful release image
# was running when this release's protected SQLite snapshot was taken.
[ -d "$BACKUP_DIR" ] && [ ! -L "$BACKUP_DIR" ] || fail 'backup directory is missing or symlinked'
[ -f "$BACKUP_DIR/manifest.jsonl" ] && [ ! -L "$BACKUP_DIR/manifest.jsonl" ] || fail 'backup manifest is missing or symlinked'
previous_image=$(python3 - "$RELEASE_SHA" "$BACKUP_DIR" <<'PY'
import json
import re
import sys
from pathlib import Path

release = sys.argv[1]
backup_dir = Path(sys.argv[2])
manifest = backup_dir / 'manifest.jsonl'
matches = []
try:
    with manifest.open(encoding='utf-8') as stream:
        for line in stream:
            row = json.loads(line)
            path = row.get('path', '')
            if row.get('release') == release and isinstance(path, str) and path.startswith('pi3-predeploy-') and path.endswith('.db.age'):
                if Path(path).name != path or not re.fullmatch(r'pi3-predeploy-[A-Za-z0-9TZ-]+\.db\.age', path):
                    raise ValueError('unsafe predeploy backup path')
                artifact = backup_dir / path
                if not artifact.is_file() or artifact.is_symlink():
                    raise ValueError('matching encrypted predeploy snapshot is missing or symlinked')
                matches.append(row.get('sourceImage'))
except Exception as exc:
    print(f'ERROR: cannot validate predeploy manifest: {exc}', file=sys.stderr)
    sys.exit(1)
if len(matches) != 1:
    print(f'ERROR: expected exactly one predeploy manifest row for finalized release, found {len(matches)}', file=sys.stderr)
    sys.exit(1)
image = matches[0]
if not isinstance(image, str) or not re.fullmatch(r'ghcr\.io/bkmz2000/pi3@sha256:[0-9a-f]{64}', image):
    print('ERROR: manifest previous source image is not a digest-pinned pi3 image', file=sys.stderr)
    sys.exit(1)
print(image)
PY
) || fail 'cannot identify one unambiguous immediate-prior predeploy image'
valid_digest_ref "$previous_image" || fail 'previous image is not an immutable pi3 digest'
[ "$previous_image" != "$current_image" ] || fail 'current and previous image digests are identical'

current_id=$(docker image inspect "$current_image" --format '{{.Id}}') || fail 'current image is not locally available'
previous_id=$(docker image inspect "$previous_image" --format '{{.Id}}') || fail 'immediate previous image is not locally available'
[ "$current_id" != "$previous_id" ] || fail 'current and previous image IDs unexpectedly match'
current_refs=$(image_refs "$current_id") || fail 'cannot inspect current image references'
previous_refs=$(image_refs "$previous_id") || fail 'cannot inspect previous image references'
has_line "$current_image" "$current_refs" || fail 'current image digest is not a local registry reference'
has_line "$previous_image" "$previous_refs" || fail 'previous image digest is not a local registry reference'
current_revision=$(image_label "$current_image" 'org.opencontainers.image.revision')
previous_revision=$(image_label "$previous_image" 'org.opencontainers.image.revision')
profile=$(image_label "$current_image" 'org.pi3.deployment-profile')
previous_profile=$(image_label "$previous_image" 'org.pi3.deployment-profile')
[ "$current_revision" = "$RELEASE_SHA" ] || fail 'current image revision label does not match finalized SHA'
case "$previous_revision" in
  *[!0123456789abcdef]*|'') fail 'previous image has a malformed revision label' ;;
esac
[ "${#previous_revision}" -eq 40 ] || [ "${#previous_revision}" -eq 64 ] || fail 'previous image revision label has an invalid length'
case "$profile" in institutional|public) ;; *) fail 'current image has an unknown deployment profile' ;; esac
[ "$previous_profile" = "$profile" ] || fail 'previous and current image profiles differ'

running_image=$(docker inspect pi3 --format '{{.Config.Image}}') || fail 'running pi3 container is missing'
[ "$running_image" = "$current_image" ] || fail 'running pi3 container does not use finalized current image'
running_state=$(docker inspect pi3 --format '{{.State.Status}}') || fail 'cannot inspect running pi3 state'
[ "$running_state" = running ] || fail 'pi3 container is not running'
running_id=$(docker inspect pi3 --format '{{.Image}}') || fail 'cannot inspect running pi3 image ID'
[ "$running_id" = "$current_id" ] || fail 'running container image ID differs from current image'
[ "$(docker inspect pi3 --format '{{if .Config.Labels}}{{index .Config.Labels "com.docker.compose.project"}}{{end}}')" = pi3 ] || fail 'running pi3 container lacks its Compose project identity'
[ "$(docker inspect pi3 --format '{{if .Config.Labels}}{{index .Config.Labels "com.docker.compose.service"}}{{end}}')" = pi3 ] || fail 'running pi3 container lacks its Compose service identity'
db_mount=$(docker inspect pi3 --format '{{range .Mounts}}{{if eq .Destination "/app/db"}}{{.Name}}:{{.Type}}{{end}}{{end}}') || fail 'cannot inspect live database mount'
[ "$db_mount" = pi3_pi3-db:volume ] || fail 'live database volume identity/mount differs'
docker volume inspect pi3_pi3-db >/dev/null || fail 'live database volume is missing'
curl -fsS http://127.0.0.1:8080/api/health >/dev/null || fail 'internal application health check failed'
systemctl is-active --quiet pi3-backup.timer || fail 'daily backup timer is not active'
systemctl is-active --quiet pi3-backup-alert-check.timer || fail 'backup alert timer is not active'
[ -s "$BACKUP_DIR/manifest.jsonl" ] || fail 'backup manifest is missing/empty'
backup=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.db.age' -print -quit)
[ -n "$backup" ] || fail 'no encrypted backup artifact is present'

# Build a complete removal plan before any mutation. Unreferenced/dangling images
# and ambiguous aliases are not guessed at; they block cleanup.
all_images=$(docker image ls -aq --no-trunc | sort -u) || fail 'cannot inventory images'
[ -n "$all_images" ] || fail 'Docker image inventory is empty'
managed_ids=''
remove_images=''
for image_id in $all_images; do
  canonical_id=$(docker image inspect "$image_id" --format '{{.Id}}') || fail "cannot inspect image $image_id"
  refs=$(image_refs "$canonical_id") || fail "cannot inspect image references for $canonical_id"
  revision=$(image_label "$canonical_id" 'org.opencontainers.image.revision')
  image_profile=$(image_label "$canonical_id" 'org.pi3.deployment-profile')
  if [ -z "$refs" ]; then
    fail "unreferenced image has unknown ownership: $canonical_id"
  fi
  is_managed=0
  has_unmanaged=0
  for ref in $refs; do
    if managed_ref "$ref"; then
      is_managed=1
    else
      has_unmanaged=1
    fi
  done
  if [ "$is_managed" -eq 0 ]; then
    if [ "$revision" != '' ] && [ "$revision" != '<no value>' ] || \
       [ "$image_profile" != '' ] && [ "$image_profile" != '<no value>' ]; then
      fail "PI3-labeled image has an unexpected repository reference: $canonical_id"
    fi
    continue
  fi
  [ "$has_unmanaged" -eq 0 ] || fail "PI3 image has an unmanaged alias: $canonical_id"
  managed_ids="$managed_ids
$canonical_id"
  if [ "$canonical_id" != "$current_id" ] && [ "$canonical_id" != "$previous_id" ]; then
    remove_images="$remove_images
$canonical_id"
    for ref in $refs; do
      case "$ref" in
        ghcr.io/bkmz2000/pi3@sha256:*) valid_digest_ref "$ref" || fail "malformed PI3 image digest alias: $ref" ;;
        ghcr.io/bkmz2000/pi3:*|pi3:*) ;;
        *) fail "unknown PI3 image alias: $ref" ;;
      esac
      if grep -Fq -- "$ref" docker-compose.yml .env; then
        fail "stale image remains referenced by Compose/.env: $ref"
      fi
    done
  fi
done

has_line "$current_id" "$managed_ids" || fail 'current image is not in the managed image inventory'
has_line "$previous_id" "$managed_ids" || fail 'previous image is not in the managed image inventory'

# Validate all container references and collect eligible stopped app containers.
# A non-empty writable layer, non-pi3 dependency, or unexpected state aborts the
# whole plan before the first `docker rm`.
containers=$(docker ps -aq --no-trunc | sort -u) || fail 'cannot inventory containers'
container_removals=''
current_count=0
for container_id in $containers; do
  name=$(docker inspect "$container_id" --format '{{.Name}}') || fail "cannot inspect container $container_id"
  name=${name#/}
  image_id=$(docker inspect "$container_id" --format '{{.Image}}') || fail "cannot read image for container $container_id"
  state=$(docker inspect "$container_id" --format '{{.State.Status}}') || fail "cannot read state for container $container_id"
  project=$(docker inspect "$container_id" --format '{{if .Config.Labels}}{{index .Config.Labels "com.docker.compose.project"}}{{end}}') || fail "cannot read project label for $container_id"
  service=$(docker inspect "$container_id" --format '{{if .Config.Labels}}{{index .Config.Labels "com.docker.compose.service"}}{{end}}') || fail "cannot read service label for $container_id"
  image_is_managed=0
  has_line "$image_id" "$managed_ids" && image_is_managed=1
  is_pi3_app=0
  [ "$project" = pi3 ] && [ "$service" = pi3 ] && is_pi3_app=1
  if [ "$is_pi3_app" -eq 1 ] && [ "$image_is_managed" -eq 0 ]; then
    fail "pi3 app container uses an image outside the managed image inventory: $container_id"
  fi

  if [ "$name" = pi3 ] && [ "$is_pi3_app" -eq 1 ] && [ "$state" = running ] && [ "$image_id" = "$current_id" ]; then
    current_count=$((current_count + 1))
    continue
  fi
  if [ "$is_pi3_app" -eq 1 ]; then
    case "$state" in
      exited|dead)
        diff=$(docker diff "$container_id") || fail "cannot check writable layer for stopped pi3 container $container_id"
        [ -z "$diff" ] || fail "stopped pi3 container has writable changes: $container_id"
        container_removals="$container_removals
$container_id"
        ;;
      *) fail "unexpected pi3 app container/state: $name ($state)" ;;
    esac
  elif [ "$image_is_managed" -eq 1 ] && has_line "$image_id" "$remove_images"; then
    fail "non-pi3 container depends on a stale PI3 image: $container_id"
  elif [ "$name" = pi3 ]; then
    fail 'container named pi3 does not match verified running application identity'
  fi
done
[ "$current_count" -eq 1 ] || fail "expected exactly one verified running pi3 container, found $current_count"

printf 'Finalized release %s: preserving current %s and immediate prior %s.\n' \
  "$RELEASE_SHA" "$current_image" "$previous_image"
printf 'Plan: %s stopped pi3 container(s), %s stale pi3 image(s).\n' \
  "$(printf '%s\n' "$container_removals" | sed '/^$/d' | wc -l | tr -d ' ')" \
  "$(printf '%s\n' "$remove_images" | sed '/^$/d' | wc -l | tr -d ' ')"
for container_id in $container_removals; do echo "  container $container_id"; done
for image_id in $remove_images; do echo "  image $image_id"; done

if [ "$MODE" = --dry-run ]; then
  echo 'Dry run only; no containers, images, volumes, backups, or markers changed.'
  exit 0
fi

available_bytes() { df -B1 / | awk 'NR == 2 { print $4 }'; }
before_free=$(available_bytes) || fail 'cannot measure available disk space'
case "$before_free" in ''|*[!0-9]*) fail 'invalid free-space measurement' ;; esac

# Remove only empty-writable-layer stopped pi3 app containers, without -v.
for container_id in $container_removals; do
  docker rm "$container_id" || fail "could not remove stopped pi3 container $container_id"
done
# Image IDs were all checked as repo-owned and unreferenced after those
# containers; docker image rm is deliberately non-force and ID-specific.
for image_id in $remove_images; do
  docker image rm "$image_id" || fail "could not remove stale pi3 image $image_id"
done

for protected_id in "$current_id" "$previous_id"; do
  docker image inspect "$protected_id" >/dev/null || fail "protected release image disappeared: $protected_id"
done
remaining_managed=0
for image_id in $(docker image ls -aq --no-trunc | sort -u); do
  refs=$(image_refs "$image_id") || fail "cannot verify remaining image $image_id"
  for ref in $refs; do
    if managed_ref "$ref"; then remaining_managed=$((remaining_managed + 1)); break; fi
  done
done
[ "$remaining_managed" -eq 2 ] || fail "expected exactly two retained pi3 images, found $remaining_managed"
[ "$(cat .pi3-current-release-sha)" = "$RELEASE_SHA" ] || fail 'current release changed during cleanup'
[ "$(cat .pi3-current-image)" = "$current_image" ] || fail 'current image marker changed during cleanup'
for marker in .pi3-compose.previous .pi3-compose.rollback .pi3-previous-image \
  .pi3-previous-release-sha .pi3-canary-passed-at .pi3-watch-started-at; do
  if [ -e "$marker" ] || [ -L "$marker" ]; then fail "release marker appeared during cleanup: $marker"; fi
done
[ "$(docker inspect pi3 --format '{{.Config.Image}}')" = "$current_image" ] || fail 'running image changed during cleanup'
[ "$(docker inspect pi3 --format '{{.State.Status}}')" = running ] || fail 'pi3 stopped during cleanup'
remaining_containers=$(docker ps -aq --no-trunc | sort -u) || fail 'cannot verify post-cleanup containers'
for container_id in $remaining_containers; do
  project=$(docker inspect "$container_id" --format '{{if .Config.Labels}}{{index .Config.Labels "com.docker.compose.project"}}{{end}}') || fail "cannot verify container $container_id"
  service=$(docker inspect "$container_id" --format '{{if .Config.Labels}}{{index .Config.Labels "com.docker.compose.service"}}{{end}}') || fail "cannot verify container $container_id"
  state=$(docker inspect "$container_id" --format '{{.State.Status}}') || fail "cannot verify container $container_id"
  if [ "$project" = pi3 ] && [ "$service" = pi3 ] && [ "$state" != running ]; then
    fail "stopped pi3 app container remains after cleanup: $container_id"
  fi
done
curl -fsS http://127.0.0.1:8080/api/health >/dev/null || fail 'post-cleanup health check failed'
docker volume inspect pi3_pi3-db >/dev/null || fail 'live data volume is missing after cleanup'
[ "$(docker inspect pi3 --format '{{range .Mounts}}{{if eq .Destination "/app/db"}}{{.Name}}:{{.Type}}{{end}}{{end}}')" = pi3_pi3-db:volume ] || fail 'live data volume mount changed'
systemctl is-active --quiet pi3-backup.timer || fail 'daily backup timer stopped during cleanup'
systemctl is-active --quiet pi3-backup-alert-check.timer || fail 'backup alert timer stopped during cleanup'
[ -s "$BACKUP_DIR/manifest.jsonl" ] || fail 'backup manifest disappeared during cleanup'
after_free=$(available_bytes) || fail 'cannot measure post-cleanup disk space'
case "$after_free" in ''|*[!0-9]*) fail 'invalid post-cleanup free-space measurement' ;; esac
freed=$((after_free - before_free))
printf '✓ pi3 cleanup complete; df available bytes %s -> %s (delta %+d). Backups, manifest, DB volume, and release markers were not modified.\n' \
  "$before_free" "$after_free" "$freed"
