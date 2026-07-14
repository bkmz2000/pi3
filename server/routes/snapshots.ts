import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getClient } from '../db/index.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { rateLimitPerUser } from '../middleware/rateLimitPerUser.js';
import { scanSnapshot } from '../snapshots/scanner.js';
import { getProfile } from '../profile.js';

const snapshotPublishLimit = rateLimitPerUser({ name: 'snapshot-publish', windowMs: 3600_000, max: 20 });
const forkLimit = rateLimitPerUser({ name: 'snapshot-fork', windowMs: 3600_000, max: 20 });

// Distinct account views before an author can request public listing.
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
  return randomBytes(16).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Public projection. Whether author identity is attached depends on the
// deployment profile: institutional keeps it for accountability; public
// strips it (SPP-7).
function projectPublic(row: SnapshotRow, ownerName?: string) {
  const cfg = getProfile();
  const base = {
    share_link: row.share_link,
    title: row.title,
    files: JSON.parse(row.files_json || '{}'),
    assets: JSON.parse(row.assets_json || '{}'),
    created_at: row.created_at,
    public_status: row.public_status,
    fork_count: row.fork_count,
  };
  if (cfg.snapshotPublicIncludesAuthor) {
    return { ...base, author_name: ownerName ?? null };
  }
  return base;
}

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

  router.post('/projects/:projectId/snapshot', authMiddleware, snapshotPublishLimit, async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params.projectId;
    const client = getClient();
    const project = (await client.execute(
      'SELECT id, user_id, name, files, assets FROM projects WHERE id = ?',
      [projectId],
    )).rows[0] as { id: string; user_id: string; name: string; files: string; assets: string } | undefined;
    if (!project) { res.status(404).json({ error: 'Not Found' }); return; }
    if (project.user_id !== req.user!.id) {
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
      [id, shareLink, req.user!.id, project.id, project.name,
       project.files || '{}', project.assets || '{}', now,
       scan.status, JSON.stringify(scan.findings)],
    );
    const row = (await client.execute('SELECT * FROM project_snapshots WHERE id = ?', [id])).rows[0] as unknown as SnapshotRow;
    res.status(201).json(projectOwner(row));
  });

  router.get('/mine', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const rows = (await client.execute(
      'SELECT * FROM project_snapshots WHERE owner_id = ? ORDER BY created_at DESC',
      [req.user!.id],
    )).rows as unknown as SnapshotRow[];
    res.json(rows.map(projectOwner));
  });

  router.post('/:snapshotId/revoke', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT owner_id FROM project_snapshots WHERE id = ?',
      [req.params.snapshotId],
    )).rows[0] as { owner_id: string } | undefined;
    if (!row) { res.status(404).json({ error: 'Not Found' }); return; }
    if (row.owner_id !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    await client.execute(
      'UPDATE project_snapshots SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL',
      [Date.now(), req.params.snapshotId],
    );
    res.status(204).end();
  });

  router.post('/:snapshotId/request-public', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT * FROM project_snapshots WHERE id = ?',
      [req.params.snapshotId],
    )).rows[0] as unknown as SnapshotRow | undefined;
    if (!row) { res.status(404).json({ error: 'Not Found' }); return; }
    if (row.owner_id !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
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

  router.get('/s/:shareLink', optionalAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT * FROM project_snapshots WHERE share_link = ?',
      [req.params.shareLink],
    )).rows[0] as unknown as SnapshotRow | undefined;
    if (!row) { res.status(404).json({ error: 'Not Found' }); return; }
    if (row.revoked_at !== null) {
      res.status(410).json({ error: 'Gone', message: 'This share has been revoked by its author' });
      return;
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const viewer = req.user;
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
    let ownerName: string | undefined;
    if (getProfile().snapshotPublicIncludesAuthor) {
      const ownerRow = (await client.execute('SELECT name FROM users WHERE id = ?', [row.owner_id]))
        .rows[0] as { name: string } | undefined;
      ownerName = ownerRow?.name;
    }
    res.json(projectPublic(row, ownerName));
  });

  router.post('/s/:shareLink/fork', authMiddleware, forkLimit, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const snap = (await client.execute(
      'SELECT * FROM project_snapshots WHERE share_link = ?',
      [req.params.shareLink],
    )).rows[0] as unknown as SnapshotRow | undefined;
    if (!snap) { res.status(404).json({ error: 'Not Found' }); return; }
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
      [newProjectId, req.user!.id, snap.title, snap.files_json, snap.assets_json,
       'main.py', snap.id, now, now],
    );
    await client.execute(
      'UPDATE project_snapshots SET fork_count = fork_count + 1 WHERE id = ?',
      [snap.id],
    );
    res.status(201).json({
      project_id: newProjectId,
      forked_from: {
        snapshot_id: snap.id,
        share_link: snap.share_link,
        title: snap.title,
      },
    });
  });

  return router;
}

export default createSnapshotsRouter;
