import { Router, Request, Response } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export function createHelpRequestsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // List help requests visible to the caller. Role gate removed; scoping is
  // already provided by `g.teacher_id = ?` (the caller owns the group whose
  // members submitted the requests). A caller who owns no such group gets
  // an empty list, not a 403.
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const groupId = req.query['group_id'] as string | undefined;

    if (groupId) {
      const result = await client.execute(
        `SELECT hr.id, hr.status, hr.created_at,
                p.id as project_id, p.name as project_name,
                u.id as student_id, u.handle as student_handle
         FROM help_requests hr
         JOIN project_shares ps ON ps.project_id = hr.project_id AND ps.user_id = ?
         JOIN projects p ON p.id = hr.project_id
         JOIN users u ON u.id = hr.student_id
         JOIN group_members gm ON gm.student_id = hr.student_id AND gm.group_id = ?
         JOIN groups g ON g.id = gm.group_id AND g.teacher_id = ?
         WHERE hr.status IN ('pending', 'in_progress')
         ORDER BY hr.created_at ASC`,
        [req.user!.id, groupId, req.user!.id],
      );
      res.json(result.rows);
    } else {
      const result = await client.execute(
        `SELECT hr.id, hr.status, hr.created_at,
                p.id as project_id, p.name as project_name,
                u.id as student_id, u.handle as student_handle
         FROM help_requests hr
         JOIN project_shares ps ON ps.project_id = hr.project_id AND ps.user_id = ?
         JOIN projects p ON p.id = hr.project_id
         JOIN users u ON u.id = hr.student_id
         JOIN group_members gm ON gm.student_id = hr.student_id
         JOIN groups g ON g.id = gm.group_id AND g.teacher_id = ?
         WHERE hr.status = 'pending'
         ORDER BY hr.created_at ASC`,
        [req.user!.id, req.user!.id],
      );
      res.json(result.rows);
    }
  });

  // Update help request status. Role gate removed; the query below scopes to
  // help requests visible to the caller (via project_shares.user_id = ?), so
  // an account with no visibility gets 404 by the existing lookup, not 403.
  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const hrId = req.params['id'] as string;
    const { status } = req.body as { status?: string };
    if (status !== undefined && status !== 'in_progress' && status !== 'addressed') {
      res.status(400).json({ error: 'Bad Request', message: 'status must be in_progress or addressed' });
      return;
    }
    const newStatus = status === 'in_progress' ? 'in_progress' : 'addressed';

    const client = getClient();
    const hr = (await client.execute(
      `SELECT hr.id, hr.status FROM help_requests hr
       JOIN project_shares ps ON ps.project_id = hr.project_id AND ps.user_id = ?
       WHERE hr.id = ?`,
      [req.user!.id, hrId],
    )).rows[0] as { id: string; status: string } | undefined;
    if (!hr) {
      res.status(404).json({ error: 'Not Found', message: 'Help request not found' });
      return;
    }
    if (hr.status === 'addressed') {
      res.status(400).json({ error: 'Bad Request', message: 'Help request is already addressed' });
      return;
    }
    const now = Date.now();
    if (newStatus === 'addressed') {
      await client.execute(
        'UPDATE help_requests SET status = ?, addressed_by = ?, addressed_at = ?, updated_at = ? WHERE id = ?',
        ['addressed', req.user!.id, now, now, hrId],
      );
    } else {
      await client.execute(
        'UPDATE help_requests SET status = ?, updated_at = ? WHERE id = ?',
        ['in_progress', now, hrId],
      );
    }
    res.json({ id: hrId, status: newStatus });
  });

  return router;
}

export default createHelpRequestsRouter;
