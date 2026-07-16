import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createLiveRouter } from '../routes/live.js';
import { createGroupsRouter } from '../routes/groups.js';

let app: express.Application;
let db: Database.Database;

let teacher: { id: string; api_token: string; name: string };
let otherTeacher: { id: string; api_token: string; name: string };
let s1: { id: string; api_token: string; name: string };
let s2: { id: string; api_token: string; name: string };

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/live', createLiveRouter());
  app.use('/api/groups', createGroupsRouter());
});

function mkUser(role: 'teacher' | 'student', name: string) {
  const u = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name };
  const now = Date.now();
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(u.id, u.api_token, name, role, now, now);
  return u;
}

beforeEach(() => {
  db = createTestDb();
  teacher = mkUser('teacher', 'T');
  otherTeacher = mkUser('teacher', 'T2');
  s1 = mkUser('student', 'Alice');
  s2 = mkUser('student', 'Bob');
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('POST /api/live/presence', () => {
  it('writes a presence row, then updates it on conflict', async () => {
    const r1 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'main.py', cursor_line: 12 });
    expect(r1.status).toBe(204);
    const row1 = db.prepare('SELECT * FROM live_presence WHERE student_id = ? AND project_id = ?')
      .get(s1.id, 'p1') as { file: string; cursor_line: number };
    expect(row1.file).toBe('main.py');
    expect(row1.cursor_line).toBe(12);

    const r2 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'other.py', cursor_line: 3 });
    expect(r2.status).toBe(204);
    const rows = db.prepare('SELECT * FROM live_presence WHERE student_id = ? AND project_id = ?')
      .all(s1.id, 'p1') as { file: string; cursor_line: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].file).toBe('other.py');
    expect(rows[0].cursor_line).toBe(3);
  });

  it('rejects missing project_id/file with 400', async () => {
    const r1 = await request(app).post('/api/live/presence').set(auth(s1.api_token)).send({ file: 'a.py' });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post('/api/live/presence').set(auth(s1.api_token)).send({ project_id: 'p1' });
    expect(r2.status).toBe(400);
  });

  it('rejects overlong file path', async () => {
    const r = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'x'.repeat(201) });
    expect(r.status).toBe(400);
  });

  it('clamps negative / non-finite / huge cursor_line', async () => {
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'a.py', cursor_line: -5 });
    let row = db.prepare('SELECT cursor_line FROM live_presence WHERE student_id = ?').get(s1.id) as { cursor_line: number };
    expect(row.cursor_line).toBe(0);

    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'a.py', cursor_line: 9_999_999_999 });
    row = db.prepare('SELECT cursor_line FROM live_presence WHERE student_id = ?').get(s1.id) as { cursor_line: number };
    expect(row.cursor_line).toBe(1_000_000);

    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'a.py' /* cursor_line omitted */ });
    row = db.prepare('SELECT cursor_line FROM live_presence WHERE student_id = ?').get(s1.id) as { cursor_line: number };
    expect(row.cursor_line).toBe(0);
  });

  it('requires auth', async () => {
    const r = await request(app).post('/api/live/presence').send({ project_id: 'p1', file: 'a.py' });
    expect(r.status).toBe(401);
  });
});

describe('GET /api/live/group/:groupId', () => {
  async function makeGroupWithMembers() {
    const g = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G' });
    const groupId = g.body.id as string;
    const code = g.body.invite_code as string;
    await request(app).post('/api/groups/join').set(auth(s1.api_token)).send({ code });
    await request(app).post('/api/groups/join').set(auth(s2.api_token)).send({ code });
    return groupId;
  }

  it('teacher sees each member with idle flag; members with no ping are idle', async () => {
    const groupId = await makeGroupWithMembers();
    // s1 has a fresh ping, s2 has none.
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'main.py', cursor_line: 4 });

    const res = await request(app).get(`/api/live/group/${groupId}`).set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
    const byName = Object.fromEntries(res.body.members.map((m: { student_name: string }) => [m.student_name, m]));
    expect(byName['Alice'].idle).toBe(false);
    expect(byName['Alice'].file).toBe('main.py');
    expect(byName['Alice'].cursor_line).toBe(4);
    expect(byName['Bob'].idle).toBe(true);
    expect(byName['Bob'].file).toBeNull();
    expect(typeof res.body.server_now).toBe('number');
  });

  it('picks the most-recently-updated presence row per student across projects', async () => {
    const groupId = await makeGroupWithMembers();
    // Two projects for s1; second write wins in ORDER BY MAX(updated_at).
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p-old', file: 'old.py', cursor_line: 1 });
    // Force a later timestamp by patching the row directly, since successive
    // requests in the same ms would tie.
    db.prepare('UPDATE live_presence SET updated_at = ? WHERE student_id = ? AND project_id = ?')
      .run(Date.now() - 60_000, s1.id, 'p-old');
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p-new', file: 'new.py', cursor_line: 42 });

    const res = await request(app).get(`/api/live/group/${groupId}`).set(auth(teacher.api_token));
    const alice = res.body.members.find((m: { student_name: string }) => m.student_name === 'Alice');
    expect(alice.file).toBe('new.py');
    expect(alice.cursor_line).toBe(42);
    expect(alice.project_id).toBe('p-new');
  });

  it('marks stale (>5 min) presence as idle', async () => {
    const groupId = await makeGroupWithMembers();
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'p1', file: 'main.py', cursor_line: 1 });
    // Backdate 6 minutes.
    db.prepare('UPDATE live_presence SET updated_at = ? WHERE student_id = ?')
      .run(Date.now() - 6 * 60_000, s1.id);
    const res = await request(app).get(`/api/live/group/${groupId}`).set(auth(teacher.api_token));
    const alice = res.body.members.find((m: { student_name: string }) => m.student_name === 'Alice');
    expect(alice.idle).toBe(true);
  });

  it('403 for students', async () => {
    const groupId = await makeGroupWithMembers();
    const res = await request(app).get(`/api/live/group/${groupId}`).set(auth(s1.api_token));
    expect(res.status).toBe(403);
  });

  it('404 when teacher does not own the group', async () => {
    const groupId = await makeGroupWithMembers();
    const res = await request(app).get(`/api/live/group/${groupId}`).set(auth(otherTeacher.api_token));
    expect(res.status).toBe(404);
  });

  it('404 for unknown group id', async () => {
    const res = await request(app).get(`/api/live/group/${uuidv4()}`).set(auth(teacher.api_token));
    expect(res.status).toBe(404);
  });
});
