## 1. User Auth State (Zustand)

- [ ] 1.1 Create `useUser` Zustand store slice
- [ ] 1.2 Add login/logout actions
- [ ] 1.3 Add token persistence to localStorage
- [ ] 1.4 Add session restoration on app load

## 2. Auth UI Components

- [ ] 2.1 Create `UserMenu` component (dropdown with avatar/name)
- [ ] 2.2 Create `LoginButton` component
- [ ] 2.3 Create `LoginDialog` component with token input
- [ ] 2.4 Add auth loading state

## 3. Header Integration

- [ ] 3.1 Update Header to show LoginButton or UserMenu based on auth state
- [ ] 3.2 Connect auth state to header

## 4. Projects State (Zustand)

- [ ] 4.1 Create `useProjects` Zustand store slice
- [ ] 4.2 Add fetchProjects action (GET /api/projects)
- [ ] 4.3 Add createProject action (POST /api/projects)
- [ ] 4.4 Add deleteProject action (DELETE /api/projects/:id)

## 5. Projects Page

- [ ] 5.1 Create `ProjectsPage` component with routing (/projects)
- [ ] 5.2 Display projects list (owned + shared)
- [ ] 5.3 Add empty state for no projects
- [ ] 5.4 Add "New Project" button and dialog

## 6. Project Card

- [ ] 6.1 Create `ProjectCard` component
- [ ] 6.2 Show project name, description, role badge
- [ ] 6.3 Add delete button (for owners)
- [ ] 6.4 Add share button (for owners)

## 7. Sharing Dialog

- [ ] 7.1 Create `ShareDialog` component
- [ ] 7.2 Add email input and role selector
- [ ] 7.3 Connect to POST /api/projects/:id/share

## 8. API Integration

- [ ] 8.1 Create API client utility for backend calls
- [ ] 8.2 Add auth header to all API requests
- [ ] 8.3 Handle 401 redirect to login
- [ ] 8.4 Add error toast notifications