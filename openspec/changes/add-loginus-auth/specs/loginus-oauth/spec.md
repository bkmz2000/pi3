# Loginus OAuth - Specification

## Overview

OAuth 2.0 Authorization Code flow integration with Loginus identity provider.

## ADDED Requirements

### Requirement: Authorization URL generation
The system SHALL generate a valid OAuth 2.0 authorization URL with required parameters: client_id, redirect_uri, response_type, scope, and state.

### Requirement: Code exchange
The system SHALL exchange the authorization code for access_token, refresh_token, and id_token via a POST to the token endpoint.

### Requirement: Token storage
The system SHALL store access_token and refresh_token securely in IndexedDB.

### Requirement: Token refresh
The system SHALL automatically refresh expired access_tokens using the refresh_token.

### Requirement: Userinfo retrieval
The system SHALL fetch user profile information from the userinfo endpoint using a valid access_token.

### Requirement: PKCE support
The system SHOULD support PKCE (Proof Key for Code Exchange) for enhanced security.

### Requirement: State validation
The system SHALL validate the state parameter returned in the callback to prevent CSRF attacks.

### Requirement: Token expiration handling
The system SHALL detect expired tokens and attempt refresh before failing.

### Requirement: OAuth configuration
The system SHALL accept Loginus domain, client_id, client_secret, and redirect_uri as configuration values.

## Scenarios

#### Scenario: Successful OAuth login flow
- **WHEN** user clicks login and completes Loginus authentication
- **THEN** system exchanges code for tokens, stores them, and establishes user session

#### Scenario: Token refresh on expiration
- **WHEN** access_token expires and API call fails with 401
- **THEN** system attempts to refresh token; if refresh succeeds, retry original request

#### Scenario: Invalid state prevents CSRF
- **WHEN** callback state does not match stored state
- **THEN** system rejects the callback and shows error

#### Scenario: Refresh token unavailable
- **WHEN** access_token expires and no refresh_token is available
- **THEN** system clears session and prompts user to re-authenticate
