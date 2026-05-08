# API Design Analysis & Redesign

## Current State

The current API was designed for individual file CRUD, but the frontend treats a project as a single blob of files+assets. This creates a fundamental impedance mismatch.

### Current endpoints

```
POST   /api/users                          - create user (no auth)
GET    /api/users/me                       - get current user (auth)
GET    /api/projects                       - list projects (auth)
POST   /api/projects                       - create project (auth)
GET    /api/projects/:id                   - get project metadata (auth)
PUT    /api/projects/:id                   - update project metadata (auth)
DELETE /api/projects/:id                   - delete project (auth)
GET    /api/projects/:id/files             - list file paths (auth)
POST   /api/projects/:id/files             - create file (auth)
GET    /api/projects/:id/files/:path       - get file content (auth)
PUT    /api/projects/:id/files/:path       - update file (auth)
DELETE /api/projects/:id/files/:path       - delete file (auth)
POST   /api/projects/:id/share             - share (body: { email, role }) (auth)
GET    /api/projects/:id/share             - list shares (auth)
DELETE /api/projects/:id/share/:userId     - remove share (auth)
```

### Problems

1. **Frontend saves/loads projects as a unit, not per-file**: The editor's `saveCurrentProject()` writes `{ files: Record<string, string>, assets: Record<string, string> }` in one shot. The API can only do individual file PUT — ~15 API calls for a project with 10 files + 5 assets. This is why the frontend currently uses IndexedDB instead of the API.

2. **No project content endpoint**: `GET /api/projects/:id` returns metadata only. The IDE needs all files + assets to display the project. No single endpoint provides this.

3. **No asset storage on server**: Assets exist only as data URLs in the frontend (embedded in the project blob). The server has no asset storage model.

4. **`files` table has `is_directory` baggage**: The frontend has flat `Record<string, string>` files — no directory support. The `is_directory` column adds complexity for zero benefit.

5. **Share endpoint calls it `email` but queries by `name`**: `POST /api/projects/:id/share` takes `email` in the body but does `WHERE name = ?`. Misleading and fragile.

6. **`is_public` is an integer**: SQLite-ism leaking into the API contract. Should be a boolean.

7. **Two client-side stores doing the same thing**: `state/useProjects.ts` (REST API) and `useIde` (IndexedDB) hold the same kind of data with no sync.

### Redesigned API

The core insight: for an educational IDE, projects are small (< 20 files, < 10 assets). Treat the project as a unit.

```
POST   /api/users                          - create user (body: { name })
GET    /api/users/me                       - get current user

GET    /api/projects                                       - list user's projects
POST   /api/projects                                       - create project (body: { name, description, files?, assets? })
GET    /api/projects/:id                                   - get project metadata
PUT    /api/projects/:id                                   - update metadata (body: { name?, description? })
DELETE /api/projects/:id                                   - delete project + all content

GET    /api/projects/:id/content                           - get all files + asset metadata (for loading IDE)
PUT    /api/projects/:id/content                           - atomic save all files (body: { files, assets?, currentFile? })

POST   /api/projects/:id/share                             - share (body: { username, role })
GET    /api/projects/:id/shares                            - list shares
DELETE /api/projects/:id/shares/:userId                    - remove share
```

**What `GET /api/projects/:id/content` returns:**
```json
{
  "id": "proj_abc",
  "name": "My Game",
  "files": {
    "main.py": "print('hello')",
    "utils.py": "def foo(): pass"
  },
  "assets": {
    "player.png": "/api/projects/proj_abc/assets/player.png",
    "enemy.png": "/api/projects/proj_abc/assets/enemy.png"
  },
  "currentFile": "main.py"
}
```

**What `PUT /api/projects/:id/content` accepts:**
```json
{
  "files": { "main.py": "new content" },
  "currentFile": "main.py"
}
```

Assets are uploaded separately and referenced by URL.

### Migration from old schema

Add a migration `002_project_content.sql`:
- Add `current_file TEXT` column to `projects`
- Add `assets` table (or store assets as files on disk)
- Keep `files` table for backward compat but add a `content_json` column or similar

Alternatively, add a new column `files_json TEXT` and `assets_json TEXT` to the `projects` table that stores the complete file map as JSON. This gives atomic bulk operations with zero joins. The individual `files` table can remain for granular access if needed later.

Simplest approach: remove `files` table dependency, store all project content as JSON columns on the `projects` table:
```sql
ALTER TABLE projects ADD COLUMN files TEXT DEFAULT '{}';
ALTER TABLE projects ADD COLUMN assets TEXT DEFAULT '{}';
ALTER TABLE projects ADD COLUMN current_file TEXT DEFAULT 'main.py';
```

This matches the frontend's data model exactly. For asset binary data, assets can reference files on disk or be stored as data URLs. For true server-primary storage, assets should be files on disk with the column storing paths.

### Key decisions needed

1. **Assets**: Store binary on filesystem by path, or as data URLs in JSON column?
   - Filesystem: better for performance, requires disk management
   - Data URLs: simpler, matches current frontend, but bloats the DB

2. **Files table**: Keep or remove? Keeping it allows granular file access but requires sync with `projects.files_json`. Removing simplifies but loses individual file versioning.

3. **File history**: Do we need per-file version history? For an educational tool, probably not.
