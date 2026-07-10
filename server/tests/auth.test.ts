import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';

import { createUsersRouter } from '../routes/users.js';
import authRouter from '../routes/auth.js';

let app: express.Application;
let db: Database.Database;

beforeAll(() => {
  app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
  }));
  app.use('/api/users', createUsersRouter(true));
  app.use('/api/auth', authRouter);
});

afterEach(() => {
  if (db) db.close();
  closeTestDb();
});

afterAll(() => {
  closeTestDb();
});

function makeUser() {
  db = createTestDb();
  const id = uuidv4();
  const api_token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const now = Date.now();
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, api_token, 'TestUser', 'student', now, now);
  return { id, api_token };
}

// 8.1 — login sets a session cookie
describe('session cookie on login', () => {
  it('POST /api/users/outsider/login returns Set-Cookie header', async () => {
    db = createTestDb();

    // Create the user first
    await request(app)
      .post('/api/users/outsider')
      .send({ name: 'SessionTest', password: 'pass1234' });

    const res = await request(app)
      .post('/api/users/outsider/login')
      .send({ name: 'SessionTest', password: 'pass1234' });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'];
    expect(cookie).toBeDefined();
    const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : String(cookie);
    expect(cookieStr).toMatch(/connect\.sid/);
  });
});

// 8.2 — session ID changes after login (session fixation protection)
describe('session regeneration on login', () => {
  it('connect.sid changes value after logging in', async () => {
    db = createTestDb();

    // Create account
    await request(app)
      .post('/api/users/outsider')
      .send({ name: 'RegenTest', password: 'pass1234' });

    // Establish a pre-login session via the signup endpoint
    const signupRes = await request(app)
      .post('/api/users/outsider')
      .send({ name: 'RegenTest2', password: 'pass1234' });
    const preSid = (signupRes.headers['set-cookie'] as string[] | string | undefined);
    const preSidStr = Array.isArray(preSid) ? preSid[0] : String(preSid ?? '');
    const preMatch = preSidStr.match(/connect\.sid=([^;]+)/);
    expect(preMatch).not.toBeNull();
    const preSidValue = preMatch![1];

    // Now login (should regenerate session)
    const loginRes = await request(app)
      .post('/api/users/outsider/login')
      .set('Cookie', `connect.sid=${preSidValue}`)
      .send({ name: 'RegenTest', password: 'pass1234' });

    expect(loginRes.status).toBe(200);
    const postSid = loginRes.headers['set-cookie'] as string[] | string | undefined;
    const postSidStr = Array.isArray(postSid) ? postSid[0] : String(postSid ?? '');
    const postMatch = postSidStr.match(/connect\.sid=([^;]+)/);
    expect(postMatch).not.toBeNull();
    const postSidValue = postMatch![1];

    expect(postSidValue).not.toBe(preSidValue);
  });
});

// 8.3 — open redirect protection
describe('open redirect protection on /api/auth/login', () => {
  it('does not store unsafe return_url (external URL) in oauth_return cookie', async () => {
    db = createTestDb();

    const res = await request(app)
      .get('/api/auth/login?return_url=https://evil.com')
      .redirects(0);

    // Route redirects to OAuth provider — not evil.com
    expect(res.status).toBe(302);
    expect(res.headers['location']).not.toMatch(/evil\.com/);

    // oauth_return cookie should NOT be set for the unsafe URL
    const cookies = res.headers['set-cookie'] as string[] | string | undefined;
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '');
    expect(cookieStr).not.toMatch(/oauth_return/);
  });

  it('stores safe return_url (/projects) in oauth_return cookie', async () => {
    db = createTestDb();

    const res = await request(app)
      .get('/api/auth/login?return_url=/projects')
      .redirects(0);

    expect(res.status).toBe(302);
    const cookies = res.headers['set-cookie'] as string[] | string | undefined;
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : String(cookies ?? '');
    expect(cookieStr).toMatch(/oauth_return/);
  });
});

// 8.4 — api_token is invalidated (rotated) after logout
describe('Bearer token invalidation on logout', () => {
  it('Bearer token is rejected after logout', async () => {
    const { api_token } = makeUser();

    // Confirm the token works before logout
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${api_token}`);
    expect(meRes.status).toBe(200);

    // Logout using Bearer token auth
    await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${api_token}`);

    // Old token should now be rejected
    const meResAfter = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${api_token}`);
    expect(meResAfter.status).toBe(401);
  });
});

// 8.5 — Logout requires authenticated session (CSRF defense)
describe('Session-gated logout (CSRF defense)', () => {
  it('logout without session is rejected (401)', async () => {
    db = createTestDb(); // authMiddleware needs a DB client even to check for no-session
    // Request logout without any authentication
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(401);
  });

  it('logout with Bearer token rotates token even without session', async () => {
    const { api_token, id } = makeUser();

    // Get old token from database
    const oldTokenRes = db.prepare('SELECT api_token FROM users WHERE id = ?').get(id) as { api_token: string };
    const oldToken = oldTokenRes.api_token;

    // Logout using Bearer token
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${api_token}`);

    expect(logoutRes.status).toBe(200);

    // Token should be rotated in database
    const newTokenRes = db.prepare('SELECT api_token FROM users WHERE id = ?').get(id) as { api_token: string };
    expect(newTokenRes.api_token).not.toBe(oldToken);

    // Old token should be rejected
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${api_token}`);
    expect(meRes.status).toBe(401);
  });
});

describe('POST /api/users/me/upgrade-teacher', () => {
  it('upgrades a student to teacher role', async () => {
    const { id, api_token } = makeUser();
    const res = await request(app)
      .post('/api/users/me/upgrade-teacher')
      .set('Authorization', `Bearer ${api_token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('teacher');
    const row = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string };
    expect(row.role).toBe('teacher');
  });

  it('is idempotent on an already-teacher account', async () => {
    const { api_token } = makeUser();
    await request(app).post('/api/users/me/upgrade-teacher').set('Authorization', `Bearer ${api_token}`);
    const res = await request(app)
      .post('/api/users/me/upgrade-teacher')
      .set('Authorization', `Bearer ${api_token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('teacher');
  });

  it('requires auth', async () => {
    db = createTestDb();
    const res = await request(app).post('/api/users/me/upgrade-teacher');
    expect(res.status).toBe(401);
  });
});
