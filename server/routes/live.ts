import { Router, Request, Response } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { verifySessionToken } from '../sessions/tokens.js';

// Presence pings older than this are considered stale/idle.
const STALE_MS = 5 * 60 * 1000;

// Hard cap on the live buffer we store per student. Presence is best-effort
// telemetry, so we truncate rather than reject an oversized file.
const MAX_CONTENT_CHARS = 256 * 1024;

export function createLiveRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // POST /api/live/presence — student writes their current file + cursor.
  // Called on a debounce from the editor (every ~3s while editing).
  router.post('/presence', async (req: Request, res: Response): Promise<void> => {
    const { project_id, file, cursor_line, content, content_hash, session_id } = req.body as {
      project_id?: string;
      file?: string;
      cursor_line?: number;
      content?: string;
      content_hash?: string;
      session_id?: string;
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

    // Content is optional: the client omits it when the buffer is unchanged
    // (skip-unchanged), so a null here must NOT wipe the stored buffer — we
    // COALESCE below to keep the last-known content. When present, cap it.
    const contentVal = typeof content === 'string'
      ? content.slice(0, MAX_CONTENT_CHARS)
      : null;
    const hashVal = typeof content_hash === 'string' ? content_hash.slice(0, 128) : null;
    // session_id is always authoritative (null clears it when a student leaves
    // a session), so it is written directly, not COALESCE'd.
    const sessionVal = typeof session_id === 'string' && session_id.length <= 64
      ? session_id
      : null;

    await getClient().execute(
      `INSERT INTO live_presence (student_id, project_id, file, cursor_line, updated_at, content, content_hash, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, project_id) DO UPDATE SET
         file = excluded.file,
         cursor_line = excluded.cursor_line,
         updated_at = excluded.updated_at,
         content = COALESCE(excluded.content, live_presence.content),
         content_hash = COALESCE(excluded.content_hash, live_presence.content_hash),
         session_id = excluded.session_id`,
      [req.user!.id, project_id, file, line, Date.now(), contentVal, hashVal, sessionVal],
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

  // GET /api/live/group/:groupId/member/:studentId — teacher pulls ONE
  // student's live buffer (master-detail: content is fetched only for the
  // selected student, not carried in the roster). Teacher-role + owns-group.
  router.get('/group/:groupId/member/:studentId', async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== 'teacher') {
      res.status(403).json({ error: 'Forbidden', message: 'Teachers only' });
      return;
    }
    const groupId = req.params['groupId'] as string;
    const studentId = req.params['studentId'] as string;
    const client = getClient();
    const owns = (await client.execute(
      'SELECT 1 FROM groups WHERE id = ? AND teacher_id = ?',
      [groupId, req.user!.id],
    )).rows[0];
    if (!owns) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    // Student must belong to the group — otherwise a teacher could read any
    // user's buffer by id.
    const member = (await client.execute(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?',
      [groupId, studentId],
    )).rows[0];
    if (!member) {
      res.status(404).json({ error: 'Not Found', message: 'Not a member of this group' });
      return;
    }
    res.json(await latestMemberBuffer(studentId));
  });

  // --- Session-scoped reads (public profile + institutional peer sessions) ---
  // Auth is a signed session token (?token=...), not a role. Visibility is
  // decided by the token, not the deployment profile:
  //   - symmetric  (no groupId): any member may read any member
  //   - classroom  (groupId-bound, starter = teacher): only the starter may
  //     read a peer; a joiner (student) may read only their own buffer.

  // GET /api/live/session/:sid/roster?token=...
  router.get('/session/:sid/roster', async (req: Request, res: Response): Promise<void> => {
    const verified = verifySession(req, res);
    if (!verified) return;
    const canSeePeers = !verified.groupId || verified.role === 'starter';

    const client = getClient();
    const rows = (await client.execute(
      `SELECT lp.student_id, u.name AS student_name, u.handle AS student_handle,
              lp.file, lp.cursor_line, lp.updated_at
       FROM live_presence lp
       JOIN users u ON u.id = lp.student_id
       JOIN (
         SELECT student_id, MAX(updated_at) AS mx
         FROM live_presence WHERE session_id = ?
         GROUP BY student_id
       ) latest ON latest.student_id = lp.student_id AND latest.mx = lp.updated_at
       WHERE lp.session_id = ?${canSeePeers ? '' : ' AND lp.student_id = ?'}
       ORDER BY u.name`,
      canSeePeers ? [verified.sid, verified.sid] : [verified.sid, verified.sid, req.user!.id],
    )).rows as {
      student_id: string;
      student_name: string | null;
      student_handle: string | null;
      file: string | null;
      cursor_line: number | null;
      updated_at: number | null;
    }[];

    const now = Date.now();
    const members = rows.map((r) => ({
      ...r,
      idle: r.updated_at == null || (now - r.updated_at) > STALE_MS,
    }));
    res.json({ members, server_now: now, role: verified.role });
  });

  // GET /api/live/session/:sid/member/:studentId?token=...
  router.get('/session/:sid/member/:studentId', async (req: Request, res: Response): Promise<void> => {
    const verified = verifySession(req, res);
    if (!verified) return;
    const studentId = req.params['studentId'] as string;
    const canSeePeers = !verified.groupId || verified.role === 'starter';
    if (studentId !== req.user!.id && !canSeePeers) {
      res.status(403).json({ error: 'Forbidden', message: 'Cannot view another member in this session' });
      return;
    }
    res.json(await latestMemberBuffer(studentId, verified.sid));
  });

  // Verify a session token from ?token=... and that it matches :sid. Writes the
  // error response and returns null on failure.
  function verifySession(req: Request, res: Response) {
    const token = typeof req.query['token'] === 'string' ? req.query['token'] : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'session token required (?token=...)' });
      return null;
    }
    const verified = verifySessionToken(token, req.user!.id);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
      return null;
    }
    if (verified.sid !== req.params['sid']) {
      res.status(403).json({ error: 'Forbidden', message: 'token does not match session' });
      return null;
    }
    return verified;
  }

  // Latest live buffer for one student, optionally scoped to a session.
  async function latestMemberBuffer(studentId: string, sessionId?: string) {
    const row = (await getClient().execute(
      `SELECT file, cursor_line, content, updated_at
       FROM live_presence
       WHERE student_id = ?${sessionId ? ' AND session_id = ?' : ''}
       ORDER BY updated_at DESC LIMIT 1`,
      sessionId ? [studentId, sessionId] : [studentId],
    )).rows[0] as { file: string; cursor_line: number; content: string | null; updated_at: number } | undefined;
    if (!row) {
      return { file: null, cursor_line: null, content: null, updated_at: null, idle: true };
    }
    return {
      file: row.file,
      cursor_line: row.cursor_line,
      content: row.content,
      updated_at: row.updated_at,
      idle: (Date.now() - row.updated_at) > STALE_MS,
    };
  }

  return router;
}

export default createLiveRouter;
