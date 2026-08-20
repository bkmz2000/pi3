/**
 * Production app assembly (server/index.ts).
 *
 * server/index.ts wires the whole production app: CORS allowlist, session,
 * global CSRF gate, COOP/COEP headers (required for the SharedArrayBuffer
 * interrupt signal), static serving, SPA fallback, client-error ingestion,
 * health/config endpoints, and the final error handler. Every other server
 * suite builds its own minimal express app, so this file sat at 0% coverage —
 * the entire production wiring was untested.
 *
 * Importing the real module is side-effect-safe under NODE_ENV=test (jest's
 * default) + VERCEL=1: the session store, presence prune interval, initDb and
 * app.listen are all gated off, leaving a fully-wired app to hit with
 * supertest.
 */
process.env.VERCEL = '1';
process.env.DIST_DIR = process.env.TMPDIR || '/tmp/pi3-dist-test';

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { setTestClient } from '../db/index.js';
import { createSqliteClient } from '../db/sqlite-shim.js';

let app: import('express').Application;
let db: Database.Database;
let testToken: string;

beforeAll(async () => {
  // The production app reads the DB through getClient(); inject the in-memory
  // test DB exactly like the router-level suites do.
  db = createTestDb();
  setTestClient(createSqliteClient(db));

  // A real user so authenticated requests pass authMiddleware and fall
  // through to the catch-all 404 (the compete router 401s anonymous ones).
  const now = Date.now();
  const token = 'app-test-token-' + now;
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('app-assembly-user', token, 'App Assembly', 'student', now, now);
  testToken = token;

  // The SPA fallback serves DIST_DIR/index.html — create it so the fallback
  // and static-serving paths are real.
  fs.mkdirSync(process.env.DIST_DIR!, { recursive: true });
  fs.writeFileSync(path.join(process.env.DIST_DIR!, 'index.html'), '<!doctype html><title>pi3</title>');
  // Dynamic import so the env vars above take effect before module evaluation.
  try {
    const mod = (await import('../index.js')) as { default: import('express').Application };
    app = mod.default;
  } catch (e) {
    console.error('IMPORT FAILURE:', (e as Error)?.message ?? e);
    throw e;
  }
});

afterAll(() => {
  setTestClient(undefined);
  closeTestDb();
  fs.rmSync(process.env.DIST_DIR!, { recursive: true, force: true });
  delete process.env.DIST_DIR;
});

describe('production app assembly (server/index.ts)', () => {
  it('serves /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('number');
  });

  it('serves /api/config with allowPasswordAuth', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('allowPasswordAuth');
  });

  it('returns the SPA shell for non-API, non-asset routes', async () => {
    const res = await request(app).get('/some/client/route');
    expect(res.status).toBe(200);
    expect(res.text).toContain('pi3');
  });

  it('returns JSON 404 for unmatched API routes', async () => {
    // No router claims this path: it falls through to the final catch-all,
    // which answers JSON 404 for /api/* paths.
    const res = await request(app)
      .get('/api/no-such-route-here')
      .set('Authorization', `Bearer ${testToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not Found');
  });

  it('returns 404 for unknown asset-like paths (no SPA fallback)', async () => {
    const res = await request(app).get('/missing.asset.png');
    expect(res.status).toBe(404);
  });

  it('sets COOP/COEP headers on non-API responses (SharedArrayBuffer interrupt)', async () => {
    const res = await request(app).get('/');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');
  });

  it('allows a whitelisted CORS origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects a non-whitelisted CORS origin', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://evil.example.com');
    // cors() with a callback error funnels into the app error handler -> 500.
    expect(res.status).toBe(500);
  });

  it('rejects state-changing requests without CSRF indicators', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'x' })
      .set('Content-Type', 'application/x-www-form-urlencoded');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('ingests client-error reports (204)', async () => {
    const res = await request(app)
      .post('/api/log/client-error')
      .set('Content-Type', 'application/json')
      .send({ title: 'boom', message: 'detail', traceback: 'x'.repeat(5000) });
    expect(res.status).toBe(204);
  });

  it('returns 500 JSON from the error handler for thrown route errors', async () => {
    // Malformed JSON makes express.json() throw; the error funnels into the
    // final error middleware, which answers 500 JSON.
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{not valid json');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });
});