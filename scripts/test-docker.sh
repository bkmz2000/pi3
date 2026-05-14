#!/bin/bash
set -e

CONTAINER_NAME="pi3-test"
IMAGE_NAME="pi3:test"
PORT=5173
TIMEOUT=30

cleanup() {
    echo "Cleaning up container..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
}
trap cleanup EXIT

echo "Building Docker image..."
docker build -t $IMAGE_NAME .

echo "Starting container..."
docker run -d -p ${PORT}:${PORT} -e PORT=${PORT} --name $CONTAINER_NAME $IMAGE_NAME npx tsx server/index.ts

echo "Waiting for server to be ready..."
elapsed=0
while ! curl -sf http://localhost:${PORT}/ > /dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ $elapsed -ge $TIMEOUT ]; then
        echo "Timeout waiting for server"
        exit 1
    fi
done
echo "Server is ready!"

echo "Running E2E tests..."
PUPPETEER_URL=http://localhost:${PORT} npm run test:puppeteer
