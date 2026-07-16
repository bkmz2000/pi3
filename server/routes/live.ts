import { Router, Request, Response } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

// Presence pings older than this are considered stale/idle.
const STALE_MS = 5 * 60 * 1000;

export function createLiveRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // POST /api/live/presence — student writes their current file + cursor.
  // Called on a debounce from the editor (every ~3s while editing).
  router.post('/presence', async (req: Request, res: Response): Promise<void> => {
    const { project_id, file, cursor_line } = req.body as {
      project_id?: string;
      file?: string;
      cursor_line?: number;
    };
    if (!project_id || typeof project_id !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'project_id required' });
      return;
    }
    if (!file || typeof file !== 'string' || file.length > 200) {
      res.status(400).json({ error: 'Bad Request', message: 'file required' });
      return;
    }
    const line = Number.isFinite(cursor_line) && cursor_line! >= 0
      ? Math.min(Math.floor(cursor_line as number), 1_000_000)
      : 0;

    await getClient().execute(
      `INSERT INTO live_presence (student_id, project_id, file, cursor_line, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(student_id, project_id) DO UPDATE SET
         file = excluded.file,
         cursor_line = excluded.cursor_line,
         updated_at = excluded.updated_at`,
      [req.user!.id, project_id, file, line, Date.now()],
    );
    res.status(204).send();
  });

  // GET /api/live/group/:groupId — teacher polls the roster for a group.
  // Returns the latest presence row per member, joined with user + project
  // display fields. Filters to the caller's own groups.
  router.get('/group/:groupId', async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== 'teacher') {
      res.status(403).json({ error: 'Forbidden', message: 'Teachers only' });
      return;
    }
    const groupId = req.params['groupId'] as string;
    const client = getClient();
    const owns = (await client.execute(
      'SELECT 1 FROM groups WHERE id = ? AND teacher_id = ?',
      [groupId, req.user!.id],
    )).rows[0];
    if (!owns) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }

    // Pick each student's most-recently-updated presence row across all their
    // projects. LEFT JOIN so members with no ping yet still appear.
    const rows = (await client.execute(
      `SELECT
         u.id            AS student_id,
         u.name          AS student_name,
         u.handle        AS student_handle,
         lp.project_id   AS project_id,
         p.name          AS project_name,
         lp.file         AS file,
         lp.cursor_line  AS cursor_line,
         lp.updated_at   AS updated_at
       FROM group_members gm
       JOIN users u ON u.id = gm.student_id
       LEFT JOIN (
         SELECT lp1.*
         FROM live_presence lp1
         JOIN (
           SELECT student_id, MAX(updated_at) AS mx
           FROM live_presence
           GROUP BY student_id
         ) latest
           ON latest.student_id = lp1.student_id
          AND latest.mx = lp1.updated_at
       ) lp ON lp.student_id = u.id
       LEFT JOIN projects p ON p.id = lp.project_id
       WHERE gm.group_id = ?
       ORDER BY u.name`,
      [groupId],
    )).rows as {
      student_id: string;
      student_name: string;
      student_handle: string | null;
      project_id: string | null;
      project_name: string | null;
      file: string | null;
      cursor_line: number | null;
      updated_at: number | null;
    }[];

    const now = Date.now();
    const enriched = rows.map((r) => ({
      ...r,
      idle: r.updated_at == null || (now - r.updated_at) > STALE_MS,
    }));
    res.json({ members: enriched, server_now: now });
  });

  return router;
}

export default createLiveRouter;
