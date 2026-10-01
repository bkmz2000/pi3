GITHUB_USER := bkmz2000
IMAGE       := ghcr.io/$(GITHUB_USER)/pi3
SHA         := $(shell git rev-parse HEAD)

-include .env
-include Makefile.local

APP_BASE_URL ?= https://pi3.sys5.ru
PI3_CANARY_BASE_URL ?= $(APP_BASE_URL)
DEPLOY_TARGET ?= $(if $(TURSO_DATABASE_URL),vercel,vps)
DEPLOYMENT_PROFILE ?= $(if $(filter vercel,$(DEPLOY_TARGET)),public,institutional)
CANDIDATE_IMAGE_REF ?=
PI3_RELEASE_APPROVAL ?=
override PI3_RELEASE_APPROVAL_ORIGIN := $(origin PI3_RELEASE_APPROVAL)
export VPS BACKUP_AGE_RECIPIENT APP_BASE_URL PI3_CANARY_BASE_URL PI3_CANARY_USER_ID
export DEPLOYMENT_PROFILE CANDIDATE_IMAGE_REF PI3_RELEASE_APPROVAL PI3_RELEASE_APPROVAL_ORIGIN

.PHONY: deploy vps vercel _candidate-vps _candidate-vercel build push release-gate release-policy-check promote-vps finalize-vps rollback test install-hooks e2e e2e-smoke docker-e2e

test:
	docker build -f Dockerfile.test -t pi3-test:latest .
	docker run --rm pi3-test:latest

e2e:
	scripts/run-e2e.sh

e2e-smoke:
	E2E_SMOKE_ONLY=1 scripts/run-e2e.sh

docker-e2e:
	scripts/test-docker.sh

# `make deploy vps` prepares and publishes a candidate only. Production promotion
# is a separate, explicit command after reviewing the immutable digest/evidence.
deploy:
	@if echo " $(MAKECMDGOALS) " | grep -q " vercel "; then \
		$(MAKE) _candidate-vercel; \
	elif echo " $(MAKECMDGOALS) " | grep -q " vps "; then \
		$(MAKE) _candidate-vps; \
	else \
		$(MAKE) _candidate-$(DEPLOY_TARGET); \
	fi

vps vercel: ;@:

_candidate-vps:
	@test -n "$(VPS)" || { echo 'ERROR: Set VPS in Makefile.local so the candidate report binds the intended host' >&2; exit 1; }
	@$(MAKE) release-gate DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE)
	@$(MAKE) build DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE)
	@$(MAKE) push
	@docker pull $(IMAGE):$(SHA) >/dev/null
	@candidate=$$(docker image inspect $(IMAGE):$(SHA) --format '{{range .RepoDigests}}{{println .}}{{end}}' | grep -F '$(IMAGE)@sha256:' | head -n 1); \
	  test -n "$$candidate" || { echo 'ERROR: registry did not provide a digest-pinned candidate' >&2; exit 1; }; \
	  echo; echo 'Candidate published; no production deployment was attempted.'; \
	  echo 'Review these exact inputs, obtain explicit product-owner approval, then run:'; \
	  echo "  make promote-vps CANDIDATE_IMAGE_REF='$$candidate' PI3_RELEASE_APPROVAL='APPROVE $(SHA) $$candidate $(DEPLOYMENT_PROFILE) $(VPS) $${APP_BASE_URL%/}'"

_candidate-vercel:
	@echo 'ERROR: Vercel production deployment is disabled until equivalent restore, rollback, and canary safeguards are verified.' >&2
	@exit 1

release-gate:
	@DEPLOYMENT_PROFILE='$(DEPLOYMENT_PROFILE)' scripts/release-gate.sh

# This target requires a one-time approval supplied on the command line, bound
# to the exact commit, digest, profile, host, and origin. Never store approval in
# Makefile.local or environment configuration.
release-policy-check:
	@scripts/release-policy-check.sh deploy

build:
	@echo "→ Building with DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE)"
	docker build \
		--build-arg DEPLOYMENT_PROFILE=$(DEPLOYMENT_PROFILE) \
		--build-arg BUILD_ID=$(SHA) \
		-t $(IMAGE):$(SHA) .

# Publishing a candidate is not production promotion. Promotion uses the exact digest.
push:
	@echo "→ Logging in to GHCR..."
	@gh auth token | docker login ghcr.io -u $(GITHUB_USER) --password-stdin
	docker push $(IMAGE):$(SHA)
	@echo "→ Published candidate tag $(IMAGE):$(SHA)"

# One public production entry point: READY permits an attempt, not success.
# Check the exact gate/approval, back up, promote the immutable digest, then
# require the authenticated API/UI canary, then keep rollback evidence until
# the operator finishes the 10-minute attended watch with make finalize-vps.
promote-vps: release-policy-check
	@docker pull "$(CANDIDATE_IMAGE_REF)" >/dev/null
	@test "$$(docker image inspect "$(CANDIDATE_IMAGE_REF)" --format '{{range .RepoDigests}}{{println .}}{{end}}' | grep -F '$(IMAGE)@sha256:' | head -n 1)" = "$(CANDIDATE_IMAGE_REF)" || { echo 'ERROR: local image does not match the approved immutable candidate' >&2; exit 1; }
	@test "$$(docker image inspect "$(CANDIDATE_IMAGE_REF)" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$(SHA)" || { echo 'ERROR: candidate image revision label does not match HEAD' >&2; exit 1; }
	@test "$$(docker image inspect "$(CANDIDATE_IMAGE_REF)" --format '{{index .Config.Labels "org.pi3.deployment-profile"}}')" = "$(DEPLOYMENT_PROFILE)" || { echo 'ERROR: candidate image profile label differs from approval' >&2; exit 1; }
	@ssh $(VPS) "set -eu; cd /app/pi3; test ! -e .pi3-compose.previous && test ! -L .pi3-compose.previous && test ! -e .pi3-compose.rollback && test ! -L .pi3-compose.rollback && test ! -e .pi3-previous-image && test ! -L .pi3-previous-image && test ! -e .pi3-previous-release-sha && test ! -L .pi3-previous-release-sha && test ! -e .pi3-canary-passed-at && test ! -L .pi3-canary-passed-at || { echo 'ERROR: prior promotion/rollback/watch state needs operator reconciliation' >&2; exit 1; }"
	@scp scripts/deploy-vps.sh $(VPS):/tmp/pi3-deploy-vps-$(SHA).sh
	@scp docker-compose.yml $(VPS):/app/pi3/docker-compose.yml.new-$(SHA)
	@ssh $(VPS) "set -eu; cd /app/pi3; cp -p docker-compose.yml .pi3-compose.previous; \
	  restore_compose() { status=\$$?; trap - EXIT HUP INT TERM; \
	    if [ \$$status -ne 0 ]; then \
	      if [ -f .pi3-compose.rollback ]; then cp -p .pi3-compose.rollback docker-compose.yml; \
	      elif [ -f .pi3-compose.previous ]; then mv -f .pi3-compose.previous docker-compose.yml; fi; \
	    fi; rm -f /tmp/pi3-deploy-vps-$(SHA).sh docker-compose.yml.new-$(SHA); exit \$$status; }; \
	  trap restore_compose EXIT HUP INT TERM; mv -f docker-compose.yml.new-$(SHA) docker-compose.yml; \
	  chmod 700 /tmp/pi3-deploy-vps-$(SHA).sh; \
	  /tmp/pi3-deploy-vps-$(SHA).sh '$(CANDIDATE_IMAGE_REF)' '$(SHA)' '$(BACKUP_AGE_RECIPIENT)' '$(APP_BASE_URL)' '$(DEPLOYMENT_PROFILE)'"
	@if node scripts/deploy-canary.mjs && \
	  ssh $(VPS) "set -eu; cd /app/pi3; test \"\$$(cat .pi3-current-release-sha)\" = '$(SHA)'; test \"\$$(cat .pi3-current-image)\" = '$(CANDIDATE_IMAGE_REF)'" && \
	  ssh $(VPS) "set -eu; cd /app/pi3; umask 077; printf '%s %s\\n' '$(SHA)' \"\$$(date -u +%s)\" > .pi3-canary-passed-at.tmp; mv -f .pi3-canary-passed-at.tmp .pi3-canary-passed-at"; then \
	    echo '✓ Candidate identity, health, and API/UI canary verified; rollback evidence retained.'; \
	    echo "  Watch for 10 minutes, then make finalize-vps FINALIZE_FOR_SHA=$(SHA)"; \
	  else \
	    echo 'ERROR: canary or deployed-artifact identity check failed; rolling back this exact release.' >&2; \
	    scripts/rollback-vps.sh '$(VPS)' '$(SHA)' '$(IMAGE)' || { echo 'ERROR: rollback failed; immediate operator attention required.' >&2; exit 2; }; \
	    exit 1; \
	  fi

finalize-vps:
	@test -n "$(VPS)" || { echo 'ERROR: VPS is not configured' >&2; exit 1; }
	@test "$(origin FINALIZE_FOR_SHA)" = 'command line' || { echo 'ERROR: finalize requires FINALIZE_FOR_SHA on the command line' >&2; exit 1; }
	@scripts/finalize-vps.sh '$(VPS)' '$(FINALIZE_FOR_SHA)'
	@env -u PI3_CLEANUP_TESTING -u PI3_CLEANUP_TEST_ROOT -u PI3_CLEANUP_TEST_BACKUP_DIR ssh '$(VPS)' "sh -s -- --apply '$(FINALIZE_FOR_SHA)'" < scripts/cleanup-vps-images.sh

rollback:
	@test -n "$(VPS)" || { echo 'ERROR: VPS is not configured' >&2; exit 1; }
	@test "$(origin ROLLBACK_FOR_SHA)" = 'command line' || { echo 'ERROR: rollback requires ROLLBACK_FOR_SHA on the command line' >&2; exit 1; }
	@scripts/rollback-vps.sh '$(VPS)' '$(ROLLBACK_FOR_SHA)' '$(IMAGE)'

install-hooks:
	cp scripts/pre-push .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
