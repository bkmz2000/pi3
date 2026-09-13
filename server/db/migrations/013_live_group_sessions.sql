CREATE TABLE IF NOT EXISTS live_group_sessions (
  group_id TEXT PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  sid TEXT NOT NULL UNIQUE,
  starter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_group_sessions_expires
  ON live_group_sessions(expires_at);
