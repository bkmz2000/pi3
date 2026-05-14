## 1. Database Schema

- [ ] 1.1 Create `groups` table (id, teacher_id, name, created_at)
- [ ] 1.2 Create `group_members` table (id, group_id, student_id, role, joined_at)
- [ ] 1.3 Create `comments` table (id, project_id, file_path, line_number, anchor_text, text, author_id, created_at)
- [ ] 1.4 Create `help_requests` table (id, project_id, student_id, teacher_id, status, created_at, updated_at)
- [ ] 1.5 Add `role` column to users table (teacher/student)
- [ ] 1.6 Add migration script for new tables

## 2. API Endpoints - Groups

- [ ] 2.1 Add `POST /api/groups` - Create group
- [ ] 2.2 Add `GET /api/groups` - List teacher's groups with member count
- [ ] 2.3 Add `GET /api/groups/:id` - Get group details
- [ ] 2.4 Add `DELETE /api/groups/:id` - Delete group (teacher only)
- [ ] 2.5 Add `POST /api/groups/:id/invite` - Invite user by email
- [ ] 2.6 Add `DELETE /api/groups/:id/members/:userId` - Remove member
- [ ] 2.7 Add `GET /api/groups/my` - List groups for current student

## 3. API Endpoints - Comments

- [ ] 3.1 Add `POST /api/projects/:id/comments` - Add comment (project_id, file_path, line_number, anchor_text, text)
- [ ] 3.2 Add `GET /api/projects/:id/comments` - List comments for project
- [ ] 3.3 Add `GET /api/projects/:id/comments/:filePath` - Get comments for specific file
- [ ] 3.4 Add `DELETE /api/comments/:id` - Delete comment (author only)

## 4. API Endpoints - Help Requests

- [ ] 4.1 Add `POST /api/projects/:id/help-request` - Toggle help request on/off
- [ ] 4.2 Add `GET /api/help-requests` - List pending help requests for teacher
- [ ] 4.3 Add `PATCH /api/help-requests/:id` - Mark help request as addressed
- [ ] 4.4 Add `GET /api/notifications` - Get pending help requests and comment mentions

## 5. Teacher Dashboard UI

- [ ] 5.1 Create `/teacher` route with dashboard layout
- [ ] 5.2 Add navigation to teacher dashboard (header link for teachers)
- [ ] 5.3 Create Groups section showing all teacher groups
- [ ] 5.4 Create group detail view with member list
- [ ] 5.5 Create "Create Group" dialog with name input
- [ ] 5.6 Create "Invite Student" dialog with email input
- [ ] 5.7 Create Student Projects section showing all shared projects
- [ ] 5.8 Add help request indicator badge on projects
- [ ] 5.9 Add notification polling every 10 seconds

## 6. Student Code Review View

- [ ] 6.1 Create read-only project view for teachers
- [ ] 6.2 Add clickable line numbers to trigger comment input
- [ ] 6.3 Show comment indicators in gutter for lines with comments
- [ ] 6.4 Create comment popover when clicking on a commented line
- [ ] 6.5 Add "Add Comment" input when line is clicked
- [ ] 6.6 Display comment thread for each line

## 7. Student "I Need Help" Feature

- [ ] 7.1 Add "I need help" button to IDE header (only for shared projects)
- [ ] 7.2 Add visual badge "Help requested" on shared projects
- [ ] 7.3 Connect button to POST /api/projects/:id/help-request
- [ ] 7.4 Update button state based on help request status

## 8. User Role and Group Association

- [ ] 8.1 Add role selection during user registration (teacher/student)
- [ ] 8.2 Add `group_id` field when teacher invites student
- [ ] 8.3 Add teacher_id to students when they join a group
- [ ] 8.4 Add authorization checks (only teachers can create groups, etc.)

## 9. Polling Integration

- [ ] 9.1 Add notification polling to teacher dashboard
- [ ] 9.2 Update notification badge count when new requests come in
- [ ] 9.3 Add real-time indicator when teacher receives new help request
- [ ] 9.4 Handle polling errors gracefully (retry with backoff)

## 10. Testing

- [ ] 10.1 Test group creation and invitation flow
- [ ] 10.2 Test project sharing with teacher
- [ ] 10.3 Test comment creation and display
- [ ] 10.4 Test help request creation and notification
- [ ] 10.5 Test teacher dashboard displays all sections correctly
- [ ] 10.6 Test student help button in IDE