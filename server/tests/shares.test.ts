import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import projectsRouter from '../routes/projects.js';

let app: express.Application;
let db: Database.Database;
let owner: { id: string; api_token: string; name: string };
let editor: { id: string; api_token: string; name: string };
let stranger: { id: string; api_token: string; name: string };
let projectId: string;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function mkUser(name: string, role: 'student' | 'teacher' = 'student') {
  const now = Date.now();
  const id = uuidv4();
  const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, token, name, role, now, now);
  return { id, api_token: token, name };
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/projects', projectsRouter);
});

beforeEach(() => {
  db = createTestDb();
  owner    = mkUser('Owner');
  editor   = mkUser('Editor');
  stranger = mkUser('Stranger');

  projectId = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, owner.id, 'P', 0, '{"main.py":"x=1"}', '{}', 'main.py', now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('Shares — POST /', () => {
  it('owner shares project with another user by username', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ username: editor.name, role: 'editor' });
    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(editor.id);
    expect(res.body.role).toBe('editor');
  });

  it('owner shares project by user_id (defaults role=viewer)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('viewer');
  });

  it('rejects unknown role', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ username: editor.name, role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid role/);
  });

  it('rejects missing username and user_id', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ role: 'viewer' });
    expect(res.status).toBe(400);
  });

  it('rejects sharing with self', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: owner.id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/yourself/);
  });

  it('rejects duplicate share', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id });
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id });
    expect(res.status).toBe(409);
  });

  it('rejects unknown username', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ username: 'nobody' });
    expect(res.status).toBe(404);
  });

  it('non-owner cannot share', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(stranger.api_token))
      .send({ user_id: editor.id });
    expect(res.status).toBe(403);
  });

  it('returns 404 on unknown project', async () => {
    const res = await request(app)
      .post(`/api/projects/unknown-pid/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id });
    expect(res.status).toBe(404);
  });
});

describe('Shares — GET /', () => {
  it('owner lists shares for the project', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id, role: 'editor' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].user_id).toBe(editor.id);
  });

  it('non-owner cannot list shares', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/share`)
      .set(auth(stranger.api_token));
    expect(res.status).toBe(403);
  });
});

describe('Shares — DELETE /:userId', () => {
  it('owner removes a share', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id });

    const del = await request(app)
      .delete(`/api/projects/${projectId}/share/${editor.id}`)
      .set(auth(owner.api_token));
    expect(del.status).toBe(204);

    const list = await request(app)
      .get(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token));
    expect(list.body).toHaveLength(0);
  });

  it('returns 404 for unknown share', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/share/${editor.id}`)
      .set(auth(owner.api_token));
    expect(res.status).toBe(404);
  });

  it('non-owner cannot delete share', async () => {
    await request(app)
      .post(`/api/projects/${projectId}/share`)
      .set(auth(owner.api_token))
      .send({ user_id: editor.id });
    const res = await request(app)
      .delete(`/api/projects/${projectId}/share/${editor.id}`)
      .set(auth(stranger.api_token));
    expect(res.status).toBe(403);
  });
});
