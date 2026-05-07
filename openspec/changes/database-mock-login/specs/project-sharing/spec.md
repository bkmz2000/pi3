## ADDED Requirements

### Requirement: Share project with user
The system SHALL allow owners to share projects with other users by email.

#### Scenario: Owner shares project
- **WHEN** POST /api/projects/:id/share with target user email and role
- **THEN** share record is created and user can access project

#### Scenario: Share with non-existent user
- **WHEN** POST /api/projects/:id/share with non-existent email
- **THEN** server returns 404 Not Found error

#### Scenario: Non-owner attempts share
- **WHEN** POST /api/projects/:id/share is called by non-owner
- **THEN** server returns 403 Forbidden error

### Requirement: Remove project share
The system SHALL allow owners to remove shares.

#### Scenario: Owner removes share
- **WHEN** DELETE /api/projects/:id/share/:userId is called by project owner
- **THEN** share record is deleted and user loses access

#### Scenario: Non-owner removes share
- **WHEN** DELETE /api/projects/:id/share/:userId is called by non-owner
- **THEN** server returns 403 Forbidden error

### Requirement: Share roles
The system SHALL support three sharing roles: owner, editor, viewer.

#### Scenario: Owner role has full access
- **WHEN** user has owner role on project
- **THEN** user can read, write, delete, and share the project

#### Scenario: Editor role can modify
- **WHEN** user has editor role on project
- **THEN** user can read and write files but cannot delete project or change shares

#### Scenario: Viewer role is read-only
- **WHEN** user has viewer role on project
- **THEN** user can only read project and files, cannot modify