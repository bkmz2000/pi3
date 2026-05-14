## Why

Currently CI runs tests directly on ubuntu-latest runner, which has a different OS, Node.js version, and environment than the production Docker image. This means tests can pass in CI but fail in production due to environment differences. We need to test the actual image that will be deployed.

## What Changes

- CI workflow builds Docker image and runs tests against the running container
- Dev server starts inside container, exposed on port 5173
- Puppeteer E2E tests run from CI runner against the container
- `npm run test:docker` script for local Docker-based testing
- Push to GHCR blocked if tests fail
- PUPPETEER_URL made configurable via environment variable

## Impact

- `.github/workflows/ci.yml`: New job structure to build, run container, execute tests
- `tests/puppeteer/production-test-suite.js`: Accept PUPPETEER_URL env var for server URL
- `package.json`: New `test:docker` script for local Docker testing
- `docker-compose.yml`: No changes needed (testing handled in CI workflow)
