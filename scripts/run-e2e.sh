#!/usr/bin/env bash
# E2E gate runner: builds the app, starts the server, runs every Puppeteer
# suite against it, and tears everything down. Exits non-zero on any failure
# so it can gate CI (make test / pre-push).
#
# Usage:
#   scripts/run-e2e.sh                # build + serve + all suites (default)
#   PUPPETEER_URL=http://localhost:3001 scripts/run-e2e.sh --no-build
#   E2E_SMOKE_ONLY=1 scripts/run-e2e.sh   # fast smoke-only gate
#
# Requires: node, npm (build toolchain), and either a bundled chromium
# (puppeteer install) or a system chrome reachable by puppeteer.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3173}"
HOST="127.0.0.1"
BASE_URL="http://${HOST}:${PORT}"
SERVER_PID=""
LOG_FILE="${TMPDIR:-/tmp}/pi3-e2e-server.log"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "→ Stopping server (pid $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "═ E2E gate ═"
echo "Target: $BASE_URL"

if [ "${1:-}" != "--no-build" ]; then
  echo "→ Building frontend (institutional profile — the IDE is the E2E surface)..."
  VITE_DEPLOYMENT_PROFILE=institutional npm run build >/dev/null
  echo "→ Building server..."
  npm run build:server >/dev/null
fi

echo "→ Starting server on :$PORT..."
# APP_BASE_URL feeds the CORS allowlist — the gate runs on a non-default port,
# so the page's own API calls would otherwise be rejected (Origin mismatch).
PORT=$PORT HOST=$HOST APP_BASE_URL="$BASE_URL" node dist-server/index.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "→ Waiting for server..."
ready=0
for i in $(seq 1 60); do
  if curl -sf "$BASE_URL/api/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
if [ "$ready" != "1" ]; then
  echo "✗ Server did not become ready; log tail:" >&2
  tail -20 "$LOG_FILE" >&2 || true
  exit 1
fi
echo "✓ Server ready"

export PUPPETEER_URL="$BASE_URL"
export HEADLESS=true

failures=0

if [ "${E2E_SMOKE_ONLY:-0}" = "1" ]; then
  echo "→ Running smoke suite..."
  if ! node tests/puppeteer/ide-smoke-test.js; then failures=1; fi
else
  echo "→ Running smoke suite..."
  if ! node tests/puppeteer/ide-smoke-test.js; then failures=1; fi
  echo "→ Running production suite..."
  if ! node tests/puppeteer/production-test-suite.js; then failures=1; fi
  echo "→ Running sprite editor suite..."
  if ! node tests/puppeteer/sprite-editor-test-runner.js; then failures=1; fi
fi

if [ "$failures" != "0" ]; then
  echo "✗ E2E gate FAILED (server log: $LOG_FILE)" >&2
  exit 1
fi
echo "✓ E2E gate passed"