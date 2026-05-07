# Deployment Notifications - Specification

## Overview

Notifications on deploy success/failure to configured channels.

## ADDED Requirements

### Requirement: GitHub Actions summary
The system SHALL include deploy status in GitHub Actions run summary.

### Requirement: Failure notification
The system SHALL log a warning or error when deploy fails, visible in GitHub Actions.

### Requirement: Configurable webhook (future)
The system MAY support external webhooks (Slack, email) if configured.

## Scenarios

#### Scenario: Deploy success shows in summary
- **WHEN** deploy completes successfully
- **THEN** GitHub Actions summary shows green checkmark with deploy details

#### Scenario: Deploy failure shows error
- **WHEN** deploy fails
- **THEN** GitHub Actions shows red X with error message in logs
