## Why

pi3 currently has no CI/CD infrastructure. Developers run tests locally, and deployments are manual. This creates risk of untested code being deployed and makes it easy to skip testing before releases. With the project growing (new auth system, instructor sharing), automated testing and deployment will catch issues early and reduce friction.

## What Changes

- Add GitHub Actions workflow to run tests and lint on every pull request and push to main
- Add Docker configuration for containerized deployment
- Create deployment script that builds the Docker image and deploys to the dedicated server via SSH
- Set up auto-deploy on merge to main branch
- Add deployment notifications (optional: Slack/email on deploy success/failure)
- **BREAKING**: Requires Docker on deployment target

## Capabilities

### New Capabilities

- `automated-testing`: GitHub Actions workflow running `npm test` and `npm run lint` on PR/push. Blocks merge on failure.
- `docker-build`: Dockerfile and docker-compose for building the pi3 image with all dependencies.
- `auto-deploy`: Deployment pipeline that builds Docker image, pushes to server, and restarts container on merge to main.
- `deployment-notifications`: Notifications on deploy success/failure to configured channels.

### Modified Capabilities

- (none)

## Impact

- **New files**: `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.yml`, `deploy.sh`
- **GitHub repository**: Needs GitHub Actions enabled (free for public repos, or use GitHub Enterprise)
- **Deployment target**: Dedicated server needs Docker installed
- **SSH access**: Deploy script needs SSH credentials/key configured as GitHub secrets
