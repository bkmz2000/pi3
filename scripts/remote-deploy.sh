#!/bin/bash
# Usage: bash remote-deploy.sh <sha>     (deploy)
#        bash remote-deploy.sh rollback  (revert to previous image)
set -euo pipefail

MODE="$1"
CONTAINER="pi3"
VOLUME="pi3-data"
ENV_FILE="/srv/pi3/.env"
PORT="8080"
INTERNAL_PORT="3001"
HEALTH="http://127.0.0.1:${PORT}/api/health"

if [ "${DRY_RUN:-}" = "1" ]; then
    echo "[DRY-RUN] remote-deploy.sh MODE=$MODE"
    echo "[DRY-RUN] docker stop $CONTAINER"
    echo "[DRY-RUN] docker rm $CONTAINER"
    echo "[DRY-RUN] docker run -d --name $CONTAINER --restart unless-stopped -p 127.0.0.1:${PORT}:${INTERNAL_PORT} -v ${VOLUME}:/app/db --env-file $ENV_FILE pi3:<sha>"
    exit 0
fi

if [ "$MODE" = "rollback" ]; then
    if ! docker image inspect "pi3:previous" > /dev/null 2>&1; then
        echo "ERROR: No previous image to roll back to."
        exit 1
    fi
    docker stop "$CONTAINER" 2>/dev/null || true
    docker rm "$CONTAINER" 2>/dev/null || true
    docker run -d \
        --name "$CONTAINER" \
        --restart unless-stopped \
        -p "127.0.0.1:${PORT}:${INTERNAL_PORT}" \
        -v "${VOLUME}:/app/db" \
        --env-file "$ENV_FILE" \
        "pi3:previous"
    echo "✓ Rolled back to previous image."
    exit 0
fi

SHA="$MODE"
IMAGE="pi3:${SHA}"

if ! docker image inspect "$IMAGE" > /dev/null 2>&1; then
    echo "ERROR: Image $IMAGE not found. Was it loaded?"
    exit 1
fi

# Tag current as previous for one-step rollback.
CURRENT=$(docker inspect "$CONTAINER" --format='{{.Config.Image}}' 2>/dev/null || echo "")
if [ -n "$CURRENT" ] && [ "$CURRENT" != "$IMAGE" ]; then
    docker tag "$CURRENT" "pi3:previous"
fi

docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true
docker run -d \
    --name "$CONTAINER" \
    --restart unless-stopped \
    -p "127.0.0.1:${PORT}:${INTERNAL_PORT}" \
    -v "${VOLUME}:/app/db" \
    --env-file "$ENV_FILE" \
    "$IMAGE"

# Smoke test — wait up to 30 s.
for i in $(seq 1 30); do
    if curl -fsS "$HEALTH" > /dev/null 2>&1; then
        echo "✓ Deployed ${SHA} (healthy after ${i}s)."
        exit 0
    fi
    sleep 1
done

echo "ERROR: Health check failed after 30s. Rolling back."
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true
if docker image inspect "pi3:previous" > /dev/null 2>&1; then
    docker run -d \
        --name "$CONTAINER" \
        --restart unless-stopped \
        -p "127.0.0.1:${PORT}:${INTERNAL_PORT}" \
        -v "${VOLUME}:/app/db" \
        --env-file "$ENV_FILE" \
        "pi3:previous"
    echo "↩ Previous image restored."
fi
exit 1
