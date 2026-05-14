# User Session - Specification

## Overview

Zustand-based user authentication state management with session persistence.

## ADDED Requirements

### Requirement: Auth state store
The system SHALL maintain user authentication state in a Zustand store (`useAuth`).

### Requirement: Session restoration
On app load, the system SHALL attempt to restore user session by checking for valid stored tokens and refreshing if needed.

### Requirement: User info storage
The system SHALL store user profile info (id, email, firstName, lastName, preferred_username) in auth state.

### Requirement: Token access
The system SHALL provide access to the current access_token for API calls.

### Requirement: Logout action
The system SHALL provide a logout action that clears tokens, user info, and triggers SLO.

### Requirement: Auth state persistence
The system SHALL persist auth state to IndexedDB for session continuity across browser sessions.

### Requirement: Loading state
The system SHALL track auth initialization state (loading/complete) to support splash/loading screens.

### Requirement: Session expiry detection
The system SHALL detect when session has expired and notify UI accordingly.

## Scenarios

#### Scenario: Session restored on app load
- **WHEN** app loads with stored tokens
- **THEN** system validates tokens and restores user session if valid

#### Scenario: No session available
- **WHEN** app loads with no stored tokens
- **THEN** system remains in unauthenticated state

#### Scenario: Session expired
- **WHEN** stored token is expired and refresh fails
- **THEN** system clears session and sets expired flag

#### Scenario: User logs out
- **WHEN** user clicks logout
- **THEN** system clears local state and initiates SLO
