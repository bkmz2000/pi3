import { Router, Request, Response, raw } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getClient } from '../db/index.js';
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
  sheet?: string | null;
  current_file: string;
  created_at: number;
  updated_at: number;
}


export function createProjectsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT DISTINCT p.id, p.name, p.description, p.is_public, p.created_at, p.updated_at,
             p.thumbnail_updated_at,
             p.user_id as owner_id,
             CASE WHEN p.user_id = ? THEN 'owner'
                  WHEN ps.role IS NOT NULL THEN ps.role
                  ELSE NULL END as role
      FROM projects p
      LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
      WHERE p.user_id = ? OR ps.user_id = ?
      ORDER BY p.updated_at DESC`,
      [req.user!.id, req.user!.id, req.user!.id, req.user!.id],
    );
    res.json(result.rows);
  });

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { name, description, files, assets, tilemaps, animations, sounds, currentFile } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Project name is required' });
      return;
    }
    const client = getClient();
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
      await client.execute(
        `INSERT INTO projects (id, user_id, name, description, is_public, files, assets, tilemaps, animations, sounds, current_file, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [project.id, project.user_id, project.name, project.description, project.is_public,
         project.files, project.assets, project.tilemaps, project.animations, project.sounds,
         project.current_file, project.created_at, project.updated_at],
      );
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

  // List all projects shared with the caller, grouped by group. The role
  // check is gone (Phase 1-tail); scoping is now purely by group ownership
  // via `g.teacher_id = ?` in the JOIN below, which was always the real
  // authz — an account that doesn't own any group with matching members
  // gets an empty list, not a 403.
  router.get('/shared-with-me', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT
        p.id, p.name, p.description, p.updated_at,
        u.id as student_id, u.handle as student_handle,
        hr.id as help_request_id, hr.status as help_request_status, hr.created_at as help_request_created_at,
        g.name as group_name
      FROM project_shares ps
      JOIN projects p ON p.id = ps.project_id
      JOIN users u ON u.id = p.user_id
      JOIN group_members gm ON gm.student_id = p.user_id
      JOIN groups g ON g.id = gm.group_id AND g.teacher_id = ?
      LEFT JOIN help_requests hr ON hr.project_id = p.id AND hr.status = 'pending'
      WHERE ps.user_id = ?
      ORDER BY (hr.id IS NULL), hr.created_at ASC, p.updated_at DESC`,
      [req.user!.id, req.user!.id],
    );
    res.json(result.rows);
  });

  // Owner: get teacher share status for a project
  router.get('/:id/teacher-share', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const client = getClient();
    const access = await getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only owner can view share status' });
      return;
    }
    // SPP-1 (C): role gate removed — "teachers" here means any account the
    // owner has shared the project with. SPP-2: handle-only.
    const teachers = (await client.execute(
      `SELECT u.id, u.handle FROM project_shares ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.project_id = ?`,
      [id],
    )).rows as { id: string; handle: string | null }[];
    const helpRequest = (await client.execute(
      `SELECT id, status FROM help_requests
       WHERE project_id = ? AND student_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [id, req.user!.id],
    )).rows[0] as { id: string; status: string } | undefined;
    res.json({ shared: teachers.length > 0, teachers, help_request: helpRequest || null });
  });

  // Owner: toggle help request on a project
  router.post('/:id/help-request', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const client = getClient();
    const access = await getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only project owner can request help' });
      return;
    }
    // SPP-1 (C): role gate removed. Precondition is now purely: the project
    // is shared with a user who owns a group the caller is a member of.
    const hasTeacher = (await client.execute(
      `SELECT ps.id FROM project_shares ps
       JOIN group_members gm ON gm.student_id = ? AND gm.group_id IN (
         SELECT id FROM groups WHERE teacher_id = ps.user_id
       )
       WHERE ps.project_id = ? LIMIT 1`,
      [req.user!.id, id],
    )).rows[0];
    if (!hasTeacher) {
      res.status(400).json({ error: 'Bad Request', message: 'Project must be shared with a teacher first' });
      return;
    }
    const existing = (await client.execute(
      `SELECT id FROM help_requests
       WHERE project_id = ? AND student_id = ? AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [id, req.user!.id],
    )).rows[0] as { id: string } | undefined;
    const now = Date.now();
    if (existing) {
      await client.execute(
        'UPDATE help_requests SET status = ?, updated_at = ? WHERE id = ?',
        ['cancelled', now, existing.id],
      );
      res.json({ help_request: { id: existing.id, status: 'cancelled' } });
    } else {
      const newId = uuidv4();
      await client.execute(
        'INSERT INTO help_requests (id, project_id, student_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, id, req.user!.id, 'pending', now, now],
      );
      res.status(201).json({ help_request: { id: newId, status: 'pending' } });
    }
  });

  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const project = await getProjectWithAccess<Project>(id as string, req.user!.id);
    if (!project) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (!project.role) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }

    res.json({
      ...project,
      files: JSON.parse(project.files || '{}'),
      assets: JSON.parse(project.assets || '{}'),
      tilemaps: JSON.parse(project.tilemaps || '{}'),
      animations: JSON.parse(project.animations || '{}'),
      sounds: JSON.parse(project.sounds || '{}'),
      sheet: project.sheet ? JSON.parse(project.sheet) : undefined,
    });
  });

  router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, description, is_public } = req.body;
    const client = getClient();
    const project = await getProjectWithAccess<Project>(id as string, req.user!.id);
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
      await client.execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
      const updated = (await client.execute('SELECT * FROM projects WHERE id = ?', [id])).rows[0];
      res.json(updated);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update project' });
    }
  });

  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const access = await getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    if (access.role !== 'owner') {
      res.status(403).json({ error: 'Forbidden', message: 'Only owner can delete project' });
      return;
    }

    try {
      const client = getClient();
      await client.batch([
        { sql: 'DELETE FROM help_requests WHERE project_id = ?', args: [id] },
        { sql: 'DELETE FROM comments WHERE project_id = ?', args: [id] },
        { sql: 'DELETE FROM project_shares WHERE project_id = ?', args: [id] },
        { sql: 'DELETE FROM projects WHERE id = ?', args: [id] },
      ]);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete project' });
    }
  });

  router.put('/:id/save', async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { files, assets, tilemaps, animations, sounds, sheet, currentFile } = req.body;
    const client = getClient();

    const access = await getProjectAccess(id as string, req.user!.id);
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

    if (files !== undefined) { updates.push('files = ?'); values.push(JSON.stringify(files)); }
    if (assets !== undefined) { updates.push('assets = ?'); values.push(JSON.stringify(assets)); }
    if (tilemaps !== undefined) { updates.push('tilemaps = ?'); values.push(JSON.stringify(tilemaps)); }
    if (animations !== undefined) { updates.push('animations = ?'); values.push(JSON.stringify(animations)); }
    if (sounds !== undefined) { updates.push('sounds = ?'); values.push(JSON.stringify(sounds)); }
    if (currentFile !== undefined) { updates.push('current_file = ?'); values.push(currentFile); }
    if (sheet !== undefined) { updates.push('sheet = ?'); values.push(sheet === null ? null : JSON.stringify(sheet)); }

    values.push(id);

    try {
      await client.execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
      const updated = (await client.execute('SELECT * FROM projects WHERE id = ?', [id])).rows[0] as unknown as Project;
      res.json({
        ...updated,
        files: JSON.parse((updated.files as string) || '{}'),
        assets: JSON.parse((updated.assets as string) || '{}'),
        tilemaps: JSON.parse((updated.tilemaps as string) || '{}'),
        animations: JSON.parse((updated.animations as string) || '{}'),
        sounds: JSON.parse((updated.sounds as string) || '{}'),
        sheet: updated.sheet ? JSON.parse(updated.sheet as string) : undefined,
      });
    } catch (error) {
      console.error('Error saving project content:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to save project content' });
    }
  });

  router.get('/:id/thumbnail', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const access = await getProjectAccess(id as string, req.user!.id);
    if (!access.exists || !access.role) {
      res.status(404).end();
      return;
    }
    const client = getClient();
    const row = (await client.execute(
      'SELECT thumbnail, thumbnail_updated_at FROM projects WHERE id = ?',
      [id],
    )).rows[0] as { thumbnail: Buffer | null; thumbnail_updated_at: number | null } | undefined;
    if (!row || !row.thumbnail) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=60');
    if (row.thumbnail_updated_at) {
      res.setHeader('Last-Modified', new Date(row.thumbnail_updated_at as number).toUTCString());
    }
    res.send(row.thumbnail);
  });

  router.put(
    '/:id/thumbnail',
    raw({ type: 'image/png', limit: '1mb' }),
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;
      const access = await getProjectAccess(id as string, req.user!.id);
      if (!access.exists) {
        res.status(404).json({ error: 'Not Found', message: 'Project not found' });
        return;
      }
      if (!hasRole(access, 'editor')) {
        res.status(403).json({ error: 'Forbidden', message: 'Write access required' });
        return;
      }
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'Bad Request', message: 'Expected image/png body' });
        return;
      }
      const now = Date.now();
      await getClient().execute(
        'UPDATE projects SET thumbnail = ?, thumbnail_updated_at = ?, updated_at = ? WHERE id = ?',
        [body, now, now, id],
      );
      res.json({ thumbnail_updated_at: now });
    },
  );

  router.delete('/:id/thumbnail', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const access = await getProjectAccess(id as string, req.user!.id);
    if (!access.exists) {
      res.status(404).end();
      return;
    }
    if (!hasRole(access, 'editor')) {
      res.status(403).end();
      return;
    }
    await getClient().execute(
      'UPDATE projects SET thumbnail = NULL, thumbnail_updated_at = NULL WHERE id = ?',
      [id],
    );
    res.status(204).end();
  });

  router.use('/:id/share', createSharesRouter());
  router.use('/:id/comments', createProjectCommentsRouter());

  return router;
}

const router = createProjectsRouter();
export default router;
