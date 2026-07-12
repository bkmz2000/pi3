import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createUsersRouter } from '../routes/users.js';
import { loginusAdapter } from '../auth-providers/loginus.js';
import { keycloakAdapter } from '../auth-providers/keycloak.js';

// Regression tests for the two review blockers flagged after the initial
// launch-readiness plan landed:
//   #1 users.name PII was still required and still surfaced to teachers
//   #2 the persistent 'teacher' role was still the live authorization model

let app: express.Application;
let db: Database.Database;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/api/users', createUsersRouter(true));
});

beforeEach(() => {
  db = createTestDb();
});

afterEach(() => {
  closeTestDb();
});

describe('Blocker #1 — student PII structural absence', () => {
  it('users.name is nullable (schema allows NULL for new student rows)', () => {
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 'tok', null, 'student', Date.now(), Date.now());
    const row = db.prepare('SELECT name FROM users WHERE id = ?').get(id) as { name: string | null };
    expect(row.name).toBeNull();
  });

  it('POST /api/users/outsider ignores any `name` in the request body', async () => {
    const res = await request(app).post('/api/users/outsider').send({
      name: 'Alice Realname',
      password: 'hunter2',
    });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('name');
    expect(typeof res.body.handle).toBe('string');
    // And the stored row has NULL name.
    const row = db.prepare('SELECT name, handle FROM users WHERE id = ?').get(res.body.id) as { name: string | null; handle: string };
    expect(row.name).toBeNull();
    expect(row.handle).toBe(res.body.handle);
  });

  it('POST /api/users/outsider requires only a password (no name field)', async () => {
    const res = await request(app).post('/api/users/outsider').send({ password: 'hunter2' });
    expect(res.status).toBe(201);
    expect(typeof res.body.handle).toBe('string');
  });

  it('POST /api/users/outsider/login accepts `handle` (no longer requires `name`)', async () => {
    const reg = await request(app).post('/api/users/outsider').send({ password: 'hunter2' });
    const handle = reg.body.handle as string;
    const login = await request(app).post('/api/users/outsider/login').send({ handle, password: 'hunter2' });
    expect(login.status).toBe(200);
    expect(login.body.handle).toBe(handle);
    expect(login.body).not.toHaveProperty('name');
  });

  it('GET /api/users/me returns handle only, never name', async () => {
    const reg = await request(app).post('/api/users/outsider').send({ password: 'hunter2' });
    const me = await request(app).get('/api/users/me').set(auth(reg.body.id === undefined ? '' : ''));
    // /me needs a Bearer; use the api_token from the DB row directly.
    const row = db.prepare('SELECT api_token FROM users WHERE id = ?').get(reg.body.id) as { api_token: string };
    const authed = await request(app).get('/api/users/me').set(auth(row.api_token));
    expect(authed.status).toBe(200);
    expect(authed.body).not.toHaveProperty('name');
    expect(typeof authed.body.handle).toBe('string');
    void me; // shape check above; keeping var to document the negative case
  });
});

describe('Blocker #2 — persistent teacher role cannot be granted', () => {
  it('POST /api/users/me/upgrade-teacher returns 410 Gone', async () => {
    const reg = await request(app).post('/api/users/outsider').send({ password: 'hunter2' });
    const row = db.prepare('SELECT api_token, role FROM users WHERE id = ?').get(reg.body.id) as { api_token: string; role: string };
    const res = await request(app).post('/api/users/me/upgrade-teacher').set(auth(row.api_token));
    expect(res.status).toBe(410);
    // And the DB row is untouched — still 'student'.
    const after = db.prepare('SELECT role FROM users WHERE id = ?').get(reg.body.id) as { role: string };
    expect(after.role).toBe('student');
  });

  it('GET /api/users/search returns 410 Gone (cross-user discovery removed)', async () => {
    const reg = await request(app).post('/api/users/outsider').send({ password: 'hunter2' });
    const row = db.prepare('SELECT api_token FROM users WHERE id = ?').get(reg.body.id) as { api_token: string };
    const res = await request(app).get('/api/users/search?q=whatever').set(auth(row.api_token));
    expect(res.status).toBe(410);
  });

  it('loginus adapter maps every account to role=student, ignoring provider teacher claim', () => {
    const originalEnv = process.env.LOGINUS_TEACHER_ROLE;
    process.env.LOGINUS_TEACHER_ROLE = 'teacher';
    try {
      const parsed = loginusAdapter.parseUserinfo({
        id: 'prov-123',
        preferred_username: 'user-1',
        globalRoles: [{ name: 'teacher' }],
        firstName: 'X',
        lastName: 'Y',
      });
      expect(parsed.role).toBe('student');
    } finally {
      process.env.LOGINUS_TEACHER_ROLE = originalEnv;
    }
  });

  it('keycloak adapter maps every account to role=student, ignoring realm roles', () => {
    const parsed = keycloakAdapter.parseUserinfo({
      sub: 'k-sub-1',
      preferred_username: 'k-user',
      realm_access: { roles: ['teacher', 'admin', 'anything'] },
    });
    expect(parsed.role).toBe('student');
  });
});
