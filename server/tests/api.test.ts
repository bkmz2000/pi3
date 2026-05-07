import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';

import usersRouter from '../routes/users.js';
import projectsRouter from '../routes/projects.js';

let app: express.Application;
let db: Database.Database;
let testUser1: { id: string; api_token: string; name: string };
let testUser2: { id: string; api_token: string; name: string };
let testProject: { id: string; user_id: string; name: string };

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
});

beforeEach(() => {
  db = createTestDb();

  testUser1 = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: 'Alice',
  };

  testUser2 = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name: 'Bob',
  };

  const now = Date.now();
  db.prepare('INSERT INTO users (id, api_token, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(testUser1.id, testUser1.api_token, testUser1.name, now, now);
  db.prepare('INSERT INTO users (id, api_token, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(testUser2.id, testUser2.api_token, testUser2.name, now, now);

  testProject = {
    id: uuidv4(),
    user_id: testUser1.id,
    name: 'Test Project',
  };

  db.prepare('INSERT INTO projects (id, user_id, name, is_public, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(testProject.id, testProject.user_id, testProject.name, 0, now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('Users API', () => {
  it('POST /api/users creates a new user', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: 'Charlie' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Charlie');
    expect(res.body).toHaveProperty('api_token');
  });

  it('POST /api/users rejects empty name', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ name: '' });

    expect(res.status).toBe(400);
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

  it('GET /api/projects/:id returns project details', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.id}`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Project');
    expect(res.body.role).toBe('owner');
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

describe('Files API', () => {
  let testFile: { id: string; project_id: string; path: string };

  beforeEach(() => {
    const now = Date.now();
    testFile = {
      id: uuidv4(),
      project_id: testProject.id,
      path: '/main.py',
    };
    db.prepare('INSERT INTO files (id, project_id, path, content, is_directory, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(testFile.id, testFile.project_id, testFile.path, 'print("hello")', 0, now, now);
  });

  it('GET /api/projects/:id/files lists files', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.id}/files`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].path).toBe('/main.py');
  });

  it('POST /api/projects/:id/files creates a file', async () => {
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/files`)
      .set(authHeader(testUser1.api_token))
      .send({ path: '/utils.py', content: 'def foo(): pass' });

    expect(res.status).toBe(201);
    expect(res.body.path).toBe('/utils.py');
  });

  it('GET /api/projects/:id/files/:path gets file content', async () => {
    const res = await request(app)
      .get(`/api/projects/${testProject.id}/files/main.py`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('print("hello")');
  });

  it('PUT /api/projects/:id/files/:path updates file', async () => {
    const res = await request(app)
      .put(`/api/projects/${testProject.id}/files/main.py`)
      .set(authHeader(testUser1.api_token))
      .send({ content: 'print("updated")' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('print("updated")');
  });

  it('DELETE /api/projects/:id/files/:path deletes file', async () => {
    const res = await request(app)
      .delete(`/api/projects/${testProject.id}/files/main.py`)
      .set(authHeader(testUser1.api_token));

    expect(res.status).toBe(204);
  });

  it('editor can modify files', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'editor', now, now);

    const res = await request(app)
      .put(`/api/projects/${testProject.id}/files/main.py`)
      .set(authHeader(testUser2.api_token))
      .send({ content: 'print("editor")' });

    expect(res.status).toBe(200);
  });

  it('viewer cannot modify files', async () => {
    const now = Date.now();
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), testProject.id, testUser2.id, 'viewer', now, now);

    const res = await request(app)
      .put(`/api/projects/${testProject.id}/files/main.py`)
      .set(authHeader(testUser2.api_token))
      .send({ content: 'print("viewer")' });

    expect(res.status).toBe(403);
  });
});

describe('Sharing API', () => {
  it('POST /api/projects/:id/share shares project', async () => {
    const res = await request(app)
      .post(`/api/projects/${testProject.id}/share`)
      .set(authHeader(testUser1.api_token))
      .send({ email: testUser2.name, role: 'editor' });

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
      .send({ email: testUser2.name, role: 'viewer' });

    expect(res.status).toBe(403);
  });
});
