#!/bin/sh
# End the attended post-canary watch, then retire release-specific rollback files.
set -eu
VPS=${1:?VPS target required}
RELEASE_SHA=${2:?release SHA required}
case "$VPS" in *[!A-Za-z0-9_.@:-]*|'') echo 'ERROR: invalid VPS target' >&2; exit 1 ;; esac
case "$RELEASE_SHA" in *[!0123456789abcdef]*|'') echo 'ERROR: malformed release SHA' >&2; exit 1 ;; esac
[ "${#RELEASE_SHA}" -eq 40 ] || [ "${#RELEASE_SHA}" -eq 64 ] || {
  echo 'ERROR: release SHA must be 40 or 64 hexadecimal characters' >&2; exit 1;
}

# The validated SHA is the only operator-supplied value interpolated remotely.
# shellcheck disable=SC2029
ssh "$VPS" "set -eu; cd /app/pi3; \
  test -f .pi3-canary-passed-at && test ! -L .pi3-canary-passed-at; \
  read -r marked_sha marked_at < .pi3-canary-passed-at; \
  test \"\$marked_sha\" = '$RELEASE_SHA' && test \"\$(cat .pi3-current-release-sha)\" = '$RELEASE_SHA' || { echo 'ERROR: release identity changed since canary' >&2; exit 1; }; \
  case \"\$marked_at\" in *[!0-9]*|'') echo 'ERROR: invalid canary timestamp' >&2; exit 1 ;; esac; \
  now=\$(date -u +%s); test \"\$now\" -ge \"\$marked_at\" && test \"\$((now - marked_at))\" -ge 600 || { echo 'ERROR: complete the 10-minute attended watch before finalizing' >&2; exit 1; }; \
  test -s .pi3-compose.rollback && test -s .pi3-previous-image && test -s .pi3-previous-release-sha || { echo 'ERROR: rollback evidence is missing' >&2; exit 1; }; \
  current=\$(cat .pi3-current-image); test -n \"\$current\" && test \"\$(docker inspect pi3 --format '{{.Config.Image}}')\" = \"\$current\" || { echo 'ERROR: running image differs from the approved release' >&2; exit 1; }; \
  curl -fsS http://127.0.0.1:8080/api/health >/dev/null || { echo 'ERROR: app is not healthy' >&2; exit 1; }; \
  rm -f .pi3-compose.previous .pi3-compose.rollback .pi3-previous-image .pi3-previous-release-sha .pi3-canary-passed-at; \
  echo '✓ Attended watch completed; release rollback files finalized for $RELEASE_SHA'"
