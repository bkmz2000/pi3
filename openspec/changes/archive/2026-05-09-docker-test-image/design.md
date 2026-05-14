## Context

pi3 uses GitHub Actions CI with tests running directly on ubuntu-latest runners. The production deployment uses a Docker image built from the same codebase. Currently, tests run in a different environment than production, creating a gap where tests can pass in CI but fail in the actual Docker container.

**Current flow:**
```
ubuntu-latest → npm install → npm test → (pass) → Build image → Deploy
```

**Problem:** Tests run on ubuntu-latest, not inside the Docker container that gets deployed.

**Goal:** Test the exact image that will be deployed, running it as it would run in production.

## Goals / Non-Goals

**Goals:**
- Run tests against the actual Docker image that gets deployed to production
- Block push to GHCR if tests fail inside the container
- E2E tests execute from CI runner, hitting the running container
- Dev server runs inside container, exposed via port mapping

**Non-Goals:**
- Run tests inside the container (tests run from CI runner, against container)
- Modify the production Dockerfile (separate test dependencies not needed in prod image)
- Prod browser testing (deferred for future work)

## Decisions

### 1. Test against running container, not inside container

**Decision:** Start the Docker image with `docker run -d -p 5173:5173`, run tests from CI runner against `localhost:5173`.

**Rationale:** Simpler than running tests inside the container. Tests don't need to be in the image. CI runner's Node.js/Puppeteer works directly against the exposed port.

**Alternative:** Build test-specific image with test dependencies inside. More complex, larger image, no benefit for this use case.

### 2. PUPPETEER_URL environment variable for test URL

**Decision:** Make the E2E test runner accept `PUPPETEER_URL` env var to determine which server to test.

**Rationale:** Keeps the test script flexible. CI sets it to `http://localhost:5173`, local dev can still default to `http://localhost:5173`.

**Alternative:** Hardcode different URLs for different environments. More brittle.

### 3. Wait for server ready before running tests

**Decision:** Poll `http://localhost:5173` with retry logic until server responds or timeout.

**Rationale:** Dev server startup time is non-deterministic. Simple polling with exponential backoff is reliable and easy to implement.

### 4. Always cleanup with `docker stop`

**Decision:** Use `docker stop` in a `if: always()` step to ensure container is cleaned up even on test failure.

**Rationale:** Prevents container leakage between jobs/runs. CI runners can accumulate stopped containers if not properly cleaned.

### 5. npm run test:docker script for local Docker testing

**Decision:** Create a standalone `npm run test:docker` script that builds the Docker image, starts the container, runs E2E tests against it, and cleans up.

**Rationale:** Encapsulates the full docker test flow in one command. Can be run locally to verify the image before pushing. CI calls this script.

**Script behavior:**
```bash
npm run test:docker
# 1. docker build -t pi3:test .
# 2. docker run -d -p 5173:5173 --name pi3-test pi3:test npm run dev
# 3. Wait for server ready
# 4. PUPPETEER_URL=http://localhost:5173 npm run test:puppeteer
# 5. docker stop pi3-test (always)
# 6. Exit code from test:puppeteer
```

**Alternative:** Extend `npm test` to include docker testing. More coupled, harder to run just unit tests. Separate script is cleaner.

## Risks / Trade-offs

[Risk] Dev server startup timing
→ **Mitigation:** Poll with 1-second interval, 30-second timeout. Sufficient for most cases.

[Risk] Port 5173 already in use on CI runner
→ **Mitigation:** Use a random port mapping (`-p 5173:5173` maps host port to container port). Runner is fresh, unlikely to have port conflicts.

[Risk] Tests fail in container but pass locally
→ **Mitigation:** This is the intended behavior. Catches environment-specific issues early. Good feedback loop.

[Trade-off] Test speed
→ Tests run slightly slower due to container startup overhead (~10-15 seconds). Acceptable tradeoff for confidence.

## Migration Plan

1. Modify `ci.yml` to build image, run container, run tests against it
2. Update `production-test-suite.js` to read `PUPPETEER_URL` env var
3. Test locally with `docker build` and `docker run` before committing
4. Verify CI passes with the new workflow
5. Enable branch protection to require CI pass before merge

## Open Questions

1. **Should we also run unit tests in the container?** Currently unit tests (Jest) run in CI without the container. Could also containerize them for full parity. Defer for now.

2. **Timeout for E2E tests?** Puppeteer tests have their own timeouts. Need to ensure CI job doesn't timeout before tests complete. 5-minute job timeout should be sufficient.
