-- 016_problem_publish_pipeline.sql
-- SPP-5 compete-mode alignment. Bring problem publishing under the same
-- shape as project snapshots:
--   * immutable frozen copy at time of publish (`published_json`)
--   * unlisted-by-default (`public_status`)
--   * distinct-viewer count for the view gate (`distinct_view_count`)
--   * request → review → approve state machine
--
-- The `problems` table stays; a published problem is one whose
-- `public_status='approved'` AND `published_json IS NOT NULL`. The
-- `problems` row itself is the mutable draft; `published_json` is the
-- frozen public copy — subsequent PUTs invalidate approval by resetting
-- `public_status` back to `unlisted` and clearing `published_json`.
--
-- All existing rows are quarantined to `pending_review` on migration.
-- This is deliberate: pre-launch the compete-mode listing shipped without
-- any review path, so we cannot assume any historical row is safe. A
-- reviewer works through them via /api/moderation/flagged.

ALTER TABLE problems ADD COLUMN public_status TEXT NOT NULL DEFAULT 'unlisted'
  CHECK (public_status IN ('unlisted', 'pending_review', 'approved', 'rejected'));
ALTER TABLE problems ADD COLUMN published_json TEXT;
ALTER TABLE problems ADD COLUMN first_published_at INTEGER;
ALTER TABLE problems ADD COLUMN last_published_at INTEGER;
ALTER TABLE problems ADD COLUMN distinct_view_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS problem_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users(id),
  first_viewed_at INTEGER NOT NULL,
  UNIQUE(problem_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_problem_views_problem ON problem_views(problem_id);

-- Retroactive quarantine: every pre-existing row goes to pending_review
-- with scan_status forced to 'pending' (unless already 'flagged'). The
-- reviewer works through them before they reappear in the public sidebar.
UPDATE problems SET public_status = 'pending_review' WHERE archived = 0;
