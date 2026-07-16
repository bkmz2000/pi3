# ── Builder stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

ARG DEPLOYMENT_PROFILE=public
ENV VITE_DEPLOYMENT_PROFILE=$DEPLOYMENT_PROFILE

WORKDIR /app

# better-sqlite3 native build.
RUN apk add --no-cache python3 build-base

# Dependency layer first. Only the manifest + lockfile — subsequent source
# edits do not invalidate `npm ci`. Use ci (not install --legacy-peer-deps)
# so the lockfile is authoritative and drift fails loudly.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Source after deps so cached npm layer survives normal code changes.
COPY . .

# Frontend build (Vite → dist) + server compile (tsc → dist-server, migrations
# copied in the same script). Runtime image runs plain node against the
# compiled output — no npx tsx JIT transpile at cold start.
RUN npm run build && npm run build:server

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Install toolchain, install runtime-only deps (--omit=dev drops puppeteer,
# jest, eslint, testing-library, @types/*), then delete the toolchain — all
# in one RUN so the intermediate 324MB apk layer does not persist. su-exec
# is kept in the final image so the entrypoint can drop from root to node.
COPY package.json package-lock.json .npmrc ./
RUN apk add --no-cache --virtual .build-deps python3 build-base \
 && apk add --no-cache su-exec \
 && npm ci --omit=dev --unsafe-perm \
 && apk del .build-deps \
 && chown -R node:node /app

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/dist-server ./dist-server

# SQLite DB dir — backed by a named volume in docker-compose.yml
# (pi3-db:/app/db). The volume mounts with its host owner, so the entrypoint
# re-chowns /app/db to node:node before dropping privileges.
RUN mkdir -p /app/db && chown node:node /app/db

COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/pi3-entrypoint
RUN chmod +x /usr/local/bin/pi3-entrypoint

EXPOSE 3001

# Entrypoint starts as root, fixes /app/db ownership if needed, then execs
# the CMD as the node user via su-exec.
ENTRYPOINT ["/usr/local/bin/pi3-entrypoint"]
CMD ["node", "dist-server/index.js"]
