import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { rateLimit, __resetRateLimitStoreForTests } from '../middleware/rateLimit.js';
import '../middleware/auth.js';

// SPP-8 rate limiter is disabled by default under NODE_ENV=test so the rest
// of the suite doesn't have to reason about buckets. This test flips the
// `RATE_LIMIT_TEST=on` escape hatch to exercise the middleware directly.

describe('rateLimit middleware', () => {
  let app: express.Application;

  beforeAll(() => {
    process.env.RATE_LIMIT_TEST = 'on';
    app = express();
    // Fake auth: read x-uid header.
    app.use((req, _res, next) => {
      const uid = req.header('x-uid');
      if (uid) (req as express.Request & { user?: { id: string; name: string; role: 'student' | 'teacher' } }).user = { id: uid, name: 't', role: 'student' };
      next();
    });
    app.post('/write', rateLimit({ name: 'test', windowMs: 60_000, max: 3 }), (_req, res) => {
      res.status(201).json({ ok: true });
    });
  });

  afterAll(() => {
    delete process.env.RATE_LIMIT_TEST;
  });

  beforeEach(() => {
    __resetRateLimitStoreForTests();
  });

  it('allows up to `max` requests within the window', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/write').set('x-uid', 'u1');
      expect(res.status).toBe(201);
    }
  });

  it('rejects the `max+1`th request with 429 + Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/write').set('x-uid', 'u2');
    }
    const res = await request(app).post('/write').set('x-uid', 'u2');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('rate_limited');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('buckets are keyed per user', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/write').set('x-uid', 'a');
    }
    const res = await request(app).post('/write').set('x-uid', 'b');
    expect(res.status).toBe(201);
  });

  it('is a no-op for unauthenticated callers', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/write');
      expect(res.status).toBe(201);
    }
  });
});
