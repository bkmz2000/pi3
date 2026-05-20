import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

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

function hasAccess(projectId: string, userId: string): 'owner' | 'viewer' | null {
  const db = getDb();
  const project = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(projectId) as { user_id: string } | undefined;
  if (!project) return null;
  if (project.user_id === userId) return 'owner';
  const share = db.prepare('SELECT id FROM project_shares WHERE project_id = ? AND user_id = ?').get(projectId, userId);
  return share ? 'viewer' : null;
}

function isTeacher(userId: string): boolean {
  const db = getDb();
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string } | undefined;
  return user?.role === 'teacher';
}

// Router for /api/projects/:id/comments
export function createProjectCommentsRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response): void => {
    const projectId = req.params['id'] as string;
    if (!hasAccess(projectId, req.user!.id)) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }
    const { file } = req.query;
    const db = getDb();
    let rows;
    if (file && typeof file === 'string') {
      rows = db.prepare(`
        SELECT c.*, u.name as author_name
        FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.project_id = ? AND c.file_path = ?
        ORDER BY c.line_number ASC, c.created_at ASC
      `).all(projectId, file);
    } else {
      rows = db.prepare(`
        SELECT c.*, u.name as author_name
        FROM comments c JOIN users u ON u.id = c.author_id
        WHERE c.project_id = ?
        ORDER BY c.file_path ASC, c.line_number ASC, c.created_at ASC
      `).all(projectId);
    }
    res.json(rows);
  });

  router.post('/', (req: Request, res: Response): void => {
    const projectId = req.params['id'] as string;
    const access = hasAccess(projectId, req.user!.id);
    // Only teachers with share access can add comments
    if (access !== 'viewer' || !isTeacher(req.user!.id)) {
      res.status(403).json({ error: 'Forbidden', message: 'Only teachers with share access can add comments' });
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
    const db = getDb();
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO comments (id, project_id, file_path, line_number, anchor_text, text, author_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, file_path, line_number, anchor_text ?? '', text.trim(), req.user!.id, now);
    const row = db.prepare(`
      SELECT c.*, u.name as author_name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?
    `).get(id);
    res.status(201).json(row);
  });

  router.delete('/:commentId', (req: Request, res: Response): void => {
    const commentId = req.params['commentId'] as string;
    const db = getDb();
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId) as CommentRow | undefined;
    if (!comment) {
      res.status(404).json({ error: 'Not Found', message: 'Comment not found' });
      return;
    }
    // Must be author and must have access to the project
    if (comment.author_id !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden', message: 'Only the author can delete a comment' });
      return;
    }
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
    res.status(204).send();
  });

  return router;
}

export default createProjectCommentsRouter;
