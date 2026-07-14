process.env.RATE_LIMIT_TEST = '0';

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createUsersRouter } from '../routes/users.js';
import { createSnapshotsRouter } from '../routes/snapshots.js';

let app: express.Application;
let db: Database.Database;
let student: { id: string; api_token: string };
let teacher: { id: string; api_token: string };
let owner: { id: string; api_token: string; name: string };
let projectId: string;

function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/users', createUsersRouter(false));
  app.use('/api/snapshots', createSnapshotsRouter());
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();
  student = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') };
  teacher = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') };
  owner = { id: uuidv4(), api_token: uuidv4().replace(/-/g, ''), name: 'OwnerAlice' };
  db.prepare('INSERT INTO users (id, api_token, name, handle, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(student.id, student.api_token, 'StuKid', 'stukid', 'student', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, handle, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(teacher.id, teacher.api_token, 'MrTeacher', 'teach1', 'teacher', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(owner.id, owner.api_token, owner.name, 'student', now, now);
  projectId = uuidv4();
  db.prepare('INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, owner.id, 'Hi', 0, '{"main.py": "print(1)"}', '{}', 'main.py', now, now);
});

afterEach(() => {
  delete process.env.DEPLOYMENT_PROFILE;
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('profile matrix — institutional', () => {
  beforeEach(() => { process.env.DEPLOYMENT_PROFILE = 'institutional'; });

  it('/users/search returns teacher rows', async () => {
    const res = await request(app).get('/api/users/search?q=teach').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].role).toBe('teacher');
  });

  it('snapshot public projection attaches author_name', async () => {
    const snapRes = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token)).send({});
    const link = snapRes.body.share_link;
    const readRes = await request(app).get(`/api/snapshots/s/${link}`);
    expect(readRes.body.author_name).toBe(owner.name);
  });
});

describe('profile matrix — public', () => {
  beforeEach(() => { process.env.DEPLOYMENT_PROFILE = 'public'; });

  it('/users/search returns 410 Gone', async () => {
    const res = await request(app).get('/api/users/search?q=teach').set(auth(student.api_token));
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Gone');
  });

  it('snapshot public projection strips author_name', async () => {
    const snapRes = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token)).send({});
    const link = snapRes.body.share_link;
    const readRes = await request(app).get(`/api/snapshots/s/${link}`);
    expect(readRes.body.author_name).toBeUndefined();
    expect(readRes.body.title).toBe('Hi');
  });
});
