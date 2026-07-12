-- 011_snapshot_forks.sql
-- Phase 8 fork/remix model. Per Safety & Privacy Design Principle #3
-- (tripwire — no first-contact between strangers), the original snapshot
-- only ever exposes an aggregate fork_count; there is no endpoint that
-- enumerates or links to individual forks or their owners.

ALTER TABLE project_snapshots ADD COLUMN fork_count INTEGER NOT NULL DEFAULT 0;

-- A fork is a private copy in the forker's own account. The optional
-- one-directional backlink `forked_from_snapshot_id` points at the parent
-- snapshot; the parent snapshot never gets a reverse list of its children.
ALTER TABLE projects ADD COLUMN forked_from_snapshot_id TEXT;
