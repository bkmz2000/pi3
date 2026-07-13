import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';

import { createUsersRouter } from '../routes/users.js';
import projectsRouter from '../routes/projects.js';

let app: express.Application;
let db: Database.Database;
let testUser1: { id: string; api_token: string; name: string; role: string };
let testUser2: { id: string; api_token: string; name: string; role: string };
let testProject: { id: string; user_id: string; name: string };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use('/api/users', createUsersRouter(true));
  app.use('/api/projects', projectsRouter);
});

beforeEach(() => {
  db = createTestDb();

  testUser1 = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: 'Alice',
    role: 'student',
  };

  testUser2 = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: 'Bob',
    role: 'student',
  };

  const now = Date.now();
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(testUser1.id, testUser1.api_token, testUser1.name, testUser1.role, now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(testUser2.id, testUser2.api_token, testUser2.name, testUser2.role, now, now);

  testProject = {
    id: uuidv4(),
    user_id: testUser1.id,
    name: 'Test Project',
  };

  db.prepare('INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(testProject.id, testProject.user_id, testProject.name, 0, '{"main.py":"print(1)"}', '{}', 'main.py', now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('Users API', () => {
  it('POST /api/users/outsider creates a new user (handle-only, no name collected)', async () => {
    const res = await request(app)
      .post('/api/users/outsider')
      .send({ name: 'Charlie', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).not.toHaveProperty('name');
    expect(typeof res.body.handle).toBe('string');
    expect(res.body).not.toHaveProperty('api_token');
  });

  it('POST /api/users/outsider ignores empty `name` (no longer required)', async () => {
    const res = await request(app)
      .post('/api/users/outsider')
      .send({ name: '', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('name');
  });

  it('POST /api/users/outsider rejects missing password', async () => {
    const res = await request(app)
      .post('/api/users/outsider')
      .send({ name: 'Dave' });

    expect(res.status).toBe(400);
  });

  it('POST /api/users/outsider/login succeeds via handle', async () => {
    const reg = await request(app).post('/api/users/outsider').send({ password: 'pass1234' });
    const res = await request(app)
      .post('/api/users/outsider/login')
      .send({ handle: reg.body.handle, password: 'pass1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).not.toHaveProperty('name');
  });

  it('POST /api/users/outsider/login rejects wrong password', async () => {
    const reg = await request(app).post('/api/users/outsider').send({ password: 'correct' });
    const res = await request(app)
      .post('/api/users/outsider/login')
      .send({ handle: reg.body.handle, password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('GET /api/users/me returns handle only, never name', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('name');
    expect(res.body).not.toHaveProperty('api_token');
  });

  it('GET /api/users/me rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set(authHeader('invalid-token'));

    expect(res.status).toBe(401);
  });
});

describe('Projects API', () => {
  it('GET /api/projects lists user projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Project');
  });

  it('POST /api/projects creates a new project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(testUser1.api_token))
      .send({ name: 'New Project', description: 'A test project' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Project');
    expect(res.body.description).toBe('A test project');
  });

  it('POST /api/projects creates project with initial content', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(testUser1.api_token))
      .send({
        name: 'Content Project',
        files: { 'main.py': 'print("hello")', 'utils.py': 'def foo(): pass' },
        currentFile: 'main.py',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Content Project');
  });

  it('GET /api/projects/:id returns project with content', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Project');
    expect(res.body.role).toBe('owner');
    expect(res.body.files).toEqual({ 'main.py': 'print(1)' });
    expect(res.body.current_file).toBe('main.py');
  });

  it('GET /api/projects/:id denies access to non-owner without share', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser2.api_token));

    expect(res.status).toBe(403);
  });

  it('PUT /api/projects/:id updates project', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token))
      .send({ name: 'Updated Project' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Project');
  });

  it('DELETE /api/projects/:id deletes project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token));
    expect(getRes.status).toBe(404);
  });
});

describe('Save Content API', () => {
  it('PUT /api/projects/:id/save saves files', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/save`)
      .set(authHeader(testUser1.api_token))
      .send({ files: { 'main.py': 'print("updated")', 'new.py': 'x=1' } });

    expect(res.status).toBe(200);
    expect(res.body.files).toEqual({ 'main.py': 'print("updated")', 'new.py': 'x=1' });
  });

  it('PUT /api/projects/:id/save saves currentFile', async () => {
    await request(app)
      .put(`/api/projects/${testProject.id}/save`)
      .set(authHeader(testUser1.api_token))
      .send({ currentFile: 'new.py' });

    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token));
    expect(getRes.body.current_file).toBe('new.py');
  });

  it('PUT /api/projects/:id/save persists content across reads', async () => {
    await request(app)
      .put(`/api/projects/${testProject.id}/save`)
      .set(authHeader(testUser1.api_token))
      .send({ files: { 'main.py': 'print("persisted")' } });

    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token));
    expect(getRes.body.files['main.py']).toBe('print("persisted")');
  });

  it('PUT /api/projects/:id/save rejects viewer', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'viewer', now, now);

    const res = await request(app)
      .put(`/api/projects/${testProject.id}/save`)
      .set(authHeader(testUser2.api_token))
      .send({ files: { 'x.py': 'x' } });

    expect(res.status).toBe(403);
  });

  it('PUT /api/projects/:id/save allows editor', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'editor', now, now);

    const res = await request(app)
      .put(`/api/projects/${testProject.id}/save`)
      .set(authHeader(testUser2.api_token))
      .send({ files: { 'main.py': 'edited' } });

    expect(res.status).toBe(200);
    expect(res.body.files['main.py']).toBe('edited');
  });

  it('PUT /api/projects/:id/save returns 404 for nonexistent project', async () => {
    const res = await request(app)
      .put(`/api/projects/nonexistent/save`)
      .set(authHeader(testUser1.api_token))
      .send({ files: { 'main.py': 'x' } });

    expect(res.status).toBe(404);
  });
});

describe('Sharing API', () => {
  // Put both users into the same group so the S2 precondition
  // (SPP-3 tripwire: no first contact between strangers) is satisfied.
  // Also assign each a handle so the S1 lookup path has something to match.
  function seedGroupMembership(): void {
    const now = Date.now();
    const groupId = uuidv4();
    db.prepare('UPDATE users SET handle = ? WHERE id = ?').run('alice_h', testUser1.id);
    db.prepare('UPDATE users SET handle = ? WHERE id = ?').run('bob_h', testUser2.id);
    // testUser1 owns the group; testUser2 is a member.
    db.prepare('INSERT INTO groups (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)')
      .run(groupId, testUser1.id, 'Class', now);
    db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), groupId, testUser2.id, now);
  }

  it('POST /api/projects/:id/share shares project (handle + same-group precondition)', async () => {
    seedGroupMembership();
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ handle: 'bob_h', role: 'editor' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('editor');
  });

  it('shared user can access project', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'viewer', now, now);

    const res = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser2.api_token));

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('viewer');
  });

  it('DELETE /api/projects/:id/share/:userId removes share', async () => {
    const now = Date.now();
    const shareId = uuidv4();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(shareId, testProject.id, testUser2.id, 'viewer', now, now);

    const res = await request(app)
      .delete(`/api/projects/${testProject.id}/share/${testUser2.id}`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser2.api_token));
    expect(getRes.status).toBe(403);
  });

  it('non-owner cannot share project', async () => {
    seedGroupMembership();
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser2.api_token))
      .send({ handle: 'bob_h', role: 'viewer' });

    expect(res.status).toBe(403);
  });

  it('cannot share with role owner', async () => {
    seedGroupMembership();
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ handle: 'bob_h', role: 'owner' });
    expect(res.status).toBe(400);
  });

  // S1 — legacy `username` (u.name lookup) is removed.
  it('S1: rejects the legacy `username` field (name lookup removed)', async () => {
    seedGroupMembership();
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ username: testUser2.name, role: 'viewer' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/user_id or handle/i);
  });

  // S2 — SPP-3 tripwire precondition.
  it('S2: 403 when owner and target do not share a common group', async () => {
    // Assign a handle to testUser2 but do NOT put both in a common group.
    db.prepare('UPDATE users SET handle = ? WHERE id = ?').run('bob_h', testUser2.id);
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ handle: 'bob_h', role: 'viewer' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/same group/i);
  });

  it('S2: same-group precondition is symmetric — peer-in-same-class works', async () => {
    // A third-party account creates a group with both users as members.
    // Neither testUser1 nor testUser2 is the creator; they are peers.
    const teacherId = uuidv4();
    const now = Date.now();
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(teacherId, 'tk', null, 'student', now, now);
    const groupId = uuidv4();
    db.prepare('INSERT INTO groups (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)')
      .run(groupId, teacherId, 'Class', now);
    db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), groupId, testUser1.id, now);
    db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), groupId, testUser2.id, now);
    db.prepare('UPDATE users SET handle = ? WHERE id = ?').run('bob_h', testUser2.id);
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ handle: 'bob_h', role: 'viewer' });
    expect(res.status).toBe(201);
  });

  // S3 — u.name dropped from share list projection.
  it('S3: share list does not include `user_name`', async () => {
    seedGroupMembership();
    await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ handle: 'bob_h', role: 'viewer' });
    const res = await request(app)
      .get(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token));
    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty('user_name');
    expect(typeof res.body[0].user_handle).toBe('string');
  });
});

describe('Thumbnail API', () => {
  const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  it('GET /api/projects/:id/thumbnail returns 404 when no thumbnail', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(404);
  });

  it('PUT /api/projects/:id/thumbnail stores PNG and GET retrieves it', async () => {
    const putRes = await request(app)
      .put(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token))
      .set('Content-Type', 'image/png')
      .send(PNG_1PX);

    expect(putRes.status).toBe(200);
    expect(putRes.body).toHaveProperty('thumbnail_updated_at');

    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token));

    expect(getRes.status).toBe(200);
    expect(getRes.headers['content-type']).toMatch(/image\/png/);
  });

  it('PUT /api/projects/:id/thumbnail rejects non-PNG body', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token))
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(0));

    expect(res.status).toBe(400);
  });

  it('PUT /api/projects/:id/thumbnail rejects viewer', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'viewer', now, now);

    const res = await request(app)
      .put(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser2.api_token))
      .set('Content-Type', 'image/png')
      .send(PNG_1PX);

    expect(res.status).toBe(403);
  });

  it('DELETE /api/projects/:id/thumbnail removes thumbnail', async () => {
    await request(app)
      .put(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token))
      .set('Content-Type', 'image/png')
      .send(PNG_1PX);

    const delRes = await request(app)
      .delete(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token));

    expect(delRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser1.api_token));
    expect(getRes.status).toBe(404);
  });

  it('DELETE /api/projects/:id/thumbnail rejects viewer', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'viewer', now, now);

    const res = await request(app)
      .delete(`/api/projects/${testProject.id}/thumbnail`)
      .set(authHeader(testUser2.api_token));

    expect(res.status).toBe(403);
  });

  it('GET/PUT/DELETE thumbnail returns 404 for nonexistent project', async () => {
    const base = '/api/projects/nonexistent/thumbnail';
    const [g, p, d] = await Promise.all([
      request(app).get(base).set(authHeader(testUser1.api_token)),
      request(app).put(base).set(authHeader(testUser1.api_token)).set('Content-Type', 'image/png').send(PNG_1PX),
      request(app).delete(base).set(authHeader(testUser1.api_token)),
    ]);
    expect(g.status).toBe(404);
    expect(p.status).toBe(404);
    expect(d.status).toBe(404);
  });
});

describe('User Search API (removed under SPP-3 tripwire)', () => {
  it('GET /api/users/search returns 410 Gone', async () => {
    const res = await request(app)
      .get('/api/users/search?q=char')
      .set(authHeader(testUser1.api_token));
    expect(res.status).toBe(410);
  });
});
