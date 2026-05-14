## Context

pi3 is a browser-based Python IDE for teaching kids coding. Currently, teachers have no visibility into student work and cannot provide timely guidance. Students work in isolation.

This change introduces:
- **Teacher Dashboard**: A new page where teachers manage groups and review student projects
- **Group System**: Teachers create groups and invite students by email
- **Inline Comments**: Teachers can click on any line of student code to add a comment
- **Help Requests**: Students can click "I need help" which notifies their teacher

## Goals / Non-Goals

**Goals:**
- Teachers can create groups and invite students by email
- Teachers can see all shared projects from their students
- Teachers can add inline comments on any line of student code
- Students can share their project and request help
- Teachers see help requests in real-time

**Non-Goals:**
- Real-time collaborative editing (deferred)
- Automatic code evaluation or grading (deferred)
- Student-to-student collaboration (deferred)
- Full LMS integration (external systems can use API)

## Decisions

### 1. How do teachers find their students' projects?

**Decision**: Projects are shared to a specific teacher via the existing sharing API, with a special `teacher_share` flag.

**Rationale**: Reuses existing `project_shares` table. Teacher sees all projects shared with them. Simple, leverages existing code.

**Alternative**: Create a separate "classroom" concept with its own project list. More complex, would need new data model.

### 2. How are inline comments stored?

**Decision**: Store comments with `project_id`, `file_path`, `line_number`, `text`, `author_id`, `created_at`.

**Rationale**: Simple, allows threading per file. Line number is stable enough since we anchor to content for display.

**Alternative**: Store character offsets instead of line numbers. More complex, requires parsing.

### 3. How do teachers get notified of help requests?

**Decision**: Polling-based notification check (`GET /api/notifications`) every 10 seconds when on teacher dashboard.

**Rationale**: Simpler than WebSocket. Works through proxies. Adequate for classroom use case.

**Alternative**: WebSocket for real-time. Would require more infrastructure (Redis or similar for horizontal scaling).

### 4. What happens when a student requests help?

**Decision**: Creates a `help_request` record linking student, project, and teacher. Student sees "Help requested" badge on project.

**Rationale**: Clear state, easy to track. Teacher dashboard shows pending requests with student name, project, and timestamp.

**Alternative**: Generic "notification" model. More flexible but more complex.

## Data Model

```
groups(id, teacher_id, name, created_at)
group_members(id, group_id, student_id, role, joined_at)
comments(id, project_id, file_path, line_number, text, author_id, created_at)
help_requests(id, project_id, student_id, teacher_id, status, created_at)
```

## API Endpoints

### Groups
- `POST /api/groups` - Create group
- `GET /api/groups` - List teacher's groups
- `POST /api/groups/:id/invite` - Invite student by email
- `DELETE /api/groups/:id/members/:userId` - Remove student

### Comments
- `POST /api/projects/:id/comments` - Add comment
- `GET /api/projects/:id/comments` - List comments for project
- `DELETE /api/comments/:id` - Delete comment

### Help Requests
- `POST /api/projects/:id/help-request` - Toggle help request
- `GET /api/notifications` - Get pending help requests (for teacher)

## Risks / Trade-offs

[Risk] Line numbers shift when student edits code
→ **Mitigation**: Comments anchor to content, not just line numbers. Display finds first line containing anchor text.

[Risk] Teacher joins, leaves, rejoins group
→ **Mitigation**: Group membership is independent from project sharing. Teacher always sees shared projects regardless of current group membership.

[Risk] Many students request help simultaneously
→ **Mitigation**: Help requests queue in dashboard. Teacher can address in any order.

[Trade-off] Polling vs WebSocket
→ **Decision**: Polling is simpler and sufficient for classroom use. Teacher opens dashboard and polls every 10s.