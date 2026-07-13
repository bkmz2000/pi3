-- 014_project_comments_scan.sql
-- Bring project comments under the SPP-6 content-scan pipeline (Option B
-- from docs/audit-2026-07-13-project-shares-and-comments.md). Same
-- three-value scan_status enum as project_snapshots (010) and problems
-- (012). Flagged comments are stored but marked for human review; the
-- moderation queue is a separate concern.

ALTER TABLE comments ADD COLUMN scan_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (scan_status IN ('pending', 'clean', 'flagged'));
ALTER TABLE comments ADD COLUMN scan_findings TEXT;
