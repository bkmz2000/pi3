## Context

pi3 needs a backend to store projects remotely. Current state:
- Projects stored in IndexedDB (browser-only)
- No multi-device access
- No sharing capabilities

Target state:
- Projects synced to backend
- Multiple users with isolated project spaces
- Simple token auth (no OAuth complexity)

## Goals / Non-Goals

**Goals:**
- SQLite database for persistence (simple, file-based, no separate DB server)
- Token-based auth (API key per user)
- REST API for project/file CRUD
- User isolation: users only see their own projects unless shared
- Project sharing with access control

**Non-Goals:**
- OAuth (deferred to future)
- Real-time collaboration
- User registration UI (admin-created users only)
- Horizontal scaling (single server for now)

## Database Schema

```
users
├── id (TEXT PRIMARY KEY)
├── api_token (TEXT UNIQUE)
├── name (TEXT)
├── created_at (INTEGER)
└── updated_at (INTEGER)

projects
├── id (TEXT PRIMARY KEY)
├── user_id (TEXT FK → users.id)
├── name (TEXT)
├── description (TEXT)
├── is_public (INTEGER)
├── created_at (INTEGER)
└── updated_at (INTEGER)

files
├── id (TEXT PRIMARY KEY)
├── project_id (TEXT FK → projects.id)
├── path (TEXT)
├── content (TEXT)
├── is_directory (INTEGER)
├── created_at (INTEGER)
└── updated_at (INTEGER)

project_shares
├── id (TEXT PRIMARY KEY)
├── project_id (TEXT FK → projects.id)
├── user_id (TEXT FK → users.id)
├── role (TEXT) -- 'owner' | 'editor' | 'viewer'
├── created_at (INTEGER)
└── updated_at (INTEGER)
```

## API Design

### Authentication
All requests require `Authorization: Bearer <api_token>` header.

### Endpoints

```
GET    /api/users/me                    -- Get current user info
POST   /api/users                        -- Create user (admin only)

GET    /api/projects                     -- List user's projects (including shared)
POST   /api/projects                     -- Create project
GET    /api/projects/:id                 -- Get project details
PUT    /api/projects/:id                 -- Update project
DELETE /api/projects/:id                 -- Delete project

GET    /api/projects/:id/files          -- List project files
POST   /api/projects/:id/files          -- Create file
GET    /api/projects/:id/files/:path    -- Get file content
PUT    /api/projects/:id/files/:path    -- Update file
DELETE /api/projects/:id/files/:path    -- Delete file

POST   /api/projects/:id/share          -- Share project with user
DELETE /api/projects/:id/share/:userId  -- Remove share
```

### Access Control Logic
1. Project owner has full access
2. Shared users have access based on role (editor can modify, viewer can read)
3. Non-public projects invisible to non-owners unless shared

## Decisions

### 1. SQLite over PostgreSQL/MySQL

**Decision:** Use SQLite for the database.

**Rationale:** Single file, no separate server process, simple backups. Perfect for single-server deployment. better-sqlite3 provides synchronous API that fits Express well.

**Alternative:** PostgreSQL - better for scaling, requires separate DB server.

### 2. Token Auth over JWT/Sessions

**Decision:** Simple API token stored directly in database.

**Rationale:** No JWT complexity, no token refresh logic. Token is the identity - like GitHub personal access tokens.

**Alternative:** JWT - stateless, but requires validation logic and refresh.

### 3. File Storage in DB over Object Storage

**Decision:** Store file content directly in SQLite.

**Rationale:** Simple, transactional, easy backup. SQLite handles up to 1TB databases comfortably.

**Alternative:** S3/GCS - better for large files, adds external dependency.

### 4. Express.js for API Server

**Decision:** Express.js for the REST API.

**Rationale:** Familiar, simple, good SQLite integration. Fits the Node.js stack.

## Risks / Trade-offs

[Risk] SQLite concurrent writes limited
→ **Mitigation:** Single-server deployment, writes are not frequent (project saves)

[Risk] File content size limits
→ **Mitigation:** SQLite default 1GB, can increase. For large assets use external storage later.

[Risk] Token exposure
→ **Mitigation:** HTTPS required, tokens shown only once on creation

## Database Migrations

SQLite databases are stored as single files (e.g., `pi3.db`). Migrations modify this file safely.

### How SQLite Migrations Work

1. **Each migration is a SQL script** that transforms the schema
2. **Migrations run in order** — SQLite applies them sequentially
3. **Migrations are idempotent** — safe to run twice (use `IF NOT EXISTS`, `IF EXISTS`)
4. **No down migrations needed** — we never go backwards

### Migration File Structure

```
server/
  db/
    index.js           -- database connection + migration runner
    migrations/
      001_initial.sql  -- create tables
      002_add_col.sql  -- add column
      003_rename_col.sql
    seed/
      dev-users.sql    -- seed data for development
```

### Migration Runner Logic

```js
// Run on server startup
const db = openDatabase('pi3.db')
const version = db.prepare('SELECT version FROM db_version').get()?.version ?? 0

for (const migration of pendingMigrations(version)) {
  db.exec(migration.sql)
  db.prepare('UPDATE db_version SET version = ?').run(migration.version)
}

function pendingMigrations(current) {
  return fs.readdirSync(__dirname + '/migrations')
    .filter(f => f.endsWith('.sql'))
    .map(f => ({
      version: parseInt(f.split('_')[0]),
      sql: fs.readFileSync(__dirname + '/migrations/' + f, 'utf8')
    }))
    .filter(m => m.version > current)
    .sort((a, b) => a.version - b.version)
}
```

### SQLite-Specific Migration Rules

1. **SQLite doesn't support `ALTER COLUMN`** — to change a column:
   - Create new table with desired schema
   - Copy data from old table
   - Drop old table
   - Rename new table

2. **Avoid `DROP COLUMN` in early versions** — just stop using it (mark as deprecated)

3. **Use `INTEGER` for booleans** — SQLite has no BOOLEAN type (0/1 works fine)

4. **Text is preferred for IDs** — UUIDs stored as TEXT avoid conversion issues

5. **Foreign keys off by default** — enable with `PRAGMA foreign_keys = ON`

### Example Migrations

```sql
-- 001_initial.sql
CREATE TABLE IF NOT EXISTS db_version (version INTEGER);
INSERT INTO db_version (version) VALUES (1);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  api_token TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 002_add_description_to_projects.sql
ALTER TABLE projects ADD COLUMN description TEXT;
-- SQLite allows adding columns to existing tables
```

### Backup Strategy

Since SQLite is a single file:
```bash
# Simple file copy (when server is idle)
cp pi3.db pi3.db.backup

# Or use SQLite's .backup command (online backup)
sqlite3 pi3.db ".backup pi3.db.backup"
```