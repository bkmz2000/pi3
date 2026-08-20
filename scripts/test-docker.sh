#!/bin/bash
# Containerized E2E gate: builds the runtime image, starts the app in a
# container, and runs every Puppeteer suite against it (host-side chromium).
# Mirrors scripts/run-e2e.sh but uses the production Docker image.
set -e

CONTAINER_NAME="pi3-e2e"
IMAGE_NAME="pi3:test"
PORT="${PORT:-3192}"
TIMEOUT=60

cleanup() {
    echo "Cleaning up container..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
}
trap cleanup EXIT

echo "Building Docker image (institutional profile — the IDE is the E2E surface)..."
docker build --build-arg DEPLOYMENT_PROFILE=institutional -t $IMAGE_NAME .

echo "Starting container on :${PORT}..."
docker run -d -p ${PORT}:${PORT} \
  -e PORT=${PORT} \
  -e APP_BASE_URL=http://localhost:${PORT} \
  --name $CONTAINER_NAME $IMAGE_NAME

echo "Waiting for server to be ready..."
elapsed=0
while ! curl -sf http://localhost:${PORT}/api/health > /dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge $TIMEOUT ]; then
        echo "Timeout waiting for server"
        exit 1
    fi
done
echo "Server is ready!"

export PUPPETEER_URL="http://localhost:${PORT}"
failures=0

echo "Running smoke suite..."
node tests/puppeteer/ide-smoke-test.js || failures=1
echo "Running production suite..."
node tests/puppeteer/production-test-suite.js || failures=1
echo "Running sprite editor suite..."
node tests/puppeteer/sprite-editor-test-runner.js || failures=1

if [ "$failures" != "0" ]; then
    echo "✗ E2E (docker) gate FAILED"
    exit 1
fi
echo "✓ E2E (docker) gate passed"
