import { Request, Response, NextFunction } from 'express';

// Per-user sliding-window rate limit for authenticated write endpoints
// (publish / share / comment / problem-authoring). Complements the IP-keyed
// limiter in rateLimit.ts, which covers anonymous auth surfaces.
//
// Storage is in-memory and per-process. Fine for single-node topology;
// horizontal scale-out would move this to shared storage (Redis / DB).

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

export function __resetRateLimitPerUserStoreForTests(): void {
  buckets.clear();
}

export function rateLimitPerUser(opts: { name: string; windowMs: number; max: number }) {
  const { name, windowMs, max } = opts;
  return function rateLimitPerUserMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_TEST !== '1') {
      next();
      return;
    }
    const uid = req.user?.id;
    if (!uid) {
      next();
      return;
    }
    const key = `${name}:${uid}`;
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now - entry.windowStart > windowMs) {
      buckets.set(key, { windowStart: now, count: 1 });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSec)));
      res.status(429).json({
        error: 'Too Many Requests',
        code: 'rate_limited',
        message: `Rate limit reached for ${name} (${max}/${Math.round(windowMs / 60000)}min). Try again in ${retryAfterSec}s.`,
      });
      return;
    }
    next();
  };
}
