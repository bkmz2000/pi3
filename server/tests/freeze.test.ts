import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createUsersRouter } from '../routes/users.js';

let app: express.Application;
let db: Database.Database;
let teacher: { id: string; api_token: string };
let student: { id: string; api_token: string };

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/users', createUsersRouter(false));
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();
  teacher = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
  student = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(teacher.id, teacher.api_token, 'T', 'teacher', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(student.id, student.api_token, 'S', 'student', now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('freeze-updates flag', () => {
  it('GET /me returns freeze_updates=false by default', async () => {
    const res = await request(app).get('/api/users/me').set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body.freeze_updates).toBe(false);
  });

  it('PATCH /me/freeze toggles flag on and off, /me reflects it', async () => {
    const on = await request(app).patch('/api/users/me/freeze').set(auth(teacher.api_token)).send({ freeze: true });
    expect(on.status).toBe(200);
    expect(on.body.freeze_updates).toBe(true);

    const me1 = await request(app).get('/api/users/me').set(auth(teacher.api_token));
    expect(me1.body.freeze_updates).toBe(true);
    // stored as integer 1 in db
    const row = db.prepare('SELECT freeze_updates FROM users WHERE id = ?').get(teacher.id) as { freeze_updates: number };
    expect(row.freeze_updates).toBe(1);

    const off = await request(app).patch('/api/users/me/freeze').set(auth(teacher.api_token)).send({ freeze: false });
    expect(off.status).toBe(200);
    expect(off.body.freeze_updates).toBe(false);

    const me2 = await request(app).get('/api/users/me').set(auth(teacher.api_token));
    expect(me2.body.freeze_updates).toBe(false);
  });

  it('PATCH /me/freeze rejects students with 403', async () => {
    const res = await request(app).patch('/api/users/me/freeze').set(auth(student.api_token)).send({ freeze: true });
    expect(res.status).toBe(403);
    const row = db.prepare('SELECT freeze_updates FROM users WHERE id = ?').get(student.id) as { freeze_updates: number };
    expect(row.freeze_updates).toBe(0);
  });

  it('PATCH /me/freeze rejects missing/invalid body with 400', async () => {
    const r1 = await request(app).patch('/api/users/me/freeze').set(auth(teacher.api_token)).send({});
    expect(r1.status).toBe(400);
    const r2 = await request(app).patch('/api/users/me/freeze').set(auth(teacher.api_token)).send({ freeze: 'yes' });
    expect(r2.status).toBe(400);
  });

  it('PATCH /me/freeze requires auth', async () => {
    const res = await request(app).patch('/api/users/me/freeze').send({ freeze: true });
    expect(res.status).toBe(401);
  });
});
