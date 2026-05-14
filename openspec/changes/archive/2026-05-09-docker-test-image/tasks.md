## 1. Update E2E Test Runner

- [x] 1.1 Add PUPPETEER_URL environment variable support to production-test-suite.js
- [x] 1.2 Default to http://localhost:5173 when PUPPETEER_URL is not set
- [x] 1.3 Test locally with PUPPETEER_URL=http://localhost:5173 npm run test:puppeteer

## 2. Add npm run test:docker Command

- [x] 2.1 Create test:docker script that builds Docker image
- [x] 2.2 Start container with dev server on port 5173
- [x] 2.3 Poll for server readiness
- [x] 2.4 Run E2E tests against running container
- [x] 2.5 Stop and remove container on completion (always)
- [x] 2.6 Exit with correct code (0 success, 1 failure)

## 3. Update CI Workflow

- [x] 3.1 Add job to build Docker image
- [x] 3.2 Add step to start container with port mapping (-d -p 5173:5173)
- [x] 3.3 Add server readiness polling (curl retry until responding or 30s timeout)
- [x] 3.4 Add step to run E2E tests with PUPPETEER_URL=http://localhost:5173
- [x] 3.5 Add cleanup step with docker stop (if: always())
- [x] 3.6 Block push to GHCR if container tests fail

## 4. Verification

- [ ] 4.1 Test workflow locally (docker build + docker run + test manually)
- [ ] 4.2 Verify CI passes with new workflow
- [ ] 4.3 Verify CI fails and blocks push when tests fail in container
- [ ] 4.4 Enable branch protection after confirming CI works
