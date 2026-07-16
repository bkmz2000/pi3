-- Live-presence pings from student editors: what file they have open and
-- what line the cursor sits on. Teacher dashboard reads these to show the
-- classroom-wide activity roster.
--
-- One row per (student, project). Overwritten on every ping. Rows older than
-- ~5 min are considered idle by the teacher UI (no server-side sweep needed).
CREATE TABLE IF NOT EXISTS live_presence (
  student_id   TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  file         TEXT NOT NULL,
  cursor_line  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (student_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_live_presence_updated ON live_presence (updated_at);
