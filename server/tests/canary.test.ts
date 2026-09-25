import express from 'express';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createCanaryRouter } from '../routes/canary.js';
import { createUsersRouter } from '../routes/users.js';
import { createSqliteClient } from '../db/sqlite-shim.js';
import { setTestClient } from '../db/index.js';
import { closeTestDb, createTestDb } from './setup.js';

let db: Database.Database;
let app: express.Application;
type TestAgent = ReturnType<typeof request.agent>;
let student: TestAgent;
let otherStudent: TestAgent;
let teacher: TestAgent;

function insertUser(id: string, role: 'student' | 'teacher'): void {
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, `token-${id}`, `User ${id}`, role, now, now);
}

function insertProject(id: string, ownerId: string, name: string): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO projects (id, user_id, name, files, assets, tilemaps, animations,
      sounds, current_file, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', '{}', '{}', '{}', 'main.py', 1, ?, ?)`,
  ).run(id, ownerId, name, JSON.stringify({ 'main.py': 'print("before")' }), now, now);
}

beforeAll(() => {
  db = createTestDb();
  setTestClient(createSqliteClient(db));
  insertUser('canary-student', 'student');
  insertUser('other-student', 'student');
  insertUser('canary-teacher', 'teacher');
  insertProject('canary-project', 'canary-student', 'Release canary test');
  insertProject('other-canary-project', 'other-student', 'Release canary other');
  insertProject('ordinary-project', 'canary-student', 'Student project');

  app = express();
  app.use(express.json());
  app.use(session({ secret: 'canary-test-secret', resave: false, saveUninitialized: false }));
  app.post('/test/login/:id', (req, res) => {
    req.session.userId = req.params.id;
    res.status(204).end();
  });
  app.use('/api/users', createUsersRouter(false));
  app.use('/api/canary', createCanaryRouter());

  student = request.agent(app);
  otherStudent = request.agent(app);
  teacher = request.agent(app);
  return Promise.all([
    student.post('/test/login/canary-student'),
    otherStudent.post('/test/login/other-student'),
    teacher.post('/test/login/canary-teacher'),
  ]).then(() => undefined);
});

afterAll(() => {
  setTestClient(undefined);
  closeTestDb();
});

async function issueToken(agent = student, projectId = 'canary-project'): Promise<string> {
  const response = await agent.post('/api/canary/token').send({ projectId });
  expect(response.status).toBe(201);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.expiresAt).toBeGreaterThan(Date.now());
  expect(typeof response.body.token).toBe('string');
  return response.body.token as string;
}

describe('scoped canary credentials', () => {
  it('requires an authenticated student session to issue a token', async () => {
    expect((await request(app).post('/api/canary/token').send({ projectId: 'canary-project' })).status).toBe(401);
    expect((await teacher.post('/api/canary/token').send({ projectId: 'canary-project' })).status).toBe(403);
  });

  it('stores only a hash and restricts the token to one owned canary project', async () => {
    const token = await issueToken();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const stored = db.prepare('SELECT token_hash, user_id, project_id, expires_at FROM canary_tokens').get() as {
      token_hash: string; user_id: string; project_id: string; expires_at: number;
    };
    expect(stored).toMatchObject({ token_hash: tokenHash, user_id: 'canary-student', project_id: 'canary-project' });
    expect(stored.token_hash).not.toBe(token);
    expect(stored.expires_at).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000);

    const projectResponse = await request(app)
      .get('/api/canary/projects/canary-project')
      .set('Authorization', `Bearer ${token}`);
    expect(projectResponse.status).toBe(200);
    expect(projectResponse.body.files['main.py']).toBe('print("before")');

    const otherProjectResponse = await request(app)
      .get('/api/canary/projects/ordinary-project')
      .set('Authorization', `Bearer ${token}`);
    expect(otherProjectResponse.status).toBe(404);
    const broadApiResponse = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(broadApiResponse.status).toBe(401);
    expect(db.prepare('SELECT id FROM projects WHERE id = ?').get('ordinary-project')).toBeTruthy();
  });

  it('does not issue tokens for projects owned by another user or without the canary prefix', async () => {
    expect((await student.post('/api/canary/token').send({ projectId: 'other-canary-project' })).status).toBe(404);
    expect((await student.post('/api/canary/token').send({ projectId: 'ordinary-project' })).status).toBe(404);
  });

  it('atomically rotates credentials when issuance requests race', async () => {
    const tokens = await Promise.all([issueToken(), issueToken()]);
    const rows = db.prepare(
      'SELECT token_hash FROM canary_tokens WHERE user_id = ? AND project_id = ?',
    ).all('canary-student', 'canary-project') as Array<{ token_hash: string }>;
    expect(rows).toHaveLength(1);

    const validToken = tokens.find((token) => createHash('sha256').update(token).digest('hex') === rows[0].token_hash);
    const revokedToken = tokens.find((token) => token !== validToken);
    expect(validToken).toBeDefined();
    expect((await request(app).get('/api/canary/projects/canary-project')
      .set('Authorization', `Bearer ${validToken}`)).status).toBe(200);
    expect((await request(app).get('/api/canary/projects/canary-project')
      .set('Authorization', `Bearer ${revokedToken}`)).status).toBe(401);
  });

  it('rejects expired credentials and tokens without a bearer header', async () => {
    const token = await issueToken();
    db.prepare('UPDATE canary_tokens SET expires_at = ?').run(Date.now() - 1);

    expect((await request(app).get('/api/canary/projects/canary-project')).status).toBe(401);
    expect((await request(app)
      .get('/api/canary/projects/canary-project')
      .set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('deletes only the bound project and verifies it is absent', async () => {
    const token = await issueToken();
    const deleted = await request(app)
      .delete('/api/canary/projects/canary-project')
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
    expect((await request(app)
      .get('/api/canary/projects/canary-project')
      .set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect(db.prepare('SELECT id FROM projects WHERE id = ?').get('canary-project')).toBeUndefined();
    expect(db.prepare('SELECT id FROM projects WHERE id = ?').get('ordinary-project')).toBeTruthy();
  });
});
