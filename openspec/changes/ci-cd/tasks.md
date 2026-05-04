## 1. GitHub Actions CI Workflow

- [x] 1.1 Create `.github/workflows/ci.yml` with test and lint jobs
- [x] 1.2 Configure parallel execution for test and lint jobs
- [x] 1.3 Add PR status reporting (check runs)
- [x] 1.4 Verify workflow runs on PR open/update

## 2. Dockerfile

- [x] 2.1 Create multi-stage Dockerfile (node:build → node:production-alpine)
- [x] 2.2 Copy source and run npm install
- [x] 2.3 Build static assets with npm run build
- [x] 2.4 Test Docker build locally succeeds
- [ ] 2.5 Verify image size is reasonable (<200MB)

## 3. Docker Compose

- [x] 3.1 Create `docker-compose.yml` with pi3 service
- [x] 3.2 Add volume for persistent data (/app/data)
- [x] 3.3 Add health check configuration
- [x] 3.4 Configure port mapping (8080:5173)

## 4. GitHub Container Registry Setup

- [x] 4.1 Add login to GHCR in CI workflow
- [x] 4.2 Configure image tagging with commit SHA
- [x] 4.3 Test push to GHCR
- [x] 4.4 Set repository visibility (public)

## 5. Server Configuration

- [x] 5.1 Verify Docker is installed on server
- [x] 5.2 Set up GHCR credentials on server (`docker login ghcr.io`)
- [x] 5.3 Configure nginx reverse proxy to pi3 container
- [x] 5.4 Test HTTPS access via pi3.sys5.ru

## 6. Deploy Script

- [x] 6.1 Create `deploy.sh` script (pull image, restart container)
- [x] 6.2 Add script to repository
- [x] 6.3 Configure SSH key as GitHub Actions secret
- [x] 6.4 Test deploy script via manual CI trigger

## 7. Deploy Workflow

- [x] 7.1 Create `.github/workflows/deploy.yml`
- [x] 7.2 Add trigger on push to main branch only
- [x] 7.3 Add build → push → SSH deploy steps
- [x] 7.4 Add deploy notification to GitHub Actions summary
- [x] 7.5 Test full deploy via workflow_dispatch (image builds, manual deploy works)

## 8. Branch Protection

- [ ] 8.1 Enable required status checks in GitHub branch protection
- [ ] 8.2 Require CI pass before merge to main
- [ ] 8.3 Verify PR cannot be merged when CI fails

## 9. Documentation

- [x] 9.1 Add deployment instructions to README
- [x] 9.2 Document server setup requirements
- [x] 9.3 Document how to trigger manual deploy
- [x] 9.4 Document rollback procedure

## 10. Known Issues

- [x] 10.1 Server port 80 occupied by nginx → changed to 8080
- [x] 10.2 Docker on server needed installation via `curl -fsSL https://get.docker.com | sh`
- [x] 10.3 GHCR auth requires `docker logout` before `docker login --password-stdin`
- [x] 10.4 nginx config needed proxy_pass to localhost:8080 for HTTPS
