#!/usr/bin/env bash
# Run comprehensive local gates and write protected evidence for this commit/profile.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail() { echo "✗ RELEASE GATE: $*" >&2; exit 1; }
sha=$(git rev-parse HEAD)
profile=${DEPLOYMENT_PROFILE:-}
case "$profile" in institutional|public) ;; *) fail 'DEPLOYMENT_PROFILE must be institutional or public' ;; esac
stamp_dir=$(git rev-parse --git-path pi3-release-gates)
mkdir -p "$stamp_dir"
chmod 700 "$stamp_dir"
[ "$(stat -c '%a' "$stamp_dir")" = 700 ] || fail 'could not secure local release-evidence directory'
stamp="$stamp_dir/${sha}-${profile}.stamp"
rm -f "$stamp" "$stamp.tmp"
scripts/release-policy-check.sh preflight

cleanup_generated_results() {
  # The gate requires a clean worktree before tests, so restoring only these
  # known generated outputs cannot discard user changes.
  git restore --worktree -- tests/puppeteer/production-test-results.json tests/puppeteer/sprite-editor-test-results.json 2>/dev/null || true
}
trap cleanup_generated_results EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

 echo '══ Local release gates (no publish/deploy) ══'
echo '→ ESLint'
npm run lint
echo '→ TypeScript (frontend + server)'
npm run typecheck
echo '→ Unit tests'
npm test -- --runInBand
echo '→ Server deployment-profile matrix'
npm run test:server:matrix
echo '→ Browser storage migration fixtures'
npm test -- --runInBand tests/unit/storage.test.ts tests/unit/anonStash.migration.test.ts
echo '→ Full browser E2E suite'
npm run test:e2e
echo '→ Production build'
npm run build
npm run build:server
echo '→ Isolated candidate migration fixture'
node scripts/test-candidate-migrations.mjs
sh -n scripts/deploy-vps.sh
sh -n scripts/rollback-vps.sh
sh -n scripts/finalize-vps.sh
sh -n scripts/vps-backup.sh
sh -n scripts/backup-retention.sh
sh -n scripts/mark-restore-verified.sh
bash -n scripts/telegram-notify.sh
bash -n scripts/backup-alert-check.sh
node --check scripts/deploy-canary.mjs
node --check scripts/verify-candidate-migrations.mjs
node --check scripts/test-candidate-migrations.mjs
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck scripts/deploy-vps.sh scripts/rollback-vps.sh scripts/finalize-vps.sh scripts/vps-backup.sh scripts/backup-retention.sh scripts/mark-restore-verified.sh scripts/telegram-notify.sh scripts/backup-alert-check.sh scripts/release-gate.sh scripts/release-policy-check.sh
fi
cleanup_generated_results
[ -z "$(git status --porcelain --untracked-files=all)" ] || fail 'tests/build modified tracked source or left untracked files'
now=$(date +%s)
umask 077
printf 'v1 %s %s %s\n' "$sha" "$profile" "$now" > "$stamp.tmp"
chmod 600 "$stamp.tmp"
mv -f "$stamp.tmp" "$stamp"
echo "✓ Local release gates passed for $sha / $profile. No image was published or deployed."
