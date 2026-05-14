## ADDED Requirements

### Requirement: Projects page access
The system SHALL display a projects page at `/projects` when user is logged in.

#### Scenario: Access projects page while logged in
- **WHEN** user navigates to /projects and is authenticated
- **THEN** page shows list of user's projects

#### Scenario: Access projects page while logged out
- **WHEN** unauthenticated user navigates to /projects
- **THEN** page shows "Please sign in" message with "Sign In" button

### Requirement: Display user's projects
The system SHALL show all projects the user owns or has been shared with.

#### Scenario: User has projects
- **WHEN** user has owned and shared projects
- **THEN** page displays projects as cards/list with name, description, role (owner/editor/viewer), and last updated time

#### Scenario: User has no projects
- **WHEN** user has no projects
- **THEN** page shows empty state with "Create your first project" message

### Requirement: Create new project
The system SHALL allow user to create a new project.

#### Scenario: Create project button
- **WHEN** user clicks "New Project" button
- **THEN** dialog appears asking for project name

#### Scenario: Submit new project
- **WHEN** user enters "My Game" and clicks Create
- **THEN** project is created via API, page refreshes to show new project

### Requirement: Delete project
The system SHALL allow project owners to delete their projects.

#### Scenario: Delete owned project
- **WHEN** user clicks delete on an owned project card
- **THEN** confirmation dialog appears, and on confirm project is deleted via API

#### Scenario: Cannot delete shared project
- **WHEN** user clicks delete on a project shared with them (not owner)
- **THEN** delete button is not shown or disabled

### Requirement: Share project
The system SHALL allow project owners to share projects with other users.

#### Scenario: Share button
- **WHEN** user clicks share on an owned project
- **THEN** dialog appears to enter email and select role (editor/viewer)

#### Scenario: Submit share
- **WHEN** owner enters "friend@example.com" with "viewer" role
- **THEN** share request is sent to API and success feedback shown