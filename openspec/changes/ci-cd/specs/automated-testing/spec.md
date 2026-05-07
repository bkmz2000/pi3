# Automated Testing - Specification

## Overview

GitHub Actions workflow running tests and linting on every pull request and push to main.

## ADDED Requirements

### Requirement: CI workflow on PR
The system SHALL run `npm test` and `npm run lint` on every pull request.

### Requirement: CI workflow on push to main
The system SHALL run `npm test` and `npm run lint` on every push to the main branch.

### Requirement: Block merge on failure
The system SHALL report CI status on PR and block merge if tests or lint fail.

### Requirement: Test results visibility
The system SHALL display test results in the GitHub PR checks interface.

### Requirement: Parallel jobs
The system SHOULD run tests and lint in parallel jobs for faster feedback.

## Scenarios

#### Scenario: PR passes all checks
- **WHEN** developer opens PR with passing tests and lint
- **THEN** CI shows green checkmark, merge is allowed

#### Scenario: PR fails tests
- **WHEN** developer opens PR with failing tests
- **THEN** CI shows red X, merge is blocked

#### Scenario: PR fails lint
- **WHEN** developer opens PR with lint errors
- **THEN** CI shows red X, merge is blocked

#### Scenario: Push to main triggers CI
- **WHEN** code is pushed directly to main
- **THEN** CI runs and results visible in commit status
