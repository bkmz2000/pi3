## ADDED Requirements

### Requirement: User session state
The system SHALL maintain user session state in Zustand store.

#### Scenario: Store API token
- **WHEN** user logs in with valid credentials
- **THEN** API token is stored in localStorage and user state is updated

#### Scenario: Restore session on load
- **WHEN** app loads and localStorage has valid token
- **THEN** user state is restored by fetching /api/users/me

#### Scenario: Clear session on logout
- **WHEN** user signs out
- **THEN** token is removed from localStorage and user state is cleared

### Requirement: Projects fetch
The system SHALL fetch user's projects from backend API.

#### Scenario: Fetch projects
- **WHEN** user navigates to projects page
- **THEN** GET /api/projects is called with auth header and project list is stored

### Requirement: Project CRUD operations
The system SHALL support creating and deleting projects via API.

#### Scenario: Create project via API
- **WHEN** user creates new project
- **THEN** POST /api/projects is called, response is added to projects list

#### Scenario: Delete project via API
- **WHEN** user deletes a project
- **THEN** DELETE /api/projects/:id is called and project is removed from list

### Requirement: API error handling
The system SHALL display user-friendly errors when API calls fail.

#### Scenario: Network error
- **WHEN** API call fails due to network issue
- **THEN** user sees toast notification with "Unable to connect. Please check your internet connection."

#### Scenario: Auth error (401)
- **WHEN** API returns 401 Unauthorized
- **THEN** user is redirected to login and shown "Session expired. Please sign in again."