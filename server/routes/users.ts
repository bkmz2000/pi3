import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { assignHandle } from '../db/handle.js';
import { authMiddleware, regenerateSession } from '../middleware/auth.js';

export function createUsersRouter(allowPasswordAuth: boolean = false) {
  const router = Router();

interface User {
  id: string;
  api_token: string;
  name: string;
  role: string;
  password_hash: string | null;
  handle: string | null;
  created_at: number;
  updated_at: number;
}

// POST /api/users/outsider — create outsider account + start session
router.post('/outsider', async (req: Request, res: Response): Promise<void> => {
  if (!allowPasswordAuth) {
    res.status(403).json({ error: 'Forbidden', message: 'Password authentication is not enabled' });
    return;
  }

  const { name, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Bad Request', message: 'Name is required' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 4) {
    res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 4 characters' });
    return;
  }

  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name.trim());
  if (existing) {
    res.status(409).json({ error: 'Conflict', message: 'Username already taken' });
    return;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const now = Date.now();
  const user: User = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: name.trim(),
    role: 'student',
    password_hash,
    handle: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { seq, handle } = assignHandle(db);
    db.prepare(`
      INSERT INTO users (id, api_token, name, role, password_hash, handle, handle_seq, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, user.api_token, user.name, user.role, user.password_hash, handle, seq, user.created_at, user.updated_at);

    await regenerateSession(req);
    req.session.userId = user.id;

    res.status(201).json({
      id: user.id,
      name: user.name,
      handle,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create user' });
  }
});

// POST /api/users/outsider/login — sign in with username/password + start session
router.post('/outsider/login', async (req: Request, res: Response): Promise<void> => {
  if (!allowPasswordAuth) {
    res.status(403).json({ error: 'Forbidden', message: 'Password authentication is not enabled' });
    return;
  }

  const { name, password } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Name is required' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Password is required' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name.trim()) as User | undefined;

  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid username or password' });
    return;
  }

  try {
    await regenerateSession(req);
    req.session.userId = user.id;
    res.json({
      id: user.id,
      name: user.name,
      handle: user.handle,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (error: unknown) {
    console.error('Session error during login:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Session error' });
  }
});

// GET /api/users/me
router.get('/me', authMiddleware, (req: Request, res: Response): void => {
  const db = getDb();
  const user = db
    .prepare('SELECT id, name, handle, role, created_at FROM users WHERE id = ?')
    .get(req.user!.id) as Pick<User, 'id' | 'name' | 'handle' | 'role' | 'created_at'> | undefined;

  if (!user) {
    res.status(404).json({ error: 'Not Found', message: 'User not found' });
    return;
  }

  res.json(user);
});

  return router;
}

export default createUsersRouter();
