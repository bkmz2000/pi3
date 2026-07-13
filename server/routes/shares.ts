import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getProjectAccess } from '../middleware/projectAuth.js';

// SPP-3 (tripwire) precondition. Two accounts may only enter a project-share
// relationship if they already share at least one group — i.e. both appear
// in `group_members` for a common `group_id`. Symmetric interpretation:
// peer-in-same-class counts, not only owner-of-group ↔ member.
//
// Without this check, POST /shares was a unilateral first-contact vector:
// an owner who knew a target's user id could push a share onto their account
// with no prior relationship. See docs/audit-2026-07-13-project-shares-and-
// comments.md finding S2.
async function shareOwnerAndTargetShareAGroup(ownerId: string, targetId: string): Promise<boolean> {
  // "In the same group" means the two account ids both appear on the
  // group — either as the creator (`groups.teacher_id`) or as a joined
  // member (`group_members.student_id`). CTE unions both sides so the
  // relationship is symmetric.
  const row = (await getClient().execute(
    `WITH memberships AS (
       SELECT id AS group_id, teacher_id AS user_id FROM groups
       UNION ALL
       SELECT group_id, student_id AS user_id FROM group_members
     )
     SELECT 1 AS ok
     FROM memberships m1
     JOIN memberships m2 ON m2.group_id = m1.group_id
     WHERE m1.user_id = ? AND m2.user_id = ?
     LIMIT 1`,
    [ownerId, targetId],
  )).rows[0];
  return !!row;
}

interface ProjectShare {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: number;
  updated_at: number;
}

async function requireOwner(projectId: string, userId: string, res: Response): Promise<boolean> {
  const access = await getProjectAccess(projectId, userId);
  if (!access.exists) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return false;
  }
  if (access.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden', message: 'Only owner can manage project shares' });
    return false;
  }
  return true;
}

export function createSharesRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params.id as string;
    // S1: legacy `username` (which resolved via u.name) is removed. Handle
    // is the identifier, or the opaque uuid via `user_id`. Any callers still
    // sending `username` are ignored and rejected below.
    const { user_id, handle, role = 'viewer' } = req.body;
    const client = getClient();

    if (!await requireOwner(projectId, req.user!.id, res)) return;

    const targetLookup: [string, string] | null =
      (typeof user_id === 'string' && user_id.length > 0) ? ['id', user_id] :
      (typeof handle === 'string' && handle.trim().length > 0) ? ['handle', handle.trim().replace(/^@+/, '')] :
      null;
    if (!targetLookup) {
      res.status(400).json({ error: 'Bad Request', message: 'user_id or handle is required' });
      return;
    }

    if (!['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid role. Must be editor or viewer' });
      return;
    }

    const [lookupField, lookupValue] = targetLookup;
    const targetUser = (await client.execute(
      lookupField === 'id'
        ? 'SELECT id FROM users WHERE id = ?'
        : 'SELECT id FROM users WHERE LOWER(handle) = LOWER(?)',
      [lookupValue],
    )).rows[0] as { id: string } | undefined;

    if (!targetUser) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    if (targetUser.id === req.user!.id) {
      res.status(400).json({ error: 'Bad Request', message: 'Cannot share with yourself' });
      return;
    }

    // S2 (SPP-3 tripwire): reject share creation between two accounts that
    // have no pre-existing relationship. Both must appear on at least one
    // common group. Bootstrap path: use POST /api/groups/:id/invite or a
    // shared invite code first — then shares become reachable.
    if (!(await shareOwnerAndTargetShareAGroup(req.user!.id, targetUser.id))) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You and this user are not in the same group. Invite them to a group first.',
      });
      return;
    }

    const existingShare = (await client.execute(
      'SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?',
      [projectId, targetUser.id],
    )).rows[0];
    if (existingShare) {
      res.status(409).json({ error: 'Conflict', message: 'Project already shared with this user' });
      return;
    }

    const now = Date.now();
    const share: ProjectShare = {
      id: uuidv4(),
      project_id: projectId,
      user_id: targetUser.id as string,
      role,
      created_at: now,
      updated_at: now,
    };

    try {
      await client.batch([
        {
          sql: `INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [share.id, share.project_id, share.user_id, share.role, share.created_at, share.updated_at],
        },
        { sql: 'UPDATE projects SET updated_at = ? WHERE id = ?', args: [now, projectId] },
      ]);

      res.status(201).json({
        id: share.id,
        project_id: share.project_id,
        user_id: share.user_id,
        role: share.role,
        created_at: share.created_at,
      });
    } catch (error) {
      console.error('Error sharing project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to share project' });
    }
  });

  router.delete('/:userId', async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params.id as string;
    const userId = req.params.userId as string;
    const client = getClient();

    if (!await requireOwner(projectId, req.user!.id, res)) return;

    const share = (await client.execute(
      'SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?',
      [projectId, userId],
    )).rows[0] as unknown as ProjectShare | undefined;

    if (!share) {
      res.status(404).json({ error: 'Not Found', message: 'Share not found' });
      return;
    }

    try {
      const now = Date.now();
      await client.batch([
        { sql: 'DELETE FROM project_shares WHERE id = ?', args: [share.id] },
        { sql: 'UPDATE projects SET updated_at = ? WHERE id = ?', args: [now, projectId] },
      ]);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing share:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove share' });
    }
  });

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params.id as string;
    const client = getClient();

    if (!await requireOwner(projectId, req.user!.id, res)) return;

    // S3 / SPP-2: handle-only projection. `u.name` is legacy grandfathered
    // data and never rendered to any endpoint.
    const result = await client.execute(
      `SELECT ps.id, ps.user_id, ps.role, ps.created_at, u.handle as user_handle
       FROM project_shares ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.project_id = ?
       ORDER BY ps.created_at ASC`,
      [projectId],
    );

    res.json(result.rows);
  });

  return router;
}

export default createSharesRouter;
