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
  it('POST /api/users/outsider creates a new user', async () => {
    const res = await request(app)
      .post('/api/users/outsider')
      .send({ name: 'Charlie', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Charlie');
    expect(res.body).not.toHaveProperty('api_token');
  });

  it('POST /api/users/outsider rejects empty name', async () => {
    const res = await request(app)
      .post('/api/users/outsider')
      .send({ name: '', password: 'secret123' });

    expect(res.status).toBe(400);
  });

  it('POST /api/users/outsider rejects missing password', async () => {
    const res = await request(app)
      .post('/api/users/outsider')
      .send({ name: 'Dave' });

    expect(res.status).toBe(400);
  });

  it('POST /api/users/outsider/login succeeds with correct credentials', async () => {
    await request(app).post('/api/users/outsider').send({ name: 'Eve', password: 'pass1234' });
    const res = await request(app)
      .post('/api/users/outsider/login')
      .send({ name: 'Eve', password: 'pass1234' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('POST /api/users/outsider/login rejects wrong password', async () => {
    await request(app).post('/api/users/outsider').send({ name: 'Frank', password: 'correct' });
    const res = await request(app)
      .post('/api/users/outsider/login')
      .send({ name: 'Frank', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('GET /api/users/me returns current user', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(testUser1.name);
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
  it('POST /api/projects/:id/share shares project', async () => {
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ username: testUser2.name, role: 'editor' });

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
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser2.api_token))
      .send({ username: testUser2.name, role: 'viewer' });

    expect(res.status).toBe(403);
  });

  it('cannot share with role owner', async () => {
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ username: testUser2.name, role: 'owner' });
    expect(res.status).toBe(400);
  });
});
