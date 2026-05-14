# Single Logout (SLO) - Specification

## Overview

OIDC RP-Initiated Logout implementation for coordinated session termination.

## ADDED Requirements

### Requirement: Logout initiation
The system SHALL initiate Single Logout by redirecting to Loginus end_session endpoint with appropriate parameters.

### Requirement: Post-logout redirect
After SLO completes, the system SHALL redirect user to the configured post-logout redirect URI.

### Requirement: Session cleanup
Before initiating SLO, the system SHALL clear local session data (tokens, user info).

### Requirement: State parameter
The system SHALL pass a state parameter to end_session that is returned in the post-logout redirect.

### Requirement: id_token_hint
The system SHALL pass the id_token as id_token_hint when initiating SLO to help Loginus match the session.

## Scenarios

#### Scenario: User logs out
- **WHEN** user clicks "Sign Out" in the UI
- **THEN** system clears local session, then redirects to Loginus end_session endpoint

#### Scenario: SLO completes
- **WHEN** Loginus redirects back to post_logout_redirect_uri with state
- **THEN** system processes state and shows appropriate page

#### Scenario: No post-logout redirect URI configured
- **WHEN** user logs out and no post_logout_redirect_uri is configured
- **THEN** system clears local session and redirects to Loginus without post_logout_redirect_uri parameter
