-- Live-code transport: carry the current file's text alongside presence so a
-- teacher (or a session peer) can watch the buffer, not just file+line. The
-- roster stays cheap — clients push `content` only when `content_hash` changes,
-- and readers fetch content one member at a time.
--
-- `session_id` lets token-only ephemeral sessions self-register their member
-- set: a client in a session stamps its pings with the session id, so a
-- session roster is just the presence rows sharing that id (no member table).
ALTER TABLE live_presence ADD COLUMN content TEXT;
ALTER TABLE live_presence ADD COLUMN content_hash TEXT;
ALTER TABLE live_presence ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_live_presence_session ON live_presence (session_id);
