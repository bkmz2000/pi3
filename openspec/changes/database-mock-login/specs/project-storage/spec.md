## ADDED Requirements

### Requirement: Create project
The system SHALL allow authenticated users to create new projects. Each project SHALL be associated with the creating user as owner.

#### Scenario: Create project successfully
- **WHEN** authenticated user POSTs to /api/projects with name and optional description
- **THEN** a new project is created and returned with id, name, description, created_at

#### Scenario: Create project without name
- **WHEN** authenticated user POSTs to /api/projects without name
- **THEN** server returns 400 Bad Request error

### Requirement: List user's projects
The system SHALL return all projects the user owns or has been shared with.

#### Scenario: List projects for authenticated user
- **WHEN** GET /api/projects is called by authenticated user
- **THEN** returns list of projects including owned and shared projects

#### Scenario: Empty project list
- **WHEN** user has no projects
- **THEN** returns empty array

### Requirement: Get project by ID
The system SHALL return project details if user has access (owner or shared).

#### Scenario: Get owned project
- **WHEN** GET /api/projects/:id is called by project owner
- **THEN** returns full project details

#### Scenario: Get shared project
- **WHEN** GET /api/projects/:id is called by user with shared access
- **THEN** returns project details with read-only access

#### Scenario: Get project without access
- **WHEN** GET /api/projects/:id is called by user without ownership or share
- **THEN** server returns 403 Forbidden error

### Requirement: Update project
The system SHALL allow owners and editors to update project details.

#### Scenario: Owner updates project
- **WHEN** PUT /api/projects/:id is called by project owner
- **THEN** project is updated and returned

#### Scenario: Editor updates project
- **WHEN** PUT /api/projects/:id is called by user with editor role
- **THEN** project is updated and returned

#### Scenario: Viewer updates project
- **WHEN** PUT /api/projects/:id is called by user with viewer role
- **THEN** server returns 403 Forbidden error

### Requirement: Delete project
The system SHALL allow only owners to delete projects.

#### Scenario: Owner deletes project
- **WHEN** DELETE /api/projects/:id is called by project owner
- **THEN** project and all its files are permanently deleted

#### Scenario: Non-owner deletes project
- **WHEN** DELETE /api/projects/:id is called by non-owner
- **THEN** server returns 403 Forbidden error