import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getClient } from '../db/index.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { scanSnapshot } from '../snapshots/scanner.js';

// Threshold of distinct account views before an author can request to make a
// snapshot publicly discoverable. Phase 7 doctrine. Tunable.
const PUBLIC_REQUEST_VIEW_THRESHOLD = 5;

type SnapshotRow = {
  id: string;
  share_link: string;
  owner_id: string;
  original_project_id: string | null;
  title: string;
  files_json: string;
  assets_json: string;
  created_at: number;
  revoked_at: number | null;
  scan_status: 'pending' | 'clean' | 'flagged';
  scan_findings: string | null;
  view_count: number;
  fork_count: number;
  public_status: 'unlisted' | 'requested' | 'approved' | 'rejected';
};

function newShareLink(): string {
  // ~22 chars base64url — unguessable, URL-safe, short enough to send.
  return randomBytes(16).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The public projection strips owner_id and any internal state, per P#7.
// Fork count is an *aggregate* — no endpoint enumerates the forks — so it is
// safe to expose (P#3 aggregate-stats-only clause).
function projectPublic(row: SnapshotRow) {
  return {
    share_link: row.share_link,
    title: row.title,
    files: JSON.parse(row.files_json || '{}'),
    assets: JSON.parse(row.assets_json || '{}'),
    created_at: row.created_at,
    public_status: row.public_status,
    fork_count: row.fork_count,
  };
}

// The owner projection includes the internal management fields — id,
// scan_status, view_count, public_status, revoked_at — but is only ever
// served to the row's owner_id.
function projectOwner(row: SnapshotRow) {
  return {
    id: row.id,
    share_link: row.share_link,
    title: row.title,
    original_project_id: row.original_project_id,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
    scan_status: row.scan_status,
    scan_findings: row.scan_findings ? JSON.parse(row.scan_findings) : [],
    view_count: row.view_count,
    fork_count: row.fork_count,
    public_status: row.public_status,
  };
}

export function createSnapshotsRouter(): Router {
  const router = Router();

  // Create a snapshot of a project the caller owns. Runs the pre-share
  // content scanner (Phase 6). If flagged, the snapshot is still stored but
  // held in scan_status='flagged' until a human reviewer clears it.
  router.post('/projects/:projectId/snapshot', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const projectId = req.params.projectId;
    const client = getClient();
    const project = (await client.execute(
      'SELECT id, user_id, name, files, assets FROM projects WHERE id = ?',
      [projectId],
    )).rows[0] as { id: string; user_id: string; name: string; files: string; assets: string } | undefined;
    if (!project) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (project.user_id !== req.user.id) {
      res.status(403).json({ error: 'Forbidden', message: 'Only the project owner can snapshot' });
      return;
    }

    const files = JSON.parse(project.files || '{}') as Record<string, string>;
    const assets = JSON.parse(project.assets || '{}') as Record<string, unknown>;
    const scan = scanSnapshot({ title: project.name, files, assets });

    const id = uuidv4();
    const shareLink = newShareLink();
    const now = Date.now();
    await client.execute(
      `INSERT INTO project_snapshots
        (id, share_link, owner_id, original_project_id, title, files_json, assets_json,
         created_at, scan_status, scan_findings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, shareLink, req.user.id, project.id, project.name,
       project.files || '{}', project.assets || '{}', now,
       scan.status, JSON.stringify(scan.findings)],
    );
    const row = (await client.execute('SELECT * FROM project_snapshots WHERE id = ?', [id])).rows[0] as unknown as SnapshotRow;
    res.status(201).json(projectOwner(row));
  });

  // List the caller's own snapshots — internal projection, includes id, scan
  // status, view count, etc.
  router.get('/mine', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const client = getClient();
    const rows = (await client.execute(
      'SELECT * FROM project_snapshots WHERE owner_id = ? ORDER BY created_at DESC',
      [req.user.id],
    )).rows as unknown as SnapshotRow[];
    res.json(rows.map(projectOwner));
  });

  // Owner-only revoke — sets revoked_at, public reads then 410.
  router.post('/:snapshotId/revoke', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const client = getClient();
    const row = (await client.execute(
      'SELECT owner_id FROM project_snapshots WHERE id = ?',
      [req.params.snapshotId],
    )).rows[0] as { owner_id: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (row.owner_id !== req.user.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await client.execute(
      'UPDATE project_snapshots SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
      [Date.now(), req.params.snapshotId],
    );
    res.status(204).end();
  });

  // Author requests that an unlisted snapshot be made publicly discoverable.
  // Gated by (a) scan_status='clean' AND (b) distinct view count over the
  // threshold. Per Phase 7 doctrine, this only *requests* review — a human
  // reviewer approves before the snapshot appears on any discover surface.
  router.post('/:snapshotId/request-public', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const client = getClient();
    const row = (await client.execute(
      'SELECT * FROM project_snapshots WHERE id = ?',
      [req.params.snapshotId],
    )).rows[0] as unknown as SnapshotRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (row.owner_id !== req.user.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (row.revoked_at !== null) {
      res.status(409).json({ error: 'Conflict', message: 'Snapshot is revoked' });
      return;
    }
    if (row.scan_status !== 'clean') {
      res.status(409).json({ error: 'Conflict', message: 'Snapshot has open scanner findings' });
      return;
    }
    if (row.view_count < PUBLIC_REQUEST_VIEW_THRESHOLD) {
      res.status(409).json({
        error: 'Conflict',
        message: `Need at least ${PUBLIC_REQUEST_VIEW_THRESHOLD} distinct viewers before requesting public listing (currently ${row.view_count}).`,
      });
      return;
    }
    if (row.public_status !== 'unlisted') {
      res.status(409).json({ error: 'Conflict', message: `Cannot request from status '${row.public_status}'` });
      return;
    }
    await client.execute(
      "UPDATE project_snapshots SET public_status = 'requested' WHERE id = ?",
      [req.params.snapshotId],
    );
    res.status(204).end();
  });

  // Public read by share_link. Anonymous callers get the content; a logged-in
  // caller who isn't the owner is counted toward distinct-view tally.
  // Never exposes owner_id, scan_status, or view_count publicly.
  router.get('/s/:shareLink', optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT * FROM project_snapshots WHERE share_link = ?',
      [req.params.shareLink],
    )).rows[0] as unknown as SnapshotRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (row.revoked_at !== null) {
      res.status(410).json({ error: 'Gone', message: 'This share has been revoked by its author' });
      return;
    }
    // Robots directive; per Phase 7 unlisted-by-default doctrine.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    // Distinct-viewer counter. Uses UNIQUE(snapshot_id, viewer_id) as the
    // idempotency mechanism; INSERT OR IGNORE is atomic against races.
    const viewer = (req as Request & { user?: { id: string } }).user;
    if (viewer && viewer.id !== row.owner_id) {
      const insertResult = await client.execute(
        `INSERT OR IGNORE INTO snapshot_views (snapshot_id, viewer_id, first_viewed_at) VALUES (?, ?, ?)`,
        [row.id, viewer.id, Date.now()],
      );
      if (insertResult.rowsAffected > 0) {
        await client.execute(
          'UPDATE project_snapshots SET view_count = view_count + 1 WHERE id = ?',
          [row.id],
        );
      }
    }
    res.json(projectPublic(row));
  });

  // Fork a snapshot into a new private project owned by the caller.
  // Per Phase 8, the fork is a private copy — it does not auto-publish.
  // The parent snapshot's fork_count is incremented as an aggregate stat;
  // NO endpoint returns the list of forks or their owners for a given
  // snapshot (verified in the test suite by omission).
  router.post('/s/:shareLink/fork', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const client = getClient();
    const snap = (await client.execute(
      'SELECT * FROM project_snapshots WHERE share_link = ?',
      [req.params.shareLink],
    )).rows[0] as unknown as SnapshotRow | undefined;
    if (!snap) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (snap.revoked_at !== null) {
      res.status(410).json({ error: 'Gone', message: 'Cannot fork a revoked share' });
      return;
    }
    const newProjectId = uuidv4();
    const now = Date.now();
    await client.execute(
      `INSERT INTO projects (id, user_id, name, files, assets, current_file,
                             forked_from_snapshot_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newProjectId, req.user.id, snap.title, snap.files_json, snap.assets_json,
       'main.py', snap.id, now, now],
    );
    await client.execute(
      'UPDATE project_snapshots SET fork_count = fork_count + 1 WHERE id = ?',
      [snap.id],
    );
    res.status(201).json({
      project_id: newProjectId,
      // One-directional backlink metadata the client can render, if desired,
      // as "forked from [title]". No reverse list from parent → forks exists.
      forked_from: {
        snapshot_id: snap.id,
        share_link: snap.share_link,
        title: snap.title,
      },
    });
  });

  return router;
}
