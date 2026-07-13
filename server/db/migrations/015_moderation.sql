-- 015_moderation.sql
-- SPP-8 moderation surface: user-submitted reports on shared content.
-- Kept intentionally minimal for launch — a single append-only ledger. The
-- reviewer endpoint reads this + rows with scan_status='flagged' across
-- snapshots / problems / comments to produce its queue.
--
-- No enum on `target_type` — the value is one of a small set the router
-- validates (`snapshot`, `problem`, `comment`, `share_link`). Storing as
-- TEXT keeps forward migration cheap when new share surfaces land.

CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reporter_id TEXT REFERENCES users(id),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  handled_at INTEGER,
  handled_by TEXT REFERENCES users(id),
  handled_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON content_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_open ON content_reports(handled_at, created_at) WHERE handled_at IS NULL;
