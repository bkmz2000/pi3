ALTER TABLE users ADD COLUMN handle TEXT;
ALTER TABLE users ADD COLUMN handle_seq INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_lower
  ON users(lower(handle)) WHERE handle IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_seq
  ON users(handle_seq) WHERE handle_seq IS NOT NULL;
-- Each user is assigned a monotonic handle_seq; the display handle is derived
-- by a coprime-stride bijection into (color, trait, animal) space. Uniqueness
-- is guaranteed by the math up to A*B*C users — after that, a generation
-- suffix is appended. See server/db/handle.ts.
