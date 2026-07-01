GITHUB_USER := bkmz2000
IMAGE       := ghcr.io/$(GITHUB_USER)/pi3
SHA         := $(shell git rev-parse --short HEAD)

-include .env
-include Makefile.local

# Auto-detect: TURSO_DATABASE_URL set → vercel, else → vps
DEPLOY_TARGET ?= $(if $(TURSO_DATABASE_URL),vercel,vps)

.PHONY: deploy vps vercel build push remote-deploy test install-hooks rollback

test:
	docker build -f Dockerfile.test -t pi3-test:latest .
	docker run --rm pi3-test:latest

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
	docker build -t $(IMAGE):$(SHA) -t $(IMAGE):latest .

push:
	@echo "→ Logging in to GHCR..."
	@gh auth token | docker login ghcr.io -u $(GITHUB_USER) --password-stdin
	# Tag current :latest as :previous so `make rollback` has a target to revert to
	docker pull $(IMAGE):latest && docker tag $(IMAGE):latest $(IMAGE):previous && docker push $(IMAGE):previous || true
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

rollback:
	@ssh $(VPS) "cd /app/pi3 && docker compose stop && docker tag $(IMAGE):previous $(IMAGE):latest && docker compose up -d"

# ── Vercel path ───────────────────────────────────────────────────────
_do-vercel: test
	vercel --prod

install-hooks:
	cp scripts/pre-push .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
