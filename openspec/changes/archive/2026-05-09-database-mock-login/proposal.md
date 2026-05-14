## Why

pi3 currently stores all projects in the browser's IndexedDB. While simple, this means projects are tied to a single device. Adding a backend database will enable:
- Projects accessible from any device
- Project sharing between users
- Backup and sync capabilities

We need a simple auth system (token-based) to identify users and enforce project access restrictions.

## What Changes

- Add backend server with SQLite database for project storage
- Implement token-based authentication (simple API key per user)
- Store projects, files, and assets in database
- Add API endpoints: CRUD for projects, files
- Enforce user restrictions: users can only access their own projects

## Capabilities

### New Capabilities

- `project-storage`: Backend database storing user projects with full file tree. Supports CRUD operations, file versioning, and project metadata.
- `user-auth`: Simple token-based authentication. Users receive an API token that identifies them. No OAuth, no passwords - just token-based access control.
- `project-sharing`: Ability to share projects with specific users or publicly. Includes access control (owner, editor, viewer roles).
- `storage-api`: REST API for all storage operations. Handles project/file CRUD, authentication, and sharing.

### Modified Capabilities

- (none)

## Impact

- **New dependencies**: Express.js, better-sqlite3 (server)
- **Backend**: New `server/` directory with API implementation
- **Database**: SQLite schema for users, projects, files, shares
- **Frontend**: Zustand store additions for remote project sync
- **Breaking**: Storage layer changes from IndexedDB-only to API-backed