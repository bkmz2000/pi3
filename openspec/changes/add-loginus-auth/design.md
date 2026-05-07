## Context

pi3 is a browser-based Python IDE for teaching kids. Currently it has no authentication — all data is local. The school uses Loginus as an identity provider, and we need to integrate with it for proper auth.

**Current state:**
- All storage is local (IndexedDB for projects, no user accounts)
- No concept of users or sessions
- Header shows run/save controls, no auth-related UI

**Constraints:**
- Client-side only (no backend) — OAuth happens entirely in browser
- Must work with school's Loginus instance
- Need to support existing instructor sharing system

## Goals / Non-Goals

**Goals:**
- OAuth 2.0 authentication via Loginus
- Secure token storage in IndexedDB
- Session persistence across browser sessions
- Single Logout (SLO) — logout from pi3 terminates Loginus session
- Auth UI in header (login button, user menu)

**Non-Goals:**
- This is NOT a full user management system — we don't create/delete users
- Not implementing custom user registration (Loginus handles identity)
- Not implementing OAuth client registration API (done manually in Loginus admin)
- Not implementing the inbound/outbound SSO for the instructor dashboard (separate concern)

## Decisions

### 1. Token storage: IndexedDB over localStorage

**Decision:** Store tokens in IndexedDB (matching existing project storage).

**Rationale:** Tokens are sensitive data. IndexedDB is slightly harder to access from browser devtools. More importantly, it keeps all persistent data in one place, simplifying the storage layer.

**Alternative:** localStorage is simpler but tokens show up in devtools.

### 2. Session restoration: On app load, validate + refresh if needed

**Decision:** On app initialization, check for stored tokens and refresh if expired.

**Rationale:** Browser apps load fresh each time. We need to detect if we have a valid session from a previous visit. A background refresh check (silent renewal) handles expired tokens gracefully.

**Alternative:** Could defer session restoration until first API call, but showing logged-in state immediately feels snappier.

### 3. PKCE: Should support but may not require

**Decision:** Design for PKCE support, implement without initially.

**Rationale:** PKCE is more secure but adds complexity (need to generate code verifier/challenge). Loginus may not require it. We'll build it in a way that makes it easy to add later.

### 4. Auth UI placement: Header, right side

**Decision:** Add auth controls to the right side of the header, replacing any placeholder or adding next to existing controls.

**Rationale:** Login is a primary action — it needs to be visible. Header is the standard pattern for auth UI. Keeping it in header makes it accessible from any screen.

### 5. No login gate initially

**Decision:** Don't force login before editor access.

**Rationale:** pi3 is used in classrooms where students may not have Loginus accounts. The main use case for auth is instructor sharing. We'll show the login button prominently but not block editor access.

**Counter-argument:** True multi-user features (cross-device sync) would benefit from a login gate. But that's future work.

## Risks / Trade-offs

[Risk] Loginus goes down or changes API
→ **Mitigation:** App continues to work offline with cached Pyodide. Auth features degrade gracefully with clear error messages.

[Risk] Tokens expire during long editing sessions
→ **Mitigation:** Silent refresh on 401 responses. User shouldn't notice unless refresh fails entirely.

[Risk] CORS issues with Loginus endpoints
→ **Mitigation:** Confirm with school admin that Loginus allows CORS from pi3 origin before shipping.

[Risk] Refresh token rotation breaks session
→ **Mitigation:** If refresh fails, clear session and prompt re-login. Don't get stuck in broken state.

[Trade-off] Client-side OAuth exposes tokens in browser memory
→ **Mitigation:** Tokens are sensitive anyway — this is how all OAuth SPAs work. Browser security model is the trust boundary. HTTPS is required.

## Migration Plan

1. **Add auth store and OAuth util** — no UI, no behavioral change yet
2. **Wire up login button** — shows Loginus OAuth screen, handles callback
3. **Add user info to header** — authenticated state visible
4. **Implement logout + SLO** — completes auth flow
5. **Enable by default** — no feature flag, auth is additive

Rollback: Remove auth components, revoke OAuth client in Loginus admin if needed.

## Open Questions

1. **What Loginus domain to use?** Need school-provided domain (e.g., `https://school.loginus.example`).
2. **OAuth client setup:** Who creates the client in Loginus admin? (Admin or developer with root creds)
3. **Should we support "remember me" vs "session only"?** Current design assumes persistent sessions (refresh tokens).
4. **What scopes to request?** Proposal says `openid email profile` — adequate for basic auth.
5. **Instructor sharing integration:** Should auth tie into the existing sharing system? Current design doesn't — sharing uses session IDs. Worth discussing.
