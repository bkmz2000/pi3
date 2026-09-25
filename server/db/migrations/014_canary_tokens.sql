-- Short-lived bearer credentials for the production API/UI canary.
-- Only token hashes are stored; each credential is bound to one owned project.
CREATE TABLE IF NOT EXISTS canary_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canary_tokens_user_project
  ON canary_tokens(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_canary_tokens_expiry
  ON canary_tokens(expires_at);
