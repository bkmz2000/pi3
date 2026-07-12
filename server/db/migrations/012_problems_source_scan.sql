-- 012_problems_source_scan.sql
-- Phase 9 compete-mode alignment with the snapshot + scan pipeline.
--
-- `source` is a *separate* field from `created_by`, per plan doctrine:
-- archive-imported problems (e.g. ВсОШ) need legitimate provenance
-- attribution that survives anonymization of the internal author link.
--
-- `scan_status` / `scan_findings` mirror the project-snapshot pipeline
-- (Phase 6): the pre-share content scanner runs at author boundaries
-- and results are held for human review when flagged.

ALTER TABLE problems ADD COLUMN source TEXT;
ALTER TABLE problems ADD COLUMN scan_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (scan_status IN ('pending', 'clean', 'flagged'));
ALTER TABLE problems ADD COLUMN scan_findings TEXT;
