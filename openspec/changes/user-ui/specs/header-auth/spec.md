## ADDED Requirements

### Requirement: Header auth state display
The system SHALL display different header content based on authentication state: loading, logged out, or logged in.

#### Scenario: While checking auth state
- **WHEN** app is initializing and checking if user is logged in
- **THEN** header shows loading spinner

#### Scenario: User is logged out
- **WHEN** user is not authenticated
- **THEN** header shows "Sign In" button on the right side

#### Scenario: User is logged in
- **WHEN** user is authenticated with name "Ivan"
- **THEN** header shows user avatar/initials and "Ivan" label on the right side

### Requirement: Login button click
The system SHALL open a login dialog/modal when user clicks "Sign In" button.

#### Scenario: Click sign in button
- **WHEN** logged out user clicks "Sign In" button
- **THEN** login dialog appears with username/token input

### Requirement: User dropdown menu
The system SHALL show a dropdown menu when logged-in user clicks their avatar/name.

#### Scenario: Open user menu
- **WHEN** logged-in user clicks their avatar
- **THEN** dropdown shows user name and "Sign Out" option

#### Scenario: Sign out
- **WHEN** user clicks "Sign Out" in dropdown
- **THEN** session is cleared and header shows "Sign In" button

### Requirement: Access projects page
The system SHALL allow logged-in users to navigate to their projects page.

#### Scenario: Click projects link
- **WHEN** logged-in user clicks "My Projects" in menu or navigates to /projects
- **THEN** user sees their projects page