## ADDED Requirements

### Requirement: Docker-based E2E testing
The CI workflow SHALL build the Docker image and run E2E tests against the running container, not against the CI runner directly.

#### Scenario: CI builds and tests Docker image
- **WHEN** a pull request is opened or push to main occurs
- **THEN** CI SHALL build the Docker image
- **AND** CI SHALL start the container with dev server exposed on port 5173
- **AND** CI SHALL wait for the server to be ready
- **AND** CI SHALL run E2E tests against the running container
- **AND** if any test fails, CI SHALL block the push and mark the check as failed

#### Scenario: Container cleanup on test completion
- **WHEN** E2E tests complete (success or failure)
- **THEN** CI SHALL stop the container
- **AND** CI SHALL remove the container

#### Scenario: Server readiness detection
- **WHEN** CI starts the container
- **THEN** CI SHALL poll http://localhost:5173 until it responds
- **OR** CI SHALL fail the job after 30 seconds timeout

### Requirement: Configurable test URL
The E2E test runner SHALL accept a PUPPETEER_URL environment variable to determine which server URL to test against.

#### Scenario: PUPPETEER_URL is set
- **WHEN** PUPPETEER_URL environment variable is set
- **THEN** the test runner SHALL use its value as the server URL
- **AND** the test runner SHALL connect to the specified server

#### Scenario: PUPPETEER_URL is not set
- **WHEN** PUPPETEER_URL environment variable is not set
- **THEN** the test runner SHALL default to http://localhost:5173

### Requirement: npm run test:docker command
The system SHALL provide a `test:docker` npm script that builds the Docker image, starts a container with dev server, runs E2E tests against it, and cleans up.

#### Scenario: test:docker runs successfully
- **WHEN** `npm run test:docker` is executed
- **THEN** the system SHALL build the Docker image tagged `pi3:test`
- **AND** the system SHALL start the container with `npm run dev`
- **AND** the system SHALL expose port 5173
- **AND** the system SHALL wait for server readiness
- **AND** the system SHALL run E2E tests with PUPPETEER_URL=http://localhost:5173
- **AND** the system SHALL stop the container on completion
- **AND** the system SHALL exit with the test result code

#### Scenario: test:docker cleans up on failure
- **WHEN** E2E tests fail during `npm run test:docker`
- **THEN** the system SHALL stop and remove the container
- **AND** the system SHALL exit with code 1
