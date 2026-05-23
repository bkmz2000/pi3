ALTER TABLE groups ADD COLUMN invite_code TEXT;
ALTER TABLE groups ADD COLUMN archived_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_code
  ON groups(invite_code) WHERE invite_code IS NOT NULL;
