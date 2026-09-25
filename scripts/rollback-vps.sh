#!/bin/sh
# Restore the previous digest-pinned image and Compose file for one failed release.
set -eu
VPS=${1:?VPS target required}
ROLLBACK_FOR_SHA=${2:?release SHA required}
IMAGE_REPO=${3:?image repository required}
case "$ROLLBACK_FOR_SHA" in *[!0123456789abcdef]*|'') echo 'ERROR: malformed release SHA' >&2; exit 1 ;; esac
[ "${#ROLLBACK_FOR_SHA}" -eq 40 ] || [ "${#ROLLBACK_FOR_SHA}" -eq 64 ] || {
  echo 'ERROR: release SHA must be 40 or 64 hexadecimal characters' >&2; exit 1;
}

rollback_tmp=".docker-compose.rollback.restore-$ROLLBACK_FOR_SHA"
# The validated release SHA and derived temporary filename are intentionally interpolated client-side.
# shellcheck disable=SC2029
ssh "$VPS" "set -eu; cd /app/pi3; \
  current=\$(cat .pi3-current-release-sha); test \"\$current\" = '$ROLLBACK_FOR_SHA' || { echo 'ERROR: requested rollback does not match current release' >&2; exit 1; }; \
  previous=\$(cat .pi3-previous-image); previous_sha=\$(cat .pi3-previous-release-sha); \
  test -n \"\$previous\" && test -s .pi3-compose.rollback || { echo 'ERROR: release-specific rollback evidence is missing' >&2; exit 1; }; \
  cp -p .pi3-compose.rollback '$rollback_tmp'; \
  mv -f '$rollback_tmp' docker-compose.yml; \
  docker compose pull pi3; docker compose up -d --no-deps pi3; \
  actual_ref=\$(docker inspect pi3 --format '{{.Config.Image}}'); test \"\$actual_ref\" = \"\$previous\" || { echo 'ERROR: rollback image reference mismatch' >&2; exit 1; }; \
  image_id=\$(docker inspect pi3 --format '{{.Image}}'); \
  actual_digest=\$(docker image inspect \"\$image_id\" --format '{{range .RepoDigests}}{{println .}}{{end}}' | grep -F '$IMAGE_REPO@sha256:' | head -n 1); \
  test \"\$actual_digest\" = \"\$previous\" || { echo 'ERROR: rollback image digest mismatch' >&2; exit 1; }; \
  curl -fsS http://127.0.0.1:8080/api/health >/dev/null; \
  printf '%s\\n' \"\$previous\" > .pi3-current-image; printf '%s\\n' \"\$previous_sha\" > .pi3-current-release-sha; \
  rm -f .pi3-compose.previous .pi3-compose.rollback .pi3-previous-image .pi3-previous-release-sha .pi3-canary-passed-at; \
  echo '✓ Release-specific rollback restored and verified:' \"\$previous\""
