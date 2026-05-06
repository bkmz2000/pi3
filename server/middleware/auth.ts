import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';

export interface AuthUser {
  id: string;
  name: string;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing token' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, name FROM users WHERE api_token = ?')
    .get(token) as AuthUser | undefined;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    return;
  }

  req.user = user;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  if (token) {
    const db = getDb();
    const user = db
      .prepare('SELECT id, name FROM users WHERE api_token = ?')
      .get(token) as AuthUser | undefined;

    if (user) {
      req.user = user;
    }
  }

  next();
}
