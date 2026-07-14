-- Content report intake for the moderation surface.
-- target_type is one of: snapshot, problem, comment, share_link.
-- target_id is a string (varies per target_type) to keep it uniform.
-- handled_* columns are NULL until a reviewer closes the report.
CREATE TABLE IF NOT EXISTS content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  handled_at INTEGER,
  handled_by TEXT,
  handled_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_reports_open
  ON content_reports (handled_at, created_at);

CREATE INDEX IF NOT EXISTS idx_content_reports_target
  ON content_reports (target_type, target_id);
