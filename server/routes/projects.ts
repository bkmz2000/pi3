import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getProjectAccess, getProjectWithAccess, hasRole } from '../middleware/projectAuth.js';
import { createSharesRouter } from './shares.js';
import { createProjectCommentsRouter } from './comments.js';

interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: number;
  files: string;
  assets: string;
  tilemaps: string;
  animations: string;
  sounds: string;
  current_file: string;
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
      WHERE p.user_id = ? OR ps.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(req.user!.id, req.user!.id, req.user!.id, req.user!.id);
    res.json(projects);
  });

  router.post('/', (req: Request, res: Response): void => {
    const { name, description, files, assets, tilemaps, animations, sounds, currentFile } = req.body;
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
      files: JSON.stringify(files || {}),
      assets: JSON.stringify(assets || {}),
      tilemaps: JSON.stringify(tilemaps || {}),
      animations: JSON.stringify(animations || {}),
      sounds: JSON.stringify(sounds || {}),
      current_file: currentFile || 'main.py',
      created_at: now,
      updated_at: now,
    };
    try {
      db.prepare(`
        INSERT INTO projects (id, user_id, name, description, is_public, files, assets, tilemaps, animations, sounds, current_file, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(project.id, project.user_id, project.name, project.description, project.is_public, project.files, project.assets, project.tilemaps, project.animations, project.sounds, project.current_file, project.created_at, project.updated_at);
      res.status(201).json({
        ...project,
        files: JSON.parse(project.files || '{}'),
        assets: JSON.parse(project.assets || '{}'),
        tilemaps: JSON.parse(project.tilemaps || '{}'),
        animations: JSON.parse(project.animations || '{}'),
        sounds: JSON.parse(project.sounds || '{}'),
      });
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create project' });
    }
  });

  // Teacher: list all projects shared with me, grouped by student group
  router.get('/shared-with-me', (req: Request, res: Response): void => {
    if (req.user!.role !== 'teacher') {
      res.status(403).json({ error: 'Forbidden', message: 'Teachers only' });
      return;
    }
    const db = getDb();
    const projects = db.prepare(`
      SELECT
        p.id, p.name, p.description, p.updated_at,
        u.id as student_id, u.name as student_name,
        hr.id as help_request_id, hr.status as help_request_status, hr.created_at as help_request_created_at,
        g.name as group_name
      FROM project_shares ps
      JOIN projects p ON p.id = ps.project_id
      JOIN users u ON u.id = p.user_id
      JOIN group_members gm ON gm.student_id = p.user_id
      JOIN groups g ON g.id = gm.group_id AND g.teacher_id = ?
      LEFT JOIN help_requests hr ON hr.project_id = p.id AND hr.status = 'pending'
      WHERE ps.user_id = ?
      ORDER BY (hr.id IS NULL), hr.created_at ASC, p.updated_at DESC
    `).all(req.user!.id, req.user!.id);
    res.json(projects);
  });

  // Owner: get teacher share status for a project
  router.get('/:id/teacher-share', (req: Request, res: Response): void => {
    const { id } = req.params;
    const db = getDb();
    const access = getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only owner can view share status' });
      return;
    }
    const teachers = db.prepare(`
      SELECT u.id, u.name FROM project_shares ps
      JOIN users u ON u.id = ps.user_id
      WHERE ps.project_id = ? AND u.role = 'teacher'
    `).all(id) as { id: string; name: string }[];
    const helpRequest = db.prepare(`
      SELECT id, status FROM help_requests
      WHERE project_id = ? AND student_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `).get(id, req.user!.id) as { id: string; status: string } | undefined;
    res.json({ shared: teachers.length > 0, teachers, help_request: helpRequest || null });
  });

  // Owner: toggle help request on a project
  router.post('/:id/help-request', (req: Request, res: Response): void => {
    const { id } = req.params;
    const db = getDb();
    const access = getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only project owner can request help' });
      return;
    }
    const hasTeacher = db.prepare(`
      SELECT ps.id FROM project_shares ps
      JOIN users u ON u.id = ps.user_id
      JOIN group_members gm ON gm.student_id = ? AND gm.group_id IN (
        SELECT id FROM groups WHERE teacher_id = ps.user_id
      )
      WHERE ps.project_id = ? AND u.role = 'teacher' LIMIT 1
    `).get(req.user!.id, id);
    if (!hasTeacher) {
      res.status(400).json({ error: 'Bad Request', message: 'Project must be shared with a teacher first' });
      return;
    }
    const existing = db.prepare(`
      SELECT id FROM help_requests
      WHERE project_id = ? AND student_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `).get(id, req.user!.id) as { id: string } | undefined;
    const now = Date.now();
    if (existing) {
      db.prepare('UPDATE help_requests SET status = ?, updated_at = ? WHERE id = ?').run('cancelled', now, existing.id);
      res.json({ help_request: { id: existing.id, status: 'cancelled' } });
    } else {
      const newId = uuidv4();
      db.prepare('INSERT INTO help_requests (id, project_id, student_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newId, id, req.user!.id, 'pending', now, now);
      res.status(201).json({ help_request: { id: newId, status: 'pending' } });
    }
  });

  router.get('/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const project = getProjectWithAccess<Project>(id as string, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (!project.role) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }

    // Parse JSON columns for response
    res.json({
      ...project,
      files: JSON.parse(project.files || '{}'),
      assets: JSON.parse(project.assets || '{}'),
      tilemaps: JSON.parse(project.tilemaps || '{}'),
      animations: JSON.parse(project.animations || '{}'),
      sounds: JSON.parse(project.sounds || '{}'),
    });
  });

  router.put('/:id', (req: Request, res: Response): void => {
    const { id } = req.params;
    const { name, description, is_public } = req.body;
    const db = getDb();
    const project = getProjectWithAccess<Project>(id as string, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (!hasRole(project, 'editor')) {
      res.status(403).json({ error: 'Forbidden', message: 'Write access required' });
      return;
    }

    const now = Date.now();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'Project name must be a non-empty string' });
        return;
      }
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
    const access = getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only owner can delete project' });
      return;
    }

    try {
      db.transaction(() => {
        db.prepare('DELETE FROM help_requests WHERE project_id = ?').run(id);
        db.prepare('DELETE FROM comments WHERE project_id = ?').run(id);
        db.prepare('DELETE FROM project_shares WHERE project_id = ?').run(id);
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      })();
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete project' });
    }
  });

  router.put('/:id/save', (req: Request, res: Response): void => {
    const id = req.params.id as string;
    const { files, assets, tilemaps, animations, sounds, currentFile } = req.body;
    const db = getDb();

    const access = getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (!hasRole(access, 'editor')) {
      res.status(403).json({ error: 'Forbidden', message: 'Write access required' });
      return;
    }

    const now = Date.now();
    const updates: string[] = ['updated_at = ?'];
    const values: unknown[] = [now];

    if (files !== undefined) {
      updates.push('files = ?');
      values.push(JSON.stringify(files));
    }
    if (assets !== undefined) {
      updates.push('assets = ?');
      values.push(JSON.stringify(assets));
    }
    if (tilemaps !== undefined) {
      updates.push('tilemaps = ?');
      values.push(JSON.stringify(tilemaps));
    }
    if (animations !== undefined) {
      updates.push('animations = ?');
      values.push(JSON.stringify(animations));
    }
    if (sounds !== undefined) {
      updates.push('sounds = ?');
      values.push(JSON.stringify(sounds));
    }
    if (currentFile !== undefined) {
      updates.push('current_file = ?');
      values.push(currentFile);
    }

    values.push(id);

    try {
      db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;
      res.json({
        ...updated,
        files: JSON.parse(updated.files || '{}'),
        assets: JSON.parse(updated.assets || '{}'),
        tilemaps: JSON.parse(updated.tilemaps || '{}'),
        animations: JSON.parse(updated.animations || '{}'),
        sounds: JSON.parse(updated.sounds || '{}'),
      });
    } catch (error) {
      console.error('Error saving project content:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save project content' });
    }
  });

  router.use('/:id/share', createSharesRouter());
  router.use('/:id/comments', createProjectCommentsRouter());

  return router;
}

const router = createProjectsRouter();
export default router;
