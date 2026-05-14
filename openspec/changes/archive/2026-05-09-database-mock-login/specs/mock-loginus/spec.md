## ADDED Requirements

### Requirement: Mock OAuth authorize endpoint
The mock Loginus SHALL provide a `GET /oauth/authorize` endpoint that accepts query parameters `client_id`, `redirect_uri`, `response_type`, `state`, and `scope`. It SHALL display a mock login form and redirect to `redirect_uri` with an authorization code on successful login.

#### Scenario: Successful authorization
- **WHEN** user visits `/oauth/authorize?client_id=test&redirect_uri=http://localhost/callback&response_type=code&state=teststate&scope=openid`
- **THEN** mock server displays login form with username/password fields

#### Scenario: Authorization with valid credentials
- **WHEN** user submits valid mock credentials on the authorize form
- **THEN** server redirects to `redirect_uri` with `code` and `state` parameters

#### Scenario: Authorization with invalid credentials
- **WHEN** user submits invalid credentials on the authorize form
- **THEN** server displays error message and does not redirect

### Requirement: Mock OAuth token endpoint
The mock Loginus SHALL provide a `POST /oauth/token` endpoint that accepts `grant_type`, `code`, `client_id`, `redirect_uri`, and `code_verifier`. It SHALL return a JSON response with `access_token`, `refresh_token`, `id_token`, and `expires_in`.

#### Scenario: Token exchange with valid code
- **WHEN** client POSTs to `/oauth/token` with valid authorization code
- **THEN** server returns JSON with `access_token`, `refresh_token`, `id_token`, and `expires_in`

#### Scenario: Token exchange with invalid code
- **WHEN** client POSTs to `/oauth/token` with invalid or expired code
- **THEN** server returns 400 error with `invalid_grant` error code

### Requirement: Mock userinfo endpoint
The mock Loginus SHALL provide a `GET /oauth/userinfo` endpoint that accepts `Authorization: Bearer <token>` header. It SHALL return mock user information matching the logged-in user.

#### Scenario: Userinfo with valid token
- **WHEN** client GETs `/oauth/userinfo` with valid bearer token
- **THEN** server returns JSON with `sub`, `email`, `name` fields

#### Scenario: Userinfo with invalid token
- **WHEN** client GETs `/oauth/userinfo` with invalid bearer token
- **THEN** server returns 401 error

### Requirement: Environment-based provider toggle
The system SHALL use `VITE_AUTH_PROVIDER` environment variable to determine which auth provider to use. When set to `mock`, the app SHALL use mock OAuth endpoints. When set to `loginus`, the app SHALL use real Loginus endpoints.

#### Scenario: App uses mock provider when configured
- **WHEN** `VITE_AUTH_PROVIDER=mock` is set
- **THEN** auth redirects point to `http://localhost:3001/oauth/authorize`

#### Scenario: App uses real provider when configured
- **WHEN** `VITE_AUTH_PROVIDER=loginus` is set
- **THEN** auth redirects point to real Loginus OAuth endpoint

### Requirement: Mock server lifecycle management
The mock server SHALL be startable and stoppable for test purposes. Test setup SHALL start the server before tests and stop it after.

#### Scenario: Server starts on configured port
- **WHEN** mock server starts with port 3001
- **THEN** endpoints are available at `http://localhost:3001`

#### Scenario: Server can be stopped cleanly
- **WHEN** mock server receives shutdown signal
- **THEN** server stops accepting new connections and exits