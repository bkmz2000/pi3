## Why

pi3 now has a backend API for project storage, but no UI for users to manage their projects. Users need a way to sign in, view their projects, and control them (create, delete, share).

## What Changes

- Add header auth UI (login button when logged out, user menu when logged in)
- Add user projects page listing all user's projects (owned and shared)
- Add project creation, deletion, and sharing controls
- Connect frontend state to backend API

## Capabilities

### New Capabilities

- `header-auth`: Header component with conditional login button or user menu. Shows loading state during auth check.
- `user-projects-page`: Dedicated page showing user's projects with CRUD controls (create, delete, rename, share).
- `project-api-sync`: Connect frontend project state to backend API endpoints.

### Modified Capabilities

- (none)

## Impact

- **UI**: New `UserMenu` component, `ProjectsPage`, updated `Header`
- **State**: New Zustand store slice for user session connected to backend
- **Routing**: `/projects` route for projects page
- **Backend**: API endpoints already exist (from `database-mock-login` change)