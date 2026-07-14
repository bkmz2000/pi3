# ── Builder stage ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

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
# in one RUN so the intermediate 324MB apk layer does not persist. --unsafe-perm
# lets npm run install scripts as the current user (root inside this RUN).
COPY --chown=node:node package.json package-lock.json .npmrc ./
RUN apk add --no-cache --virtual .build-deps python3 build-base \
 && npm ci --omit=dev --unsafe-perm \
 && apk del .build-deps \
 && chown -R node:node /app

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/dist-server ./dist-server

# SQLite DB dir — backed by a named volume in docker-compose.yml
# (pi3-db:/app/db). The mkdir is a safety net for host bind-mount usage.
RUN mkdir -p /app/db && chown node:node /app/db

USER node

EXPOSE 3001

CMD ["node", "dist-server/index.js"]
