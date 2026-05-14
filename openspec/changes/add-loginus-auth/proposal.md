## Why

pi3 currently has no authentication — all code and projects are stored locally in the browser. While this is simple for students, it prevents meaningful features like instructor oversight, cross-device sync, and classroom management. The school uses Loginus as its identity provider, so integrating with it provides a proper auth system without managing passwords.

## What Changes

- Add OAuth 2.0 authentication flow using Loginus as the provider
- Store access/refresh tokens securely (IndexedDB, matching existing storage approach)
- Add user session state to Zustand store
- Add login/logout UI in the header
- Persist user session across browser sessions (auto-refresh tokens)
- Implement Single Logout (SLO) — logout from pi3 terminates Loginus session too
- **BREAKING**: First-run experience changes to show login before the editor

## Capabilities

### New Capabilities

- `loginus-oauth`: OAuth 2.0 Authorization Code flow with PKCE-ready design. Covers authorize URL generation, code exchange, token storage, refresh flow, and userinfo retrieval.
- `user-session`: User authentication state in Zustand. Stores current user info (id, email, name), access token, and handles session restoration on app load.
- `auth-ui`: Login/logout user interface. Login button in header when unauthenticated, user avatar + dropdown menu when authenticated (profile info, logout option).
- `single-logout`: OIDC RP-Initiated Logout implementation. On logout, redirect to Loginus `end_session` endpoint, then clear local session.

### Modified Capabilities

- (none — no existing auth-related specs)

## Impact

- **New dependencies**: Loginus OAuth endpoints (authorization, token, userinfo, end_session)
- **State**: New `useAuth` Zustand store for user session
- **Storage**: Token storage in IndexedDB (alongside existing project storage)
- **UI**: Header component changes for auth UI
- **UX**: First-load flow requires login before editor access
- **No backend required**: All OAuth happens client-side in the browser
