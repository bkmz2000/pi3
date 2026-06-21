.PHONY: test build install-hooks deploy rollback

BRANCH ?= $(shell git branch --show-current)
SHA    := $(shell git rev-parse --short HEAD)

# Override in Makefile.local or via env: VPS=user@host make deploy
VPS ?= pi3@vps.example.com

-include Makefile.local

# Run all four CI gates inside a container that mirrors production's base image.
test:
	docker build -f Dockerfile.test -t pi3-test:latest .
	docker run --rm pi3-test:latest

# Build the production image, tagged by commit SHA for rollback.
build:
	docker build -t pi3:$(SHA) .

# One-time setup after clone.
install-hooks:
	git config core.hooksPath .githooks
	chmod +x .githooks/pre-push
	@echo "✓ Pre-push hook installed."

# Deploy main to production VPS.
deploy: test build
	@echo "→ Transferring image pi3:$(SHA) to $(VPS)..."
	docker save pi3:$(SHA) | gzip | ssh $(VPS) "gunzip | docker load"
	@echo "→ Running remote deploy..."
	ssh $(VPS) "bash -s" -- "$(SHA)" < scripts/remote-deploy.sh

# Revert production to the previously-deployed image.
rollback:
	ssh $(VPS) "bash -s" -- "rollback" < scripts/remote-deploy.sh
