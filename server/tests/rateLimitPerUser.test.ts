/**
 * Per-user write rate limiter smoke test.
 * RATE_LIMIT_TEST=1 lets the limiter engage under NODE_ENV=test.
 */
process.env.RATE_LIMIT_TEST = '1';

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  rateLimitPerUser,
  __resetRateLimitPerUserStoreForTests,
} from '../middleware/rateLimitPerUser.js';

function buildApp(name: string, max: number, windowMs: number, uid: string | null) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (uid) req.user = { id: uid, name: 'x', role: 'student' };
    next();
  });
  app.post(
    '/write',
    rateLimitPerUser({ name, windowMs, max }),
    (_req, res) => { res.status(200).json({ ok: true }); },
  );
  return app;
}

beforeEach(() => {
  __resetRateLimitPerUserStoreForTests();
});

afterAll(() => {
  delete process.env.RATE_LIMIT_TEST;
});

describe('rateLimitPerUser', () => {
  it('allows up to max, then 429 with Retry-After', async () => {
    const app = buildApp('t.a', 3, 60_000, 'user-a');
    for (let i = 0; i < 3; i++) {
      const ok = await request(app).post('/write');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).post('/write');
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('rate_limited');
    expect(blocked.headers['retry-after']).toBeDefined();
  });

  it('separates buckets per user', async () => {
    const appA = buildApp('t.b', 2, 60_000, 'user-a');
    const appB = buildApp('t.b', 2, 60_000, 'user-b');
    await request(appA).post('/write');
    await request(appA).post('/write');
    const blockedA = await request(appA).post('/write');
    expect(blockedA.status).toBe(429);
    const okB = await request(appB).post('/write');
    expect(okB.status).toBe(200);
  });

  it('passes through when unauthenticated (uid missing)', async () => {
    const app = buildApp('t.c', 1, 60_000, null);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/write');
      expect(res.status).toBe(200);
    }
  });

  it('resets window after windowMs elapsed', async () => {
    const app = buildApp('t.d', 1, 50, 'user-a');
    const first = await request(app).post('/write');
    expect(first.status).toBe(200);
    const blocked = await request(app).post('/write');
    expect(blocked.status).toBe(429);
    await new Promise((r) => setTimeout(r, 120));
    const afterWindow = await request(app).post('/write');
    expect(afterWindow.status).toBe(200);
  });
});
