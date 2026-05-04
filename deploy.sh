#!/bin/bash
set -e

IMAGE="${1:-ghcr.io/rennorb/pi3:latest}"
CONTAINER_NAME="pi3"

echo "Deploying $IMAGE..."

# Pull the image
docker pull "$IMAGE"

# Stop existing container if running
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Run new container
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p 80:5173 \
  -v pi3-data:/app/data \
  "$IMAGE"

echo "Deploy complete: $CONTAINER_NAME running $IMAGE"