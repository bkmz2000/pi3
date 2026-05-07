## ADDED Requirements

### Requirement: User registration via API
The system SHALL allow creating new users via API. Each user SHALL receive a unique API token upon registration.

#### Scenario: Create new user
- **WHEN** POST /api/users is called with name and email
- **THEN** a new user record is created and API token is returned

#### Scenario: Create user with duplicate email
- **WHEN** POST /api/users is called with existing email
- **THEN** server returns 409 Conflict error

### Requirement: Token authentication
The system SHALL authenticate requests using Bearer token in Authorization header. Invalid or missing tokens SHALL return 401 Unauthorized.

#### Scenario: Request with valid token
- **WHEN** request is made with valid Authorization: Bearer <token>
- **THEN** request is processed as belonging to the user associated with token

#### Scenario: Request with invalid token
- **WHEN** request is made with invalid or expired token
- **THEN** server returns 401 Unauthorized

#### Scenario: Request without token
- **WHEN** request is made without Authorization header
- **THEN** server returns 401 Unauthorized

### Requirement: Get current user info
The system SHALL allow authenticated users to retrieve their own user info.

#### Scenario: Get own user info
- **WHEN** GET /api/users/me is called with valid authentication
- **THEN** returns user object with id, name, email, created_at