## 1. Project Setup

- [x] 1.1 Create server/ directory structure
- [x] 1.2 Add express, better-sqlite3, cors dependencies
- [x] 1.3 Create SQLite database initialization script

## 2. Database Schema

- [x] 2.1 Create users table with api_token
- [x] 2.2 Create projects table
- [x] 2.3 Create files table
- [x] 2.4 Create project_shares table
- [x] 2.5 Write database migration utilities

## 3. User Auth Implementation

- [x] 3.1 Implement token middleware for authentication
- [x] 3.2 Implement POST /api/users (user creation)
- [x] 3.3 Implement GET /api/users/me (get current user)
- [x] 3.4 Generate secure API tokens on user creation

## 4. Project API Implementation

- [x] 4.1 Implement GET /api/projects (list user's projects)
- [x] 4.2 Implement POST /api/projects (create project)
- [x] 4.3 Implement GET /api/projects/:id (get project)
- [x] 4.4 Implement PUT /api/projects/:id (update project)
- [x] 4.5 Implement DELETE /api/projects/:id (delete project)
- [x] 4.6 Add ownership and share checks to all endpoints

## 5. File API Implementation

- [x] 5.1 Implement GET /api/projects/:id/files (list files)
- [x] 5.2 Implement POST /api/projects/:id/files (create file/directory)
- [x] 5.3 Implement GET /api/projects/:id/files/:path (get file)
- [x] 5.4 Implement PUT /api/projects/:id/files/:path (update file)
- [x] 5.5 Implement DELETE /api/projects/:id/files/:path (delete file)

## 6. Sharing Implementation

- [x] 6.1 Implement POST /api/projects/:id/share (share project)
- [x] 6.2 Implement DELETE /api/projects/:id/share/:userId (remove share)
- [x] 6.3 Add share role enforcement (owner/editor/viewer)

## 7. Testing

- [x] 7.1 Write unit tests for database layer
- [x] 7.2 Write API integration tests
- [x] 7.3 Test access control (user isolation)

## 8. Docker Compose

- [x] 8.1 Add server service to docker-compose.yml
- [x] 8.2 Create Dockerfile.server for API container
- [x] 8.3 Add database volume for persistence