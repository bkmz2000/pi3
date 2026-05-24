import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getProjectAccess } from '../middleware/projectAuth.js';

interface ProjectShare {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: number;
  updated_at: number;
}

function requireOwner(projectId: string, userId: string, res: Response): boolean {
  const access = getProjectAccess(projectId, userId);
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

  router.post('/', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const { username, user_id, role = 'viewer' } = req.body;
    const db = getDb();

    if (!requireOwner(projectId, req.user!.id, res)) return;

    if ((!username || typeof username !== 'string') && (!user_id || typeof user_id !== 'string')) {
      res.status(400).json({ error: 'Bad Request', message: 'username or user_id is required' });
      return;
    }

    if (!['editor', 'viewer'].includes(role)) {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid role. Must be editor or viewer' });
      return;
    }

    const targetUser = user_id
      ? db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as { id: string } | undefined
      : db.prepare('SELECT id FROM users WHERE name = ?').get(username.trim()) as { id: string } | undefined;

    if (!targetUser) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    if (targetUser.id === req.user!.id) {
      res.status(400).json({ error: 'Bad Request', message: 'Cannot share with yourself' });
      return;
    }

    const existingShare = db.prepare('SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?').get(projectId, targetUser.id);
    if (existingShare) {
      res.status(409).json({ error: 'Conflict', message: 'Project already shared with this user' });
      return;
    }

    const now = Date.now();
    const share: ProjectShare = {
      id: uuidv4(),
      project_id: projectId,
      user_id: targetUser.id,
      role,
      created_at: now,
      updated_at: now,
    };

    try {
      db.transaction(() => {
        db.prepare(`
          INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(share.id, share.project_id, share.user_id, share.role, share.created_at, share.updated_at);
        db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
      })();

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

  router.delete('/:userId', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const userId = req.params.userId as string;
    const db = getDb();

    if (!requireOwner(projectId, req.user!.id, res)) return;

    const share = db.prepare('SELECT * FROM project_shares WHERE project_id = ? AND user_id = ?').get(projectId, userId) as ProjectShare | undefined;

    if (!share) {
      res.status(404).json({ error: 'Not Found', message: 'Share not found' });
      return;
    }

    try {
      const now = Date.now();
      db.transaction(() => {
        db.prepare('DELETE FROM project_shares WHERE id = ?').run(share.id);
        db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
      })();
      res.status(204).send();
    } catch (error) {
      console.error('Error removing share:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to remove share' });
    }
  });

  router.get('/', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const db = getDb();

    if (!requireOwner(projectId, req.user!.id, res)) return;

    const shares = db.prepare(`
      SELECT ps.id, ps.user_id, ps.role, ps.created_at, u.name as user_name, u.handle as user_handle
      FROM project_shares ps
      JOIN users u ON ps.user_id = u.id
      WHERE ps.project_id = ?
      ORDER BY ps.created_at ASC
    `).all(projectId);

    res.json(shares);
  });

  return router;
}

export default createSharesRouter;