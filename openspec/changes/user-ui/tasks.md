## 1. User Auth State (Zustand)

- [x] 1.1 Create `useUser` Zustand store slice
- [x] 1.2 Add login/logout actions
- [x] 1.3 Add token persistence to localStorage
- [x] 1.4 Add session restoration on app load

## 2. Auth UI Components

- [x] 2.1 Create `UserMenu` component (dropdown with avatar/name)
- [x] 2.2 Create `LoginButton` component
- [x] 2.3 Create `LoginDialog` component with token input
- [x] 2.4 Add auth loading state

## 3. Header Integration

- [x] 3.1 Update Header to show LoginButton or UserMenu based on auth state
- [x] 3.2 Connect auth state to header

## 4. Projects State (Zustand)

- [x] 4.1 Create `useProjects` Zustand store slice
- [x] 4.2 Add fetchProjects action (GET /api/projects)
- [x] 4.3 Add createProject action (POST /api/projects)
- [x] 4.4 Add deleteProject action (DELETE /api/projects/:id)

## 5. Projects Page

- [x] 5.1 Create `ProjectsPage` component with routing (/projects)
- [x] 5.2 Display projects list (owned + shared)
- [x] 5.3 Add empty state for no projects
- [x] 5.4 Add "New Project" button and dialog

## 6. Project Card

- [x] 6.1 Create `ProjectCard` component
- [x] 6.2 Show project name, description, role badge
- [x] 6.3 Add delete button (for owners)
- [x] 6.4 Add share button (for owners)

## 7. Sharing Dialog

- [x] 7.1 Create `ShareDialog` component
- [x] 7.2 Add email input and role selector
- [x] 7.3 Connect to POST /api/projects/:id/share

## 8. API Integration

- [x] 8.1 Create API client utility for backend calls
- [x] 8.2 Add auth header to all API requests
- [x] 8.3 Handle 401 redirect to login
- [x] 8.4 Add error toast notifications