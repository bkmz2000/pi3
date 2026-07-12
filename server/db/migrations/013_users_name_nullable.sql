-- 013_users_name_nullable.sql
-- Safety & Privacy Design Principle #2: no PII collected from students, ever.
-- Auto-generated handle is the sole identifier; `name` is legacy-only,
-- retained for existing rows and never written for new student accounts.
--
-- SQLite doesn't support ALTER COLUMN DROP NOT NULL, so this is a
-- table rebuild. All existing data is preserved.

CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  api_token TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  password_hash TEXT,
  handle TEXT,
  handle_seq INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO users_new (id, api_token, name, role, password_hash, handle, handle_seq, created_at, updated_at)
  SELECT id, api_token, name, role, password_hash, handle, handle_seq, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_api_token ON users(api_token);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
