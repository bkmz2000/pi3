## Why

Teachers need visibility into student progress and the ability to provide guidance during coding activities. Currently, students work in isolation with no way to share their work or get timely help. This change creates a teacher dashboard for managing classrooms and a student "request help" workflow.

## What Changes

- Teachers can create groups and invite students by email
- Teachers can view all shared student projects in one place
- Teachers can attach comments to specific lines of student code (inline code review)
- Students can share their project with their teacher and trigger a "need help" notification
- Teachers receive real-time notifications when students request help

## Capabilities

### New Capabilities

- `group-management`: Teachers create groups, invite students, manage membership
- `project-sharing`: Students share projects with teachers, marking them for review
- `inline-comments`: Teachers add line-specific comments on student code
- `help-requests`: Students trigger help notifications to their teacher
- `teacher-dashboard`: Dashboard UI for teachers to manage groups, view student work, handle help requests

### Modified Capabilities

- `user-auth`: Add role field (teacher/student) and group membership
- `project-storage`: Add sharing with specific users (beyond owner/editor/viewer)

## Impact

- New database tables: `groups`, `group_members`, `comments`, `help_requests`
- New API endpoints: groups CRUD, invite by email, comments CRUD, help request toggle
- New frontend pages: teacher dashboard, student help request button
- Notification system integration (polling or WebSocket)