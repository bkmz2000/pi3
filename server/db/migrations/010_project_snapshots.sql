-- 010_project_snapshots.sql
-- Immutable snapshots produced by the private→share boundary.
-- Per SPP-5, publishing anything is a snapshot;
-- private originals stay account-linked and editable; a share/publish action
-- stamps an immutable, author-unlinked copy. New edits require a new snapshot.
--
-- Per SPP-7, owner_id is *internal-only*. It exists solely for
-- (a) letting the author manage/revoke their own shares and (b) catching
-- repeat abuse. No public endpoint may expose it.

CREATE TABLE IF NOT EXISTS project_snapshots (
  id TEXT PRIMARY KEY,
  share_link TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  original_project_id TEXT,
  title TEXT NOT NULL,
  files_json TEXT NOT NULL,
  assets_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged')),
  scan_findings TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  public_status TEXT NOT NULL DEFAULT 'unlisted' CHECK (public_status IN ('unlisted', 'requested', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_owner ON project_snapshots(owner_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_snapshots_share_link ON project_snapshots(share_link);

-- Distinct-viewer counter, per Safety & Privacy Design Principle re: Phase 7.
-- Only distinct logged-in-account views count toward the request-to-publish
-- threshold. viewer_id is a stable user id, not an IP or anonymous cookie.
CREATE TABLE IF NOT EXISTS snapshot_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL REFERENCES project_snapshots(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users(id),
  first_viewed_at INTEGER NOT NULL,
  UNIQUE(snapshot_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_snapshot_views_snapshot ON snapshot_views(snapshot_id);
