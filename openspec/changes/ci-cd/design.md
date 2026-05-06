## Context

pi3 is a browser-based React app (Vite + TypeScript). Currently:
- Tests run manually (`npm test`)
- Linting run manually (`npm run lint`)
- Deployment is manual — developer builds locally and uploads to server

With auth (Loginus) and instructor sharing in development, the risk of regressions increases. CI/CD will catch issues before they reach production.

**Constraints:**
- Deployment target: clean dedicated server with SSH access + Docker + Node.js
- No container orchestration needed beyond docker-compose
- GitHub Actions as CI (free, already integrated with GitHub)

## Goals / Non-Goals

**Goals:**
- Run tests + lint on every PR and push to main
- Block merge if tests/lint fail
- Auto-deploy to server when code merges to main
- Docker-based deployment for reproducibility

**Non-Goals:**
- Multi-environment deployments (dev/staging/prod) — single production environment
- Container orchestration (Kubernetes, Docker Swarm)
- Automated rollbacks (manual rollback via re-deploy)
- Preview deployments for PRs (future work)
- Continuous deployment from branches — only main triggers deploy

## Decisions

### 1. GitHub Actions over other CI providers

**Decision:** Use GitHub Actions for CI.

**Rationale:** GitHub repo already exists, free tier is generous, native integration. No external CI accounts to manage.

**Alternative:** CircleCI, Travis, Jenkins — all workable but add external dependency.

### 2. Server-side Docker build (no cloud build)

**Decision:** Build Docker image on the server via SSH, not in CI.

**Rationale:** Simpler pipeline — no image registry needed. Server has Docker + Node.js for building. No GHCR authentication complexity.

**Alternative:** Build in CI, push to registry, pull on server. Requires image registry (GHCR/Docker Hub) and registry authentication on server.

### 3. Direct git + docker deployment

**Decision:** CI SSHs to server, runs `git pull && docker build && docker run`.

**Rationale:** No artifacts to transfer, no registry to authenticate to. Just pull code and build.

**Alternative:** CI builds image and pushes to registry, server pulls from registry. More moving parts.

### 4. docker-compose for container management

**Decision:** Use docker-compose.yml on server.

**Rationale:** Simplifies start/stop/restart. `docker-compose up -d` is clear. Can add nginx reverse proxy later if needed.

**Alternative:** Raw `docker run` with flags, systemd units — more fragile.

## Risks / Trade-offs

[Risk] Docker on server goes down
→ **Mitigation:** `docker-compose pull && docker-compose up -d` is idempotent. Server can be manually accessed via SSH to fix.

[Risk] Image too large / slow build
→ **Mitigation:** Use multi-stage Docker build (node:build → node:production-alpine). Target <200MB.

[Risk] Secrets exposure (SSH key)
→ **Mitigation:** GitHub Actions secrets are encrypted. SSH key should be deploy-only key with limited permissions.

[Risk] Deploy breaks mid-way
→ **Mitigation:** docker-compose makes rollback simple. Use versioned image tags (v1.0.0, main-SHA).

[Trade-off] Server build vs Cloud build
→ Server build is simpler (no registry), but server needs Node.js. Cloud build keeps server clean but requires registry authentication.

## Migration Plan

1. Create `.github/workflows/ci.yml` — test-only workflow first, verify it works
2. Add Dockerfile + docker-compose.yml — test local Docker build
3. Set up server with Docker + Node.js
4. Configure SSH access from GitHub Actions
5. Add deploy workflow — SSH → git pull → docker build → restart
6. Enable branch protection — require CI pass before merge to main
7. First production deploy: manually trigger workflow or merge small PR

**Rollback:** Re-run deploy workflow — it will rebuild from previous code. Or manually `git checkout` specific version on server.

## Open Questions

1. **Image tagging strategy?** `latest` is enough for server builds since we pull by git SHA.
2. **What domain/URL does pi3 run at?** Need to know for nginx/Caddy config if we add it later.
3. **Should deploy script notify on failure?** Optional Slack webhook or email — defer for now.
4. **Playwright E2E tests in CI?** Currently `npm run test:puppeteer` requires dev server. Could run as separate job if we add start/stop dev server step.