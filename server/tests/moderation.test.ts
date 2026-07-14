process.env.RATE_LIMIT_TEST = '0';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createModerationRouter } from '../routes/moderation.js';

let app: express.Application;
let db: Database.Database;

let reviewer: { id: string; api_token: string };
let student: { id: string; api_token: string };

function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/moderation', createModerationRouter());
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();
  reviewer = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
  student = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(reviewer.id, reviewer.api_token, 'Rev', 'teacher', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(student.id, student.api_token, 'Stu', 'student', now, now);
  process.env.REVIEWER_IDS = reviewer.id;
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
  delete process.env.REVIEWER_IDS;
});

describe('moderation — report intake', () => {
  it('any authed user can file a report', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.api_token)).send({
      target_type: 'snapshot', target_id: 'abc123', reason: 'looks bad',
    });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('rejects invalid target_type', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.api_token)).send({
      target_type: 'user', target_id: 'x', reason: 'x',
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty reason', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.api_token)).send({
      target_type: 'comment', target_id: 'x', reason: '   ',
    });
    expect(res.status).toBe(400);
  });

  it('rejects reason over max length', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.api_token)).send({
      target_type: 'comment', target_id: 'x', reason: 'x'.repeat(501),
    });
    expect(res.status).toBe(400);
  });
});

describe('moderation — flagged queue', () => {
  it('reviewer sees open reports', async () => {
    await request(app).post('/api/moderation/report').set(auth(student.api_token)).send({
      target_type: 'snapshot', target_id: 'abc', reason: 'test',
    });
    const res = await request(app).get('/api/moderation/flagged').set(auth(reviewer.api_token));
    expect(res.status).toBe(200);
    expect(res.body.reports.length).toBe(1);
    expect(res.body.reports[0].target_id).toBe('abc');
  });

  it('non-reviewer authed user gets 403', async () => {
    const res = await request(app).get('/api/moderation/flagged').set(auth(student.api_token));
    expect(res.status).toBe(403);
  });

  it('unconfigured allowlist returns 503', async () => {
    const prev = process.env.REVIEWER_IDS;
    delete process.env.REVIEWER_IDS;
    const res = await request(app).get('/api/moderation/flagged').set(auth(reviewer.api_token));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('reviewer_allowlist_unconfigured');
    process.env.REVIEWER_IDS = prev;
  });
});
