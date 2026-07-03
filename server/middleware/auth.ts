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

// CSRF header check for cookie-based state-changing requests.
// Bearer-authenticated requests and safe methods (GET/HEAD/OPTIONS) are allowed through.
// Certain paths used by browser redirects or health checks are skipped.
const CSRF_SKIP_PREFIXES = ['/api/auth/', '/api/health', '/api/config'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrfHeader(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (CSRF_SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  // Cross-site simple <form> POSTs cannot set X-Requested-With nor a JSON
  // Content-Type without a CORS preflight, so either header presence indicates
  // the request originated from same-origin JS. Combined with SameSite=lax
  // cookies, this is sufficient CSRF defense.
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    next();
    return;
  }
  const contentType = req.headers['content-type'] ?? '';
  if (contentType.startsWith('application/json')) {
    next();
    return;
  }

  res.status(403).json({ error: 'Forbidden', message: 'Missing CSRF header' });
}
