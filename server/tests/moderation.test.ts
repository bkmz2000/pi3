import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createModerationRouter } from '../routes/moderation.js';

let app: express.Application;
let db: Database.Database;

type Acct = { id: string; token: string; handle: string };
let reviewer: Acct;
let student: Acct;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function seedUser(role: 'student' | 'teacher', handle: string): Acct {
  const id = uuidv4();
  const token = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, api_token, name, role, handle, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, token, null, role, handle, now, now);
  return { id, token, handle };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/moderation', createModerationRouter());
});

beforeEach(() => {
  db = createTestDb();
  reviewer = seedUser('teacher', 'rev');
  student = seedUser('student', 'stu');
  process.env.REVIEWER_IDS = reviewer.id;
});

afterEach(() => {
  delete process.env.REVIEWER_IDS;
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('GET /api/moderation/flagged', () => {
  it('returns 503 when REVIEWER_IDS is not set', async () => {
    delete process.env.REVIEWER_IDS;
    const res = await request(app).get('/api/moderation/flagged').set(auth(reviewer.token));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('reviewer_allowlist_unconfigured');
  });

  it('returns 403 for a non-reviewer', async () => {
    const res = await request(app).get('/api/moderation/flagged').set(auth(student.token));
    expect(res.status).toBe(403);
  });

  it('returns flagged rows across snapshots, problems, comments, and open reports', async () => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO project_snapshots (id, share_link, owner_id, title, files_json, created_at, scan_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(uuidv4(), 'sl1', student.id, 'Bad snap', '{}', now, 'flagged');

    db.prepare(
      `INSERT INTO problems (slug, title, statement, created_by, scan_status)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('bad-prob', 'Bad', 'stmt', student.id, 'flagged');

    const pid = uuidv4();
    db.prepare(
      'INSERT INTO projects (id, user_id, name, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(pid, student.id, 'proj', '{}', '{}', 'main.py', now, now);
    db.prepare(
      `INSERT INTO comments (id, project_id, file_path, line_number, anchor_text, text, author_id, created_at, scan_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(uuidv4(), pid, 'main.py', 1, '', 'bad', student.id, now, 'flagged');

    db.prepare(
      `INSERT INTO content_reports (target_type, target_id, reporter_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('share_link', 'sl2', student.id, 'looks bad', now);

    const res = await request(app).get('/api/moderation/flagged').set(auth(reviewer.token));
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(1);
    expect(res.body.problems).toHaveLength(1);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.reports).toHaveLength(1);
  });
});

describe('POST /api/moderation/report', () => {
  it('any authed user can file a report', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.token)).send({
      target_type: 'share_link',
      target_id: 'abc123',
      reason: 'contains personal info',
    });
    expect(res.status).toBe(201);
    const row = db.prepare('SELECT * FROM content_reports WHERE target_id = ?').get('abc123') as {
      target_type: string; reporter_id: string; reason: string; handled_at: number | null;
    };
    expect(row.target_type).toBe('share_link');
    expect(row.reporter_id).toBe(student.id);
    expect(row.reason).toBe('contains personal info');
    expect(row.handled_at).toBeNull();
  });

  it('rejects unknown target_type', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.token)).send({
      target_type: 'user',
      target_id: 'x',
      reason: 'r',
    });
    expect(res.status).toBe(400);
  });

  it('rejects empty reason', async () => {
    const res = await request(app).post('/api/moderation/report').set(auth(student.token)).send({
      target_type: 'snapshot',
      target_id: 'x',
      reason: '  ',
    });
    expect(res.status).toBe(400);
  });

  it('rejects unauthenticated caller', async () => {
    const res = await request(app).post('/api/moderation/report').send({
      target_type: 'snapshot', target_id: 'x', reason: 'y',
    });
    expect(res.status).toBe(401);
  });
});
