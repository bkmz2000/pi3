#!/usr/bin/env bash
# Fail-closed policy check for promotion of one reviewed immutable artifact.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MODE=${1:-deploy}
fail() { echo "✗ RELEASE POLICY: $*" >&2; exit 1; }

sha=$(git rev-parse HEAD)
[ "$(git branch --show-current)" = production ] || fail 'releases must be prepared from the production branch'
[ -z "$(git status --porcelain --untracked-files=all)" ] || fail 'working tree must be clean and fully committed'
profile=${DEPLOYMENT_PROFILE:-}
case "$profile" in institutional|public) ;; *) fail 'DEPLOYMENT_PROFILE must be institutional or public' ;; esac

if [ "$MODE" = preflight ]; then
  echo '✓ Clean production commit and deployment profile verified for local gates.'
  exit 0
fi
[ "$MODE" = deploy ] || fail "unknown policy-check mode: $MODE"

# READY attests pre-promotion prerequisites, not a canary on the new image.
# The exact gate stamp and digest-bound approval below remain separate checks;
# Makefile runs the production canary after switching, then rolls back on failure.
grep -Fqx '**Release gate status: READY**' docs/deployment-data-safety.md || \
  fail 'docs/deployment-data-safety.md is not READY for controlled promotion; resolve pre-promotion blockers first'
[ -n "${VPS:-}" ] || fail 'VPS must be explicitly configured'
case "$VPS" in *[!A-Za-z0-9_.@:-]*) fail 'VPS must be a single SSH host target (no options or shell metacharacters)' ;; esac
[ -n "${BACKUP_AGE_RECIPIENT:-}" ] || fail 'BACKUP_AGE_RECIPIENT must be configured'
case "$BACKUP_AGE_RECIPIENT" in age1*) ;; *) fail 'BACKUP_AGE_RECIPIENT is not an age recipient' ;; esac
case "$BACKUP_AGE_RECIPIENT" in *[!a-z0-9]*) fail 'BACKUP_AGE_RECIPIENT contains invalid characters' ;; esac
[ -n "${PI3_CANARY_USER_ID:-}" ] || fail 'PI3_CANARY_USER_ID must be configured for the dedicated canary account'
[ -n "${APP_BASE_URL:-}" ] || fail 'APP_BASE_URL must be explicitly configured'
[ "${PI3_CANARY_BASE_URL:-}" = "$APP_BASE_URL" ] || fail 'canary URL must exactly match APP_BASE_URL'
node --input-type=module - "$APP_BASE_URL" <<'NODE' || fail 'APP_BASE_URL must be a bare HTTPS origin'
const value = process.argv[2];
const url = new URL(value);
if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '') || url.pathname !== '/' || url.search || url.hash || url.username || url.password) process.exit(1);
NODE

identity="$HOME/.config/age/pi3-backup-identity.txt"
[ -s "$identity" ] || fail "local age recovery identity missing: $identity"
[ "$(stat -c '%a' "$identity")" = 600 ] || fail 'local age recovery identity must have mode 600'

stamp_dir=$(git rev-parse --git-path pi3-release-gates)
stamp="$stamp_dir/${sha}-${profile}.stamp"
[ -s "$stamp" ] || fail 'full local release gate has not passed for this commit and deployment profile'
[ "$(stat -c '%u' "$stamp")" = "$(id -u)" ] || fail 'release-gate evidence is not owned by the current operator'
[ "$(stat -c '%a' "$stamp")" = 600 ] || fail 'release-gate evidence must have mode 600'
read -r format stamped_sha stamped_profile stamped_at < "$stamp"
[ "$format" = v1 ] && [ "$stamped_sha" = "$sha" ] && [ "$stamped_profile" = "$profile" ] || fail 'release-gate evidence does not match commit/profile'
now=$(date +%s)
[ "$stamped_at" -le "$now" ] || fail 'release-gate timestamp is in the future'
[ "$((now - stamped_at))" -le 21600 ] || fail 'release-gate evidence expired (6-hour limit)'

repo='ghcr.io/bkmz2000/pi3'
candidate=${CANDIDATE_IMAGE_REF:-}
case "$candidate" in "$repo"@sha256:*) digest=${candidate##*@sha256:} ;; *) fail 'CANDIDATE_IMAGE_REF must be the exact registry image digest from the candidate report' ;; esac
[ "${#digest}" -eq 64 ] || fail 'candidate digest must be SHA-256'
case "$digest" in *[!0123456789abcdef]*) fail 'candidate digest is malformed' ;; esac
[ "${PI3_RELEASE_APPROVAL_ORIGIN:-}" = 'command line' ] || fail 'final approval must be supplied explicitly on the make command line, not stored in configuration'
expected_approval="APPROVE $sha $candidate $profile $VPS ${APP_BASE_URL%/}"
[ "${PI3_RELEASE_APPROVAL:-}" = "$expected_approval" ] || fail "final approval must exactly match: $expected_approval"

echo "✓ Promotion approved for commit $sha, profile $profile, artifact $candidate, target $VPS, origin ${APP_BASE_URL%/}."
