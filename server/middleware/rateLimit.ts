import { Request, Response, NextFunction } from 'express';

// SPP-8 supplementary control: per-user sliding-window rate limit for
// publish / share / comment / problem-authoring writes. Sizing is
// intentionally blunt — the goal is to raise the abuse cost, not to shape
// legitimate traffic. Tune per endpoint via the factory arguments.
//
// Storage is in-memory and per-process. Good enough for the single-node
// launch topology; a horizontal scale-out would move this into shared
// storage (Redis / DB) later.

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

export function __resetRateLimitStoreForTests(): void {
  buckets.clear();
}

export function rateLimit(opts: { name: string; windowMs: number; max: number }) {
  const { name, windowMs, max } = opts;
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_TEST !== 'on') {
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
