import { createHash, randomBytes } from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { getClient } from '../db/index.js';
import { first } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';

const TOKEN_TTL_MS = 10 * 60 * 1000;
const CANARY_PROJECT_PREFIX = 'Release canary ';

interface ScopedTokenRow {
  user_id: string;
  name: string;
  role: 'student' | 'teacher';
  project_id: string;
  expires_at: number;
}

interface ProjectRow {
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
  sheet: string | null;
  current_file: string;
  version: number;
  created_at: number;
  updated_at: number;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function requireScopedProjectToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const now = Date.now();
  const client = getClient();
  const row = first<ScopedTokenRow>(await client.execute(
    `SELECT t.user_id, u.name, u.role, t.project_id, t.expires_at
     FROM canary_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ? AND t.expires_at > ?`,
    [hashToken(token), now],
  ));
  if (!row || row.role !== 'student') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (row.project_id !== req.params.id) {
    // Do not reveal whether a different project exists.
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return;
  }

  req.user = { id: row.user_id, name: row.name, role: row.role };
  next();
}

function serializeProject(row: ProjectRow): Record<string, unknown> {
  return {
    ...row,
    files: JSON.parse(row.files || '{}'),
    assets: JSON.parse(row.assets || '{}'),
    tilemaps: JSON.parse(row.tilemaps || '{}'),
    animations: JSON.parse(row.animations || '{}'),
    sounds: JSON.parse(row.sounds || '{}'),
    sheet: row.sheet ? JSON.parse(row.sheet) : undefined,
  };
}

export function createCanaryRouter(): Router {
  const router = Router();

  // Mint a credential only for a project owned by the authenticated student.
  // The secret is returned once, retained only as a hash, and expires in 10m.
  router.post('/token', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    if (req.user!.role !== 'student') {
      res.status(403).json({ error: 'Forbidden', message: 'Students only' });
      return;
    }
    const projectId = req.body?.projectId;
    if (typeof projectId !== 'string' || projectId.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'projectId is required' });
      return;
    }

    const client = getClient();
    const project = first<{ id: string; name: string }>(await client.execute(
      'SELECT id, name FROM projects WHERE id = ? AND user_id = ?',
      [projectId, req.user!.id],
    ));
    if (!project || !project.name.startsWith(CANARY_PROJECT_PREFIX)) {
      res.status(404).json({ error: 'Not Found', message: 'Canary project not found' });
      return;
    }

    const now = Date.now();
    const expiresAt = now + TOKEN_TTL_MS;
    const token = randomBytes(32).toString('base64url');
    // Expire old credentials, revoke the prior project token, and insert the
    // replacement atomically. Separate awaits can interleave concurrent
    // requests and leave multiple live credentials for one canary project.
    await client.batch([
      { sql: 'DELETE FROM canary_tokens WHERE expires_at <= ?', args: [now] },
      { sql: 'DELETE FROM canary_tokens WHERE user_id = ? AND project_id = ?', args: [req.user!.id, projectId] },
      {
        sql: `INSERT INTO canary_tokens (token_hash, user_id, project_id, created_at, expires_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [hashToken(token), req.user!.id, projectId, now, expiresAt],
      },
    ]);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.status(201).json({ token, expiresAt });
  });

  router.get('/projects/:id', requireScopedProjectToken, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = first<ProjectRow>(await client.execute(
      `SELECT id, user_id, name, description, is_public, files, assets, tilemaps,
              animations, sounds, sheet, current_file, version, created_at, updated_at
       FROM projects WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user!.id],
    ));
    if (!row) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }
    res.json(serializeProject(row));
  });

  router.delete('/projects/:id', requireScopedProjectToken, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const exists = (await client.execute(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.id],
    )).rows[0];
    if (!exists) {
      res.status(404).json({ error: 'Not Found', message: 'Project not found' });
      return;
    }

    await client.batch([
      { sql: 'DELETE FROM live_presence WHERE project_id = ?', args: [req.params.id] },
      { sql: 'DELETE FROM help_requests WHERE project_id = ?', args: [req.params.id] },
      { sql: 'DELETE FROM comments WHERE project_id = ?', args: [req.params.id] },
      { sql: 'DELETE FROM project_shares WHERE project_id = ?', args: [req.params.id] },
      { sql: 'DELETE FROM projects WHERE id = ? AND user_id = ?', args: [req.params.id, req.user!.id] },
    ]);
    // Keep the hash until expiry so a follow-up scoped GET can verify absence.
    res.status(204).end();
  });

  return router;
}
