## 1. Configuration

- [ ] 1.1 Add Loginus config constants to IdeState (domain, client_id, client_secret, redirect_uri, post_logout_redirect_uri, scopes)
- [ ] 1.2 Add type definitions for OAuth tokens and userinfo

## 2. Token Storage

- [ ] 2.1 Add token storage functions to storage.ts (saveTokens, loadTokens, clearTokens)
- [ ] 2.2 Add token validity checking (isTokenExpired, isRefreshTokenAvailable)

## 3. OAuth Service

- [ ] 3.1 Create OAuth utility module (generateAuthUrl, exchangeCodeForTokens, refreshAccessToken, fetchUserInfo)
- [ ] 3.2 Implement state generation/validation for CSRF protection
- [ ] 3.3 Implement PKCE code verifier/challenge generation (for future)
- [ ] 3.4 Add error handling for OAuth failures

## 4. Auth State Store

- [ ] 4.1 Create useAuth Zustand store (user, accessToken, isAuthenticated, isLoading, sessionStatus)
- [ ] 4.2 Add session restoration on app load (validateTokens, silent refresh)
- [ ] 4.3 Add login/logout actions to store
- [ ] 4.4 Add token refresh logic on 401 detection

## 5. Callback Handling

- [ ] 5.1 Create OAuth callback route/handler (handleCallback)
- [ ] 5.2 Validate state parameter
- [ ] 5.3 Exchange code for tokens
- [ ] 5.4 Fetch userinfo and populate store
- [ ] 5.5 Redirect to app main view

## 6. Single Logout (SLO)

- [ ] 6.1 Create logout flow (clearLocalSession, buildEndSessionUrl, redirect)
- [ ] 6.2 Handle post-logout redirect back to app
- [ ] 6.3 Add state parameter support

## 7. Auth UI - Header

- [ ] 7.1 Add SignInButton component (shows when unauthenticated)
- [ ] 7.2 Add UserMenu component with avatar, name, email, logout option
- [ ] 7.3 Add auth loading spinner
- [ ] 7.4 Wire auth state to App.tsx header

## 8. Integration & Testing

- [ ] 8.1 Wire all pieces together in App.tsx
- [ ] 8.2 Test full OAuth flow (login → callback → token storage → userinfo)
- [ ] 8.3 Test logout flow (logout → SLO → clear state)
- [ ] 8.4 Test session persistence (close browser → reopen → session restored)
- [ ] 8.5 Test token refresh behavior
- [ ] 8.6 Run npm test and npm run lint
