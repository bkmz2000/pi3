import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';

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

function resolveUser(req: Request): AuthUser | undefined {
  const db = getDb();

  if (req.session?.userId) {
    const user = db
      .prepare('SELECT id, name, role FROM users WHERE id = ?')
      .get(req.session.userId) as AuthUser | undefined;
    if (user) return user;
  }

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    if (token) {
      const user = db
        .prepare('SELECT id, name, role FROM users WHERE api_token = ?')
        .get(token) as AuthUser | undefined;
      if (user) return user;
    }
  }

  return undefined;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Allow bypassing auth in test environments (E2E tests)
  if (process.env.SKIP_AUTH === 'true') {
    req.user = { id: 'test-user', name: 'Test User', role: 'student' };
    next();
    return;
  }

  const user = resolveUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.user = user;
  next();
}
