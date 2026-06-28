import { Request, Response, NextFunction } from 'express';
import { getClient } from '../db/index.js';
import { first } from '../db/client.js';

export interface AuthUser {
  id: string;
  name: string;
  role: 'student' | 'teacher';
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) { reject(err); return; }
      resolve();
    });
  });
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    idToken?: string;
  }
}

async function resolveUser(req: Request): Promise<AuthUser | undefined> {
  const client = getClient();

  if (req.session?.userId) {
    const result = await client.execute(
      'SELECT id, name, role FROM users WHERE id = ?',
      [req.session.userId],
    );
    const user = first<AuthUser>(result);
    if (user) return user;
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (token) {
      const result = await client.execute(
        'SELECT id, name, role FROM users WHERE api_token = ?',
        [token],
      );
      const user = first<AuthUser>(result);
      if (user) return user;
    }
  }

  return undefined;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.SKIP_AUTH === 'true') {
    req.user = { id: 'test-user', name: 'Test User', role: 'student' };
    next();
    return;
  }

  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = user;
  next();
}
