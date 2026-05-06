import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { createFilesRouter } from './files.js';
import { createSharesRouter } from './shares.js';

interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: number;
  created_at: number;
  updated_at: number;
}

export function createProjectsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response): void => {
    const db = getDb();
    const projects = db.prepare(`
      SELECT DISTINCT p.id, p.name, p.description, p.is_public, p.created_at, p.updated_at,
             p.user_id as owner_id,
             CASE WHEN p.user_id = ? THEN 'owner'
                  WHEN ps.role IS NOT NULL THEN ps.role
                  ELSE NULL END as role
      FROM projects p
      LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
      WHERE p.user_id = ? OR (ps.user_id = ? AND p.is_public = 1)
      ORDER BY p.updated_at DESC
    `).all(req.user!.id, req.user!.id, req.user!.id, req.user!.id);
    res.json(projects);
  });

  router.post('/', (req: Request, res: Response): void => {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Project name is required' });
      return;
    }
    const db = getDb();
    const now = Date.now();
    const project: Project = {
      id: uuidv4(),
      user_id: req.user!.id,
      name: name.trim(),
      description: description?.trim() || null,
      is_public: 0,
      created_at: now,
      updated_at: now,
    };
    try {
      db.prepare(`
        INSERT INTO projects (id, user_id, name, description, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(project.id, project.user_id, project.name, project.description, project.is_public, project.created_at, project.updated_at);
      res.status(201).json(project);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create project' });
    }
  });

  router.get('/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*,
             CASE WHEN p.user_id = ? THEN 'owner'
                  WHEN ps.role IS NOT NULL THEN ps.role
                  ELSE NULL END as role
      FROM projects p
      LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
      WHERE p.id = ?
    `).get(req.user!.id, req.user!.id, id) as (Project & { role: string | null }) | undefined;
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (!project.role) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }
    res.json(project);
  });

  router.put('/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const { name, description, is_public } = req.body;
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*,
             CASE WHEN p.user_id = ? THEN 'owner'
                  WHEN ps.role IS NOT NULL THEN ps.role
                  ELSE NULL END as role
      FROM projects p
      LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
      WHERE p.id = ?
    `).get(req.user!.id, req.user!.id, id) as (Project & { role: string | null }) | undefined;
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (project.role !== 'owner' && project.role !== 'editor') {
      res.status(403).json({ error: 'Forbidden', message: 'Write access required' });
      return;
    }
    const now = Date.now();
    const updates: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description?.trim() || null);
    }
    if (is_public !== undefined && project.role === 'owner') {
      updates.push('is_public = ?');
      values.push(is_public ? 1 : 0);
    }
    if (updates.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
      return;
    }
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);
    try {
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      res.json(updated);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update project' });
    }
  });

  router.delete('/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*, CASE WHEN p.user_id = ? THEN 'owner' ELSE NULL END as role
      FROM projects p
      WHERE p.id = ?
    `).get(req.user!.id, id) as (Project & { role: string | null }) | undefined;
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (project.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only owner can delete project' });
      return;
    }
    try {
      db.prepare('DELETE FROM project_shares WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM files WHERE project_id = ?').run(id);
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete project' });
    }
  });

  router.use('/:id/files', createFilesRouter());
  router.use('/:id/share', createSharesRouter());

  return router;
}

const router = createProjectsRouter();
export default router;