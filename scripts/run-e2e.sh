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
# The server uses a private per-run temp directory for both project and SQLite
# session databases, unsets Turso/Redis credentials, and requires a per-run
# health nonce so E2E cannot accept or touch an existing server.
# Requires: node, npm (build toolchain), and either a bundled chromium
# (puppeteer install) or a system chrome reachable by puppeteer.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3173}"
HOST="127.0.0.1"
BASE_URL="http://${HOST}:${PORT}"
SERVER_PID=""
E2E_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pi3-e2e-${PORT}-XXXXXX")"
LOG_FILE="$E2E_DIR/server.log"
E2E_DB_PATH="$E2E_DIR/projects.db"
E2E_INSTANCE_ID="$(node -e 'process.stdout.write(require("crypto").randomUUID())')"

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "→ Stopping server (pid $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf -- "$E2E_DIR"
}
trap cleanup EXIT INT TERM

echo "═ E2E gate ═"
echo "Target: $BASE_URL"

# Fail before starting if a server already answers on this port. The per-run
# nonce check below also prevents accepting a different server after a bind race.
if curl -fsS --max-time 1 "$BASE_URL/api/health" >/dev/null 2>&1; then
  echo "✗ E2E port $PORT already has a responding server; refusing to test the wrong process" >&2
  exit 1
fi

if [ "${1:-}" != "--no-build" ]; then
  echo "→ Building frontend (institutional profile — the IDE is the E2E surface)..."
  VITE_DEPLOYMENT_PROFILE=institutional npm run build >/dev/null
  echo "→ Building server..."
  npm run build:server >/dev/null
fi

echo "→ Starting server on :$PORT..."
# APP_BASE_URL feeds the CORS allowlist — the gate runs on a non-default port,
# so the page's own API calls would otherwise be rejected (Origin mismatch).
env -u TURSO_DATABASE_URL -u TURSO_AUTH_TOKEN -u UPSTASH_REDIS_URL \
  NODE_ENV=development SESSION_SECRET="$E2E_INSTANCE_ID" DB_PATH="$E2E_DB_PATH" \
  PI3_E2E_INSTANCE_ID="$E2E_INSTANCE_ID" PORT="$PORT" HOST="$HOST" \
  APP_BASE_URL="$BASE_URL" node dist-server/index.js >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "→ Waiting for server..."
ready=0
attempt=0
while [ "$attempt" -lt 60 ]; do
  attempt=$((attempt + 1))
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "✗ E2E server process exited during startup; log tail:" >&2
    tail -20 "$LOG_FILE" >&2 || true
    exit 1
  fi
  response=$(curl -fsS --max-time 1 "$BASE_URL/api/health" 2>/dev/null || true)
  if printf '%s' "$response" | grep -Fq "\"e2eInstance\":\"$E2E_INSTANCE_ID\""; then ready=1; break; fi
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