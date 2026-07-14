#!/bin/sh
# Docker volumes mount with their host owner intact (not the image owner),
# so /app/db can appear as root:root even though the image chown'd it to
# node:node. Fix ownership here before dropping to the non-root user.
set -e

if [ "$(id -u)" = "0" ]; then
  chown -R node:node /app/db
  exec su-exec node:node "$@"
fi
exec "$@"
