## ADDED Requirements

### Requirement: List project files
The system SHALL return the file tree for a project as a flat list with path information.

#### Scenario: List files in project
- **WHEN** GET /api/projects/:id/files is called by user with access
- **THEN** returns array of files with id, path, is_directory, created_at, updated_at

#### Scenario: List files without access
- **WHEN** GET /api/projects/:id/files is called by user without access
- **THEN** server returns 403 Forbidden error

### Requirement: Create file
The system SHALL allow creating files and directories within a project.

#### Scenario: Create text file
- **WHEN** POST /api/projects/:id/files with path and content
- **THEN** new file record is created and returned

#### Scenario: Create directory
- **WHEN** POST /api/projects/:id/files with path and is_directory=true
- **THEN** new directory record is created

#### Scenario: Create file without path
- **WHEN** POST /api/projects/:id/files without path
- **THEN** server returns 400 Bad Request error

### Requirement: Get file content
The system SHALL return file content for a specific file in a project.

#### Scenario: Get existing file
- **WHEN** GET /api/projects/:id/files/:path is called by user with access
- **THEN** returns file object with content

#### Scenario: Get non-existent file
- **WHEN** GET /api/projects/:id/files/:path with non-existent path
- **THEN** server returns 404 Not Found error

### Requirement: Update file content
The system SHALL allow updating file content for files the user can edit.

#### Scenario: Update file as owner
- **WHEN** PUT /api/projects/:id/files/:path with new content by owner
- **THEN** file content is updated and returned

#### Scenario: Update file as editor
- **WHEN** PUT /api/projects/:id/files/:path with new content by editor
- **THEN** file content is updated and returned

#### Scenario: Update file as viewer
- **WHEN** PUT /api/projects/:id/files/:path with new content by viewer
- **THEN** server returns 403 Forbidden error

### Requirement: Delete file
The system SHALL allow deleting files from a project.

#### Scenario: Delete file as owner
- **WHEN** DELETE /api/projects/:id/files/:path by owner
- **THEN** file is permanently deleted

#### Scenario: Delete file as editor
- **WHEN** DELETE /api/projects/:id/files/:path by editor
- **THEN** file is permanently deleted

#### Scenario: Delete file as viewer
- **WHEN** DELETE /api/projects/:id/files/:path by viewer
- **THEN** server returns 403 Forbidden error