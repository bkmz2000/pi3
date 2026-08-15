import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

// Per-user fixed-window rate limit for authenticated write endpoints
// (publish / share / comment / problem-authoring). Complements the IP-keyed
// limiter in rateLimit.ts, which covers anonymous auth surfaces.
//
// Built on express-rate-limit (already a dependency, already used by
// rateLimit.ts) via a per-user keyGenerator, rather than a bespoke bucket
// store — same in-memory-per-process characteristics (MemoryStore), one
// fewer rate-limiting implementation to maintain. Horizontal scale-out would
// move to a shared `store` (Redis / DB) here same as it would for rateLimit.ts.

// No-op kept so existing test setup doesn't need touching: each named
// limiter now owns its own isolated express-rate-limit store rather than a
// shared module-level Map, so there's nothing left to reset between tests.
export function __resetRateLimitPerUserStoreForTests(): void {}

export function rateLimitPerUser(opts: { name: string; windowMs: number; max: number }) {
  const { name, windowMs, max } = opts;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req: Request) =>
      (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_TEST !== '1') || !req.user?.id,
    keyGenerator: (req: Request) => req.user!.id,
    handler: (req, res) => {
      // express-rate-limit doesn't ship a global Request augmentation for
      // this property, so read it via a narrow local cast.
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const retryAfterSec = Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now()) - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too Many Requests',
        code: 'rate_limited',
        message: `Rate limit reached for ${name} (${max}/${Math.round(windowMs / 60000)}min). Try again in ${retryAfterSec}s.`,
      });
    },
  });
}
