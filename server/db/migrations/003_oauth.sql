ALTER TABLE users ADD COLUMN oauth_provider_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_provider_id
  ON users(oauth_provider_id) WHERE oauth_provider_id IS NOT NULL;
