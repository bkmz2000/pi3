## Context

pi3 has a backend API for project storage but no frontend UI to manage projects. Currently users interact with the IDE locally. We need:

- Header showing login state (login button or user menu)
- Projects page listing user's projects from backend
- Project management controls (create, delete, share)

The backend API exists from the `database-mock-login` change with endpoints for users, projects, files, and sharing.

## Goals / Non-Goals

**Goals:**
- Auth-aware header (login button vs user menu)
- User projects page listing owned and shared projects
- Project creation, deletion, and basic sharing
- Connect frontend state to backend API

**Non-Goals:**
- Full user settings/profile page (deferred)
- Project collaboration (real-time editing deferred)
- File editing on backend (currently local-only)
- OAuth flow (using simple token auth for now)

## Decisions

### 1. Where to store auth token?

**Decision:** Store API token in localStorage.

**Rationale:** Simple, works across page refreshes. The token identifies the user for all API calls.

**Alternative:** Session storage (cleared on tab close) - less persistent.

### 2. Projects page vs modal?

**Decision:** Separate `/projects` route page.

**Rationale:** Clean separation from IDE. Projects management is distinct from editing.

**Alternative:** Modal overlay - would clutter IDE experience.

### 3. Zustand store structure

**Decision:** Add `useUser` slice for auth state, `useProjects` slice for project list.

**Rationale:** Separates concerns. Auth state different from project data.

### 4. API integration strategy

**Decision:** Fetch projects on page load, optimistic UI for mutations.

**Rationale:** Simpler than reactive subscriptions. Projects don't change frequently.

## Risks / Trade-offs

[Risk] Token exposure in localStorage
→ **Mitigation:** HTTPS required in production. Token is low-value (no passwords).

[Risk] Offline users can't access projects
→ **Mitigation:** Show clear error when API unreachable. Consider local cache later.

[Trade-off] Separate projects page vs inline
→ **Decision: Separate page** - cleaner UX, easier to add features later.