import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/index.js';
import { first } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { getProjectAccess, hasRole } from '../middleware/projectAuth.js';
import { scanSnapshot } from '../snapshots/scanner.js';

// Comment length cap. SPP-6 / SPP-8 supplementary control (finding C3 from
// docs/audit-2026-07-13-project-shares-and-comments.md): even before the
// scanner runs, a 200-char cap materially reduces the disclosure bandwidth
// of the channel without hurting the code-review teaching use case ("check
// line 12, you're mutating the list while iterating it" fits comfortably).
const COMMENT_MAX_LEN = 200;

interface CommentRow {
  id: string;
  project_id: string;
  file_path: string;
  line_number: number;
  anchor_text: string;
  text: string;
  author_id: string;
  created_at: number;
}

// `isTeacher` helper removed under SPP-1
// (no persistent roles). Comment-write authorization is now purely a
// share-access check — anyone with editor/viewer access on a project can
// leave a comment on it. See the POST handler below.

// Router for /api/projects/:id/comments
export function createProjectCommentsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params['id'] as string;
    const access = await getProjectAccess(projectId, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (!hasRole(access, 'viewer')) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }
    const { file } = req.query;
    const client = getClient();
    // C2 / SPP-2: handle-only projection. `u.name` dropped.
    //
    // Structural review gate: a flagged comment is NOT returned to anyone
    // except its own author until a human moderator clears it to `clean`.
    // The author sees their own pending/flagged comments so they know the
    // write went through and can edit/delete it; other share-holders do
    // not, so a disclosure can't reach the reader before review. This
    // matches the snapshot-pipeline pattern where unapproved content is
    // structurally unreachable, per SPP-8 layered moderation. Without this
    // filter, `scan_status` was purely advisory-after-the-fact — a log,
    // not a gate.
    const viewerId = req.user!.id;
    let result;
    if (file && typeof file === 'string') {
      result = await client.execute(
        `SELECT c.*, u.handle as author_handle
         FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.project_id = ? AND c.file_path = ?
           AND (c.scan_status != 'flagged' OR c.author_id = ?)
         ORDER BY c.line_number ASC, c.created_at ASC`,
        [projectId, file, viewerId],
      );
    } else {
      result = await client.execute(
        `SELECT c.*, u.handle as author_handle
         FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.project_id = ?
           AND (c.scan_status != 'flagged' OR c.author_id = ?)
         ORDER BY c.file_path ASC, c.line_number ASC, c.created_at ASC`,
        [projectId, viewerId],
      );
    }
    res.json(result.rows);
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params['id'] as string;
    const access = await getProjectAccess(projectId, req.user!.id);
    const hasShare = access.role === 'editor' || access.role === 'viewer';
    if (!hasShare) {
      res.status(403).json({ error: 'Forbidden', message: 'Share access is required to add comments' });
      return;
    }
    const { file_path, line_number, anchor_text, text } = req.body;
    if (!file_path || typeof file_path !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'file_path is required' });
      return;
    }
    if (typeof line_number !== 'number' || line_number < 1) {
      res.status(400).json({ error: 'Bad Request', message: 'line_number must be a positive integer' });
      return;
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'text is required' });
      return;
    }
    // C3 length cap on both `text` and `anchor_text`.
    const trimmedText = text.trim();
    const anchor = typeof anchor_text === 'string' ? anchor_text : '';
    if (trimmedText.length > COMMENT_MAX_LEN) {
      res.status(400).json({ error: 'Bad Request', message: `text must be at most ${COMMENT_MAX_LEN} characters` });
      return;
    }
    if (anchor.length > COMMENT_MAX_LEN) {
      res.status(400).json({ error: 'Bad Request', message: `anchor_text must be at most ${COMMENT_MAX_LEN} characters` });
      return;
    }
    // Option B (C1): run the same content scanner used by project snapshots
    // (SPP-6). anchor_text and text are both scanned. If flagged, the
    // comment is *stored*, not blocked (SPP-8 layered moderation) — client
    // receives 201 with scan_status='flagged' so the UI can hold display
    // behind a review marker if it chooses.
    const scan = scanSnapshot({
      title: '',
      files: {
        'comment.txt': trimmedText,
        'anchor.txt': anchor,
      },
    });
    const client = getClient();
    const now = Date.now();
    const id = uuidv4();
    await client.execute(
      `INSERT INTO comments (id, project_id, file_path, line_number, anchor_text, text,
                             author_id, created_at, scan_status, scan_findings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, projectId, file_path, line_number, anchor, trimmedText, req.user!.id, now,
       scan.status, JSON.stringify(scan.findings)],
    );
    const row = (await client.execute(
      `SELECT c.*, u.handle as author_handle
       FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
      [id],
    )).rows[0];
    res.status(201).json(row);
  });

  router.delete('/:commentId', async (req: Request, res: Response): Promise<void> => {
    const commentId = req.params['commentId'] as string;
    const client = getClient();
    const comment = first<CommentRow>(await client.execute(
      'SELECT * FROM comments WHERE id = ?',
      [commentId],
    ));
    if (!comment) {
      res.status(404).json({ error: 'Not Found', message: 'Comment not found' });
      return;
    }
    if (comment.author_id !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden', message: 'Only the author can delete a comment' });
      return;
    }
    await client.execute('DELETE FROM comments WHERE id = ?', [commentId]);
    res.status(204).send();
  });

  return router;
}

export default createProjectCommentsRouter;
