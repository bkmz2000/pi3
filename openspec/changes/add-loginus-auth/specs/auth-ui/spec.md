# Auth UI - Specification

## Overview

Login/logout user interface components integrated into the pi3 header.

## ADDED Requirements

### Requirement: Login button
When unauthenticated, the system SHALL display a "Sign In" button in the header.

### Requirement: Authenticated header
When authenticated, the system SHALL display user avatar/name and a dropdown menu in the header.

### Requirement: User menu
The system SHALL show a dropdown menu on click containing: user name/email, and logout option.

### Requirement: Logout option
The system SHALL clear session and initiate SLO when user clicks logout in the menu.

### Requirement: Loading state
During auth initialization, the system SHALL show a loading indicator instead of login button or user info.

### Requirement: First-run login gate
The system SHALL redirect to login screen before allowing editor access when unauthenticated.

## Scenarios

#### Scenario: Unauthenticated user sees login button
- **WHEN** user is not logged in
- **THEN** header shows "Sign In" button

#### Scenario: Authenticated user sees avatar
- **WHEN** user is logged in with name "Ivan Ivanov"
- **THEN** header shows avatar/initials and "Ivan" label

#### Scenario: Clicking avatar shows menu
- **WHEN** authenticated user clicks avatar
- **THEN** dropdown shows name, email, and "Sign Out" option

#### Scenario: Clicking Sign Out
- **WHEN** user clicks "Sign Out"
- **THEN** system logs out and redirects appropriately

#### Scenario: Auth loading state
- **WHEN** app is initializing auth
- **THEN** header shows loading spinner
