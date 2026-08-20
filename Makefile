GITHUB_USER := bkmz2000
IMAGE       := ghcr.io/$(GITHUB_USER)/pi3
SHA         := $(shell git rev-parse --short HEAD)

-include .env
-include Makefile.local

# Auto-detect: TURSO_DATABASE_URL set → vercel, else → vps
DEPLOY_TARGET ?= $(if $(TURSO_DATABASE_URL),vercel,vps)

# Deployment profile baked into the client bundle: institutional | public.
# VPS defaults to institutional (skips landing); Vercel defaults to public.
DEPLOYMENT_PROFILE ?= $(if $(filter vercel,$(DEPLOY_TARGET)),public,institutional)

.PHONY: deploy vps vercel build push remote-deploy test install-hooks rollback e2e e2e-smoke docker-e2e

test:
	docker build -f Dockerfile.test -t pi3-test:latest .
	docker run --rm pi3-test:latest

# E2E gate: builds the app, serves it, and runs the Puppeteer suites.
# Not part of `make test` (needs a chromium-capable environment); run
# explicitly in CI or before releases. See scripts/run-e2e.sh.
e2e:
	scripts/run-e2e.sh

e2e-smoke:
	E2E_SMOKE_ONLY=1 scripts/run-e2e.sh

docker-e2e:
	scripts/test-docker.sh

# Usage: make deploy        (auto-detect from .env)
#        make deploy vps    (explicit VPS)
#        make deploy vercel (explicit Vercel)
deploy:
	@if echo " $(MAKECMDGOALS) " | grep -q " vercel "; then \
		$(MAKE) _do-vercel; \
	elif echo " $(MAKECMDGOALS) " | grep -q " vps "; then \
		$(MAKE) _do-vps; \
	else \
		echo "→ Auto-detected target: $(DEPLOY_TARGET)"; \
		$(MAKE) _do-$(DEPLOY_TARGET); \
	fi

# No-op targets consumed by deploy's MAKECMDGOALS check
vps vercel: ;@:

# ── VPS path ──────────────────────────────────────────────────────────
_do-vps: test build push remote-deploy

build:
	@echo "→ Building with DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE)"
	docker build \
		--build-arg DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE) \
		-t $(IMAGE):$(SHA) -t $(IMAGE):latest .

push:
	@echo "→ Logging in to GHCR..."
	@gh auth token | docker login ghcr.io -u $(GITHUB_USER) --password-stdin
	# Snapshot current registry :latest as :previous for rollback.
	# Use registry-side retag (buildx imagetools) so the local :latest tag
	# produced by `make build` is NOT clobbered by a `docker pull :latest`.
	-docker buildx imagetools create --tag $(IMAGE):previous $(IMAGE):latest
	docker push $(IMAGE):$(SHA)
	docker push $(IMAGE):latest

remote-deploy:
	@echo "→ Deploying on VPS..."
	@ssh $(VPS) " \
		set -e && \
		cd /app/pi3 && \
		docker compose pull && \
		docker compose up -d && \
		echo '✓ Done' \
	"

# :previous lives only in the registry (push retags it there), so pull it
# before the local retag or the tag step fails on a fresh VPS.
rollback:
	@ssh $(VPS) " \
		set -e && \
		cd /app/pi3 && \
		docker pull $(IMAGE):previous && \
		docker compose stop && \
		docker tag $(IMAGE):previous $(IMAGE):latest && \
		docker compose up -d && \
		echo '✓ Rolled back' \
	"

# ── Vercel path ───────────────────────────────────────────────────────
_do-vercel: test
	VITE_DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE) vercel --prod

install-hooks:
	cp scripts/pre-push .git/hooks/pre-push
	chmod +x .git/hooks/pre-push