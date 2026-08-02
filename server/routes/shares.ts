import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getProjectAccess } from '../middleware/projectAuth.js';
import { rateLimitPerUser } from '../middleware/rateLimitPerUser.js';

const shareCreateLimit = rateLimitPerUser({ name: 'share-create', windowMs: 3600_000, max: 30 });

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

  router.post('/', shareCreateLimit, async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params.id as string;
    const { username, user_id, role = 'viewer' } = req.body;
    const client = getClient();

    if (!await requireOwner(projectId, req.user!.id, res)) return;

    if ((!username || typeof username !== 'string') && (!user_id || typeof user_id !== 'string')) {
      res.status(400).json({ error: 'Bad Request', message: 'username or user_id is required' });
      return;
    }

    if (!['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid role. Must be editor or viewer' });
      return;
    }

    const targetUser = (await client.execute(
      user_id
        ? 'SELECT id FROM users WHERE id = ?'
        : 'SELECT id FROM users WHERE name = ?',
      [user_id ? user_id : username.trim()],
    )).rows[0] as { id: string } | undefined;

    if (!targetUser) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    if (targetUser.id === req.user!.id) {
      res.status(400).json({ error: 'Bad Request', message: 'Cannot share with yourself' });
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

    const result = await client.execute(
      `SELECT ps.id, ps.user_id, ps.role, ps.created_at, u.name as user_name, u.handle as user_handle
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
