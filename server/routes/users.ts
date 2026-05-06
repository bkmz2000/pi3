import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

interface User {
  id: string;
  api_token: string;
  name: string;
  created_at: number;
  updated_at: number;
}

router.post('/', (req: Request, res: Response): void => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Bad Request', message: 'Name is required' });
    return;
  }

  const db = getDb();
  const now = Date.now();

  const user: User = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: name.trim(),
    created_at: now,
    updated_at: now,
  };

  try {
    db.prepare(`
      INSERT INTO users (id, api_token, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.api_token, user.name, user.created_at, user.updated_at);

    res.status(201).json({
      id: user.id,
      name: user.name,
      api_token: user.api_token,
      created_at: user.created_at,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Conflict', message: 'User already exists' });
    } else {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create user' });
    }
  }
});

router.get('/me', authMiddleware, (req: Request, res: Response): void => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?').get(req.user!.id) as Omit<User, 'api_token' | 'updated_at'> | undefined;

  if (!user) {
    res.status(404).json({ error: 'Not Found', message: 'User not found' });
    return;
  }

  res.json(user);
});

export default router;
