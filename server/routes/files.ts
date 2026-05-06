import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

interface File {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  is_directory: number;
  created_at: number;
  updated_at: number;
}

interface ProjectAccess {
  id: string;
  user_id: string;
  role: string | null;
}

function checkAccess(db: Database.Database, projectId: string, userId: string, requiredRole: 'owner' | 'editor' | 'viewer' | 'write'): { allowed: boolean; role: string | null } {
  const project = db.prepare(`
    SELECT p.id, p.user_id,
           CASE WHEN p.user_id = ? THEN 'owner'
                WHEN ps.role IS NOT NULL THEN ps.role
                ELSE NULL END as role
    FROM projects p
    LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
    WHERE p.id = ?
  `).get(userId, userId, projectId) as ProjectAccess | undefined;

  if (!project || !project.role) {
    return { allowed: false, role: null };
  }

  const roleHierarchy: Record<string, number> = {
    owner: 3,
    editor: 2,
    viewer: 1,
  };

  const requiredLevel = roleHierarchy[requiredRole] ?? 0;
  const userLevel = roleHierarchy[project.role] ?? 0;

  return {
    allowed: userLevel >= requiredLevel,
    role: project.role,
  };
}

export function createFilesRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const db = getDb();
    const access = checkAccess(db, projectId, req.user!.id, 'viewer');
    if (!access.allowed) {
      res.status(access.role === null ? 404 : 403).json({
        error: access.role === null ? 'Not Found' : 'Forbidden',
        message: access.role === null ? 'Project not found' : 'Access denied'
      });
      return;
    }
    const files = db.prepare(`
      SELECT id, path, is_directory, created_at, updated_at
      FROM files
      WHERE project_id = ?
      ORDER BY is_directory DESC, path ASC
    `).all(projectId);
    res.json(files);
  });

  router.post('/', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const { path, content, is_directory } = req.body;
    const db = getDb();
    const access = checkAccess(db, projectId, req.user!.id, 'editor');
    if (!access.allowed) {
      res.status(access.role === null ? 404 : 403).json({
        error: access.role === null ? 'Not Found' : 'Forbidden',
        message: access.role === null ? 'Project not found' : 'Write access required'
      });
      return;
    }
    if (!path || typeof path !== 'string' || path.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Path is required' });
      return;
    }
    const normalizedPath = '/' + path.trim().replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/');
    const existing = db.prepare('SELECT id FROM files WHERE project_id = ? AND path = ?').get(projectId, normalizedPath);
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'File already exists at this path' });
      return;
    }
    const now = Date.now();
    const file: File = {
      id: uuidv4(),
      project_id: projectId,
      path: normalizedPath,
      content: content ?? null,
      is_directory: is_directory ? 1 : 0,
      created_at: now,
      updated_at: now,
    };
    try {
      db.prepare(`
        INSERT INTO files (id, project_id, path, content, is_directory, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(file.id, file.project_id, file.path, file.content, file.is_directory, file.created_at, file.updated_at);
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
      res.status(201).json({
        id: file.id,
        path: file.path,
        is_directory: file.is_directory,
        created_at: file.created_at,
        updated_at: file.updated_at,
      });
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create file' });
    }
  });

  router.get('/:path(*)', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const pathParam = req.params.path as string | string[] | undefined;
    const db = getDb();
    const access = checkAccess(db, projectId, req.user!.id, 'viewer');
    if (!access.allowed) {
      res.status(access.role === null ? 404 : 403).json({
        error: access.role === null ? 'Not Found' : 'Forbidden',
        message: access.role === null ? 'Project not found' : 'Access denied'
      });
      return;
    }
    const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
    const normalizedPath = '/' + pathStr.replace(/^\/+|\/+$/g, '/').replace(/\/+/g, '/');
    const file = db.prepare('SELECT * FROM files WHERE project_id = ? AND path = ?').get(projectId, normalizedPath) as File | undefined;
    if (!file) {
      res.status(404).json({ error: 'Not Found', message: 'File not found' });
      return;
    }
    res.json({
      id: file.id,
      path: file.path,
      content: file.content,
      is_directory: file.is_directory,
      created_at: file.created_at,
      updated_at: file.updated_at,
    });
  });

  router.put('/:path(*)', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const pathParam = req.params.path as string | string[] | undefined;
    const { content } = req.body;
    const db = getDb();
    const access = checkAccess(db, projectId, req.user!.id, 'editor');
    if (!access.allowed) {
      res.status(access.role === null ? 404 : 403).json({
        error: access.role === null ? 'Not Found' : 'Forbidden',
        message: access.role === null ? 'Project not found' : 'Write access required'
      });
      return;
    }
    const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
    const normalizedPath = '/' + pathStr.replace(/^\/+|\/+$/g, '/').replace(/\/+/g, '/');
    const file = db.prepare('SELECT * FROM files WHERE project_id = ? AND path = ?').get(projectId, normalizedPath) as File | undefined;
    if (!file) {
      res.status(404).json({ error: 'Not Found', message: 'File not found' });
      return;
    }
    if (file.is_directory) {
      res.status(400).json({ error: 'Bad Request', message: 'Cannot update directory content' });
      return;
    }
    const now = Date.now();
    try {
      db.prepare('UPDATE files SET content = ?, updated_at = ? WHERE id = ?').run(content ?? null, now, file.id);
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
      const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(file.id);
      res.json(updated);
    } catch (error) {
      console.error('Error updating file:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update file' });
    }
  });

  router.delete('/:path(*)', (req: Request, res: Response): void => {
    const projectId = req.params.id as string;
    const pathParam = req.params.path as string | string[] | undefined;
    const db = getDb();
    const access = checkAccess(db, projectId, req.user!.id, 'editor');
    if (!access.allowed) {
      res.status(access.role === null ? 404 : 403).json({
        error: access.role === null ? 'Not Found' : 'Forbidden',
        message: access.role === null ? 'Project not found' : 'Write access required'
      });
      return;
    }
    const pathStr = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam || '');
    const normalizedPath = '/' + pathStr.replace(/^\/+|\/+$/g, '/').replace(/\/+/g, '/');
    const file = db.prepare('SELECT * FROM files WHERE project_id = ? AND path = ?').get(projectId, normalizedPath) as File | undefined;
    if (!file) {
      res.status(404).json({ error: 'Not Found', message: 'File not found' });
      return;
    }
    try {
      db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
      if (file.is_directory) {
        db.prepare('DELETE FROM files WHERE path LIKE ?').run(normalizedPath + '%');
      }
      const now = Date.now();
      db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(now, projectId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete file' });
    }
  });

  return router;
}

export function createProjectRouter(): Router {
  const projectRouter = Router({ mergeParams: true });
  const filesRouter = createFilesRouter();

  projectRouter.use('/projects/:id', filesRouter);

  return projectRouter;
}

const router = createFilesRouter();
export default router;