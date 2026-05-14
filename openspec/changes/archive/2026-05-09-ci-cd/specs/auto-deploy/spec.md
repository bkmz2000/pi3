# Auto-Deploy - Specification

## Overview

Automated deployment pipeline that builds and deploys Docker image on the server when code is merged to main.

## ADDED Requirements

### Requirement: Build on server on merge
The system SHALL build the Docker image on the server when code is merged to main.

### Requirement: SSH deploy script
The system SHALL run a deploy script via SSH that pulls latest code, builds image, and restarts the container.

### Requirement: Deploy on main branch only
The system SHALL only auto-deploy when merging to main, not on feature branches.

### Requirement: Deploy notification
The system SHALL send a notification (GitHub Actions summary) on deploy success or failure.

### Requirement: Idempotent deploy
The system SHALL support re-running deploy without errors.

## Scenarios

#### Scenario: Merge to main triggers deploy
- **WHEN** PR is merged to main
- **THEN** CI SSHs to server, pulls latest code, builds Docker image, restarts container

#### Scenario: Deploy succeeds
- **WHEN** deploy script completes successfully
- **THEN** GitHub Actions shows success, app is updated on server

#### Scenario: Deploy fails on server
- **WHEN** deploy script fails (e.g., Docker not running)
- **THEN** GitHub Actions shows failure, previous container remains running

#### Scenario: Re-deploy same version
- **WHEN** same commit is re-deployed
- **THEN** image is rebuilt, container restarted without error

#### Scenario: Server-side build
- **WHEN** server builds Docker image
- **THEN** server has Docker and Node.js installed, pulls from git and builds locally