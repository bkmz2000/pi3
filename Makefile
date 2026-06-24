GITHUB_USER := bkmz2000
IMAGE       := ghcr.io/$(GITHUB_USER)/pi3
SHA         := $(shell git rev-parse --short HEAD)

-include Makefile.local

.PHONY: deploy build push remote-deploy test

deploy: test build push remote-deploy

build:
	docker build -t $(IMAGE):$(SHA) -t $(IMAGE):latest .

push:
	@echo "→ Logging in to GHCR..."
	@gh auth token | docker login ghcr.io -u $(GITHUB_USER) --password-stdin
	@echo "→ Pushing $(IMAGE):$(SHA)..."
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
