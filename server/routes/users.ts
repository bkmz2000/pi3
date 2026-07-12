import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { getClient } from '../db/index.js';
import { first } from '../db/client.js';
import { assignHandle } from '../db/handle.js';
import { authMiddleware, regenerateSession } from '../middleware/auth.js';

export function createUsersRouter(allowPasswordAuth: boolean = false) {
  const router = Router();

interface User {
  id: string;
  api_token: string;
  name: string | null;
  role: string;
  password_hash: string | null;
  handle: string | null;
  created_at: number;
  updated_at: number;
}

// POST /api/users/outsider — create outsider account + start session
//
// Per Safety & Privacy Design Principle #2, no PII is collected from
// students. The account has a *password only*; identity is the
// auto-generated handle. The endpoint no longer accepts a `name` in the
// request body — any `name` sent is silently ignored to preserve
// backwards compatibility with old clients, but the value is not stored.
router.post('/outsider', async (req: Request, res: Response): Promise<void> => {
  if (!allowPasswordAuth) {
    res.status(403).json({ error: 'Forbidden', message: 'Password authentication is not enabled' });
    return;
  }

  const { password } = req.body;

  if (!password || typeof password !== 'string' || password.length < 4) {
    res.status(400).json({ error: 'Bad Request', message: 'Password must be at least 4 characters' });
    return;
  }

  const client = getClient();
  const password_hash = await bcrypt.hash(password, 10);
  const now = Date.now();
  const user: User = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: null,
    role: 'student',
    password_hash,
    handle: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { seq, handle } = await assignHandle(client);
    await client.execute(
      `INSERT INTO users (id, api_token, name, role, password_hash, handle, handle_seq, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.api_token, null, user.role, user.password_hash, handle, seq, user.created_at, user.updated_at],
    );

    await regenerateSession(req);
    req.session.userId = user.id;

    res.status(201).json({
      id: user.id,
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

  // Accepts either `handle` (new, canonical) or `name` (legacy, for
  // grandfathered accounts that still have a stored `name`). New accounts
  // never carry a `name` — they log in by handle only.
  const { handle, name, password } = req.body;
  const loginId: string | undefined =
    typeof handle === 'string' && handle.trim().length > 0 ? handle.trim().replace(/^@+/, '') :
    typeof name === 'string' && name.trim().length > 0 ? name.trim() :
    undefined;

  if (!loginId) {
    res.status(400).json({ error: 'Bad Request', message: 'handle is required' });
    return;
  }
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'Password is required' });
    return;
  }

  const client = getClient();
  const user = first<User>(await client.execute(
    'SELECT * FROM users WHERE LOWER(handle) = LOWER(?) OR name = ? LIMIT 1',
    [loginId, loginId],
  ));

  if (!user || !user.password_hash) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid handle or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash as string);
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid handle or password' });
    return;
  }

  try {
    await regenerateSession(req);
    req.session.userId = user.id as string;
    res.json({
      id: user.id,
      handle: user.handle,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (error: unknown) {
    console.error('Session error during login:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Session error' });
  }
});

// GET /api/users/search — removed under Safety & Privacy Design Principle #3
// (no first-contact between strangers). Cross-user handle lookup is a direct
// tripwire violation. Any legitimate need for it is served by the ephemeral
// session invite flow (POST /api/sessions/start).
router.get('/search', (_req: Request, res: Response): void => {
  res.status(410).json({
    error: 'Gone',
    message: 'User search has been removed. Use a session invite link instead.',
  });
});

// POST /api/users/me/upgrade-teacher — removed under Safety & Privacy Design
// Principle #1 (no persistent roles). Self-service promotion to a durable
// teacher badge with standing visibility into other accounts is the exact
// pattern the doctrine forbids. Ephemeral sessions replace it.
router.post('/me/upgrade-teacher', authMiddleware, (_req: Request, res: Response): void => {
  res.status(410).json({
    error: 'Gone',
    message: 'Self-service teacher upgrade has been removed. Live oversight uses ephemeral sessions.',
  });
});

// GET /api/users/me
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const client = getClient();
  const result = await client.execute(
    'SELECT id, handle, role, created_at FROM users WHERE id = ?',
    [req.user!.id],
  );
  const user = first<Pick<User, 'id' | 'handle' | 'role' | 'created_at'>>(result);

  if (!user) {
    res.status(404).json({ error: 'Not Found', message: 'User not found' });
    return;
  }

  res.json(user);
});

  return router;
}

export default createUsersRouter();
