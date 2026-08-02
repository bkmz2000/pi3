import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createLiveRouter, pruneStaleLivePresence } from '../routes/live.js';
import { createGroupsRouter } from '../routes/groups.js';
import { issueSessionToken } from '../sessions/tokens.js';

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
  app.use(express.json({ limit: '10mb' }));
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

// Presence now requires a real, owned project (or a token-verified session
// key) — a bare literal string like 'p1' is no longer accepted.
function mkProject(ownerId: string, name = 'P'): string {
  const id = uuidv4();
  const now = Date.now();
  db.prepare(
    'INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, ownerId, name, 0, '{}', '{}', 'main.py', now, now);
  return id;
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
    const p1 = mkProject(s1.id);
    const r1 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'main.py', cursor_line: 12 });
    expect(r1.status).toBe(204);
    const row1 = db.prepare('SELECT * FROM live_presence WHERE student_id = ? AND project_id = ?')
      .get(s1.id, p1) as { file: string; cursor_line: number };
    expect(row1.file).toBe('main.py');
    expect(row1.cursor_line).toBe(12);

    const r2 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'other.py', cursor_line: 3 });
    expect(r2.status).toBe(204);
    const rows = db.prepare('SELECT * FROM live_presence WHERE student_id = ? AND project_id = ?')
      .all(s1.id, p1) as { file: string; cursor_line: number }[];
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

  it('rejects a real-looking but unowned/nonexistent project_id', async () => {
    const otherProject = mkProject(s2.id);
    const r = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: otherProject, file: 'a.py', cursor_line: 1 });
    expect(r.status).toBe(403);
    const r2 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: uuidv4(), file: 'a.py', cursor_line: 1 });
    expect(r2.status).toBe(403);
  });

  it('rejects a session: key with no token, or an invalid one', async () => {
    const r1 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'session:abc123', file: 'a.py', cursor_line: 1 });
    expect(r1.status).toBe(401);
    const r2 = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'session:abc123', file: 'a.py', cursor_line: 1, token: 'garbage' });
    expect(r2.status).toBe(401);
  });

  it('accepts a session: key with a valid token, and ignores a spoofed sid', async () => {
    const { token, payload } = issueSessionToken(s1.id);
    const r = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: 'session:someone-elses-sid', file: 'a.py', cursor_line: 1, token });
    expect(r.status).toBe(204);
    // The verified token's own sid wins — never the client-claimed one.
    const row = db.prepare('SELECT project_id, session_id FROM live_presence WHERE student_id = ?')
      .get(s1.id) as { project_id: string; session_id: string };
    expect(row.project_id).toBe(`session:${payload.sid}`);
    expect(row.session_id).toBe(payload.sid);
  });

  it('clamps negative / non-finite / huge cursor_line', async () => {
    const p1 = mkProject(s1.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: -5 });
    let row = db.prepare('SELECT cursor_line FROM live_presence WHERE student_id = ?').get(s1.id) as { cursor_line: number };
    expect(row.cursor_line).toBe(0);

    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 9_999_999_999 });
    row = db.prepare('SELECT cursor_line FROM live_presence WHERE student_id = ?').get(s1.id) as { cursor_line: number };
    expect(row.cursor_line).toBe(1_000_000);

    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py' /* cursor_line omitted */ });
    row = db.prepare('SELECT cursor_line FROM live_presence WHERE student_id = ?').get(s1.id) as { cursor_line: number };
    expect(row.cursor_line).toBe(0);
  });

  it('requires auth', async () => {
    const r = await request(app).post('/api/live/presence').send({ project_id: 'p1', file: 'a.py' });
    expect(r.status).toBe(401);
  });

  it('stores content + hash; a later ping without content keeps the last buffer', async () => {
    const p1 = mkProject(s1.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 1, content: 'print(1)', content_hash: 'h1' });
    let row = db.prepare('SELECT content, content_hash FROM live_presence WHERE student_id = ?')
      .get(s1.id) as { content: string; content_hash: string };
    expect(row.content).toBe('print(1)');
    expect(row.content_hash).toBe('h1');

    // Skip-unchanged: cursor moved but content omitted — buffer must survive.
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 5 });
    row = db.prepare('SELECT content, content_hash FROM live_presence WHERE student_id = ?')
      .get(s1.id) as { content: string; content_hash: string };
    expect(row.content).toBe('print(1)');
    expect(row.content_hash).toBe('h1');

    // New content overwrites.
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 5, content: 'print(2)', content_hash: 'h2' });
    row = db.prepare('SELECT content, content_hash FROM live_presence WHERE student_id = ?')
      .get(s1.id) as { content: string; content_hash: string };
    expect(row.content).toBe('print(2)');
  });

  it('caps oversized content instead of rejecting', async () => {
    const p1 = mkProject(s1.id);
    const big = 'x'.repeat(300 * 1024);
    const r = await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 1, content: big, content_hash: 'h' });
    expect(r.status).toBe(204);
    const row = db.prepare('SELECT content FROM live_presence WHERE student_id = ?').get(s1.id) as { content: string };
    expect(row.content.length).toBe(256 * 1024);
  });

  it('tags a real-project row with session_id only when a valid token is sent, and clears it when the token is dropped', async () => {
    const p1 = mkProject(s1.id);
    const { token, payload } = issueSessionToken(s1.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 1, token });
    let row = db.prepare('SELECT session_id FROM live_presence WHERE student_id = ?').get(s1.id) as { session_id: string | null };
    expect(row.session_id).toBe(payload.sid);

    // Leaving the session: client stops sending the token, row's session_id clears.
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 1 });
    row = db.prepare('SELECT session_id FROM live_presence WHERE student_id = ?').get(s1.id) as { session_id: string | null };
    expect(row.session_id).toBeNull();
  });
});

describe('GET /api/live/group/:groupId/member/:studentId', () => {
  async function groupWithPing() {
    const g = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G' });
    const groupId = g.body.id as string;
    await request(app).post('/api/groups/join').set(auth(s1.api_token)).send({ code: g.body.invite_code });
    const p1 = mkProject(s1.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'main.py', cursor_line: 7, content: 'x = 1', content_hash: 'h' });
    return groupId;
  }

  it('teacher reads a member live buffer', async () => {
    const groupId = await groupWithPing();
    const res = await request(app).get(`/api/live/group/${groupId}/member/${s1.id}`).set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('x = 1');
    expect(res.body.cursor_line).toBe(7);
  });

  it('403 for students', async () => {
    const groupId = await groupWithPing();
    const res = await request(app).get(`/api/live/group/${groupId}/member/${s1.id}`).set(auth(s1.api_token));
    expect(res.status).toBe(403);
  });

  it('404 when teacher does not own the group', async () => {
    const groupId = await groupWithPing();
    const res = await request(app).get(`/api/live/group/${groupId}/member/${s1.id}`).set(auth(otherTeacher.api_token));
    expect(res.status).toBe(404);
  });

  it('404 when the target is not a group member', async () => {
    const groupId = await groupWithPing();
    const res = await request(app).get(`/api/live/group/${groupId}/member/${s2.id}`).set(auth(teacher.api_token));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/live/session/:sid — symmetric vs classroom', () => {
  // Peers self-register by stamping presence pings with a verified session
  // token, using the synthetic `session:<sid>` project key (no real project
  // needed — this is how the pinger behaves for an unsaved/example buffer).
  async function ping(who: { id: string; api_token: string }, sid: string, token: string, content: string) {
    await request(app).post('/api/live/presence').set(auth(who.api_token))
      .send({ project_id: `session:${sid}`, file: 'main.py', cursor_line: 2, content, content_hash: content, token });
  }

  it('symmetric: any member reads any member; roster lists peers', async () => {
    const { token, payload } = issueSessionToken(s1.id); // no groupId ⇒ symmetric
    await ping(s1, payload.sid, token, 's1 code');
    await ping(s2, payload.sid, token, 's2 code');

    // s2 (joiner) reads s1 (peer) — allowed.
    const res = await request(app)
      .get(`/api/live/session/${payload.sid}/member/${s1.id}`)
      .set(auth(s2.api_token))
      .set('X-Session-Token', token);
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('s1 code');

    const roster = await request(app)
      .get(`/api/live/session/${payload.sid}/roster`)
      .set(auth(s2.api_token))
      .set('X-Session-Token', token);
    expect(roster.status).toBe(200);
    expect(roster.body.members).toHaveLength(2);
    expect(roster.body.role).toBe('joiner');
  });

  it('classroom: a joiner (student) cannot read a peer, the starter (teacher) can', async () => {
    // groupId-bound token, starter = teacher.
    const g = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G' });
    const { token, payload } = issueSessionToken(teacher.id, Date.now(), { groupId: g.body.id });
    await ping(s1, payload.sid, token, 's1 code');
    await ping(s2, payload.sid, token, 's2 code');

    // s1 (joiner) tries to read s2 (peer) — denied.
    const denied = await request(app)
      .get(`/api/live/session/${payload.sid}/member/${s2.id}`)
      .set(auth(s1.api_token))
      .set('X-Session-Token', token);
    expect(denied.status).toBe(403);

    // s1 may still read their own buffer.
    const own = await request(app)
      .get(`/api/live/session/${payload.sid}/member/${s1.id}`)
      .set(auth(s1.api_token))
      .set('X-Session-Token', token);
    expect(own.status).toBe(200);
    expect(own.body.content).toBe('s1 code');

    // The starter (teacher) reads any peer.
    const allowed = await request(app)
      .get(`/api/live/session/${payload.sid}/member/${s2.id}`)
      .set(auth(teacher.api_token))
      .set('X-Session-Token', token);
    expect(allowed.status).toBe(200);
    expect(allowed.body.content).toBe('s2 code');

    // A joiner's roster shows only themselves.
    const roster = await request(app)
      .get(`/api/live/session/${payload.sid}/roster`)
      .set(auth(s1.api_token))
      .set('X-Session-Token', token);
    expect(roster.body.members).toHaveLength(1);
    expect(roster.body.members[0].student_id).toBe(s1.id);
  });

  it('401 without a token, 403 on session mismatch', async () => {
    const { token, payload } = issueSessionToken(s1.id);
    await ping(s1, payload.sid, token, 'code');
    const noTok = await request(app).get(`/api/live/session/${payload.sid}/roster`).set(auth(s1.api_token));
    expect(noTok.status).toBe(401);
    const mismatch = await request(app)
      .get('/api/live/session/other-sid/roster')
      .set(auth(s1.api_token))
      .set('X-Session-Token', token);
    expect(mismatch.status).toBe(403);
  });

  it('no longer authenticates via the old ?token= query param', async () => {
    const { token, payload } = issueSessionToken(s1.id);
    await ping(s1, payload.sid, token, 'code');
    const viaQuery = await request(app)
      .get(`/api/live/session/${payload.sid}/roster?token=${encodeURIComponent(token)}`)
      .set(auth(s1.api_token));
    expect(viaQuery.status).toBe(401);
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
    const p1 = mkProject(s1.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'main.py', cursor_line: 4 });

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
    const pOld = mkProject(s1.id, 'old');
    const pNew = mkProject(s1.id, 'new');
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: pOld, file: 'old.py', cursor_line: 1 });
    // Force a later timestamp by patching the row directly, since successive
    // requests in the same ms would tie.
    db.prepare('UPDATE live_presence SET updated_at = ? WHERE student_id = ? AND project_id = ?')
      .run(Date.now() - 60_000, s1.id, pOld);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: pNew, file: 'new.py', cursor_line: 42 });

    const res = await request(app).get(`/api/live/group/${groupId}`).set(auth(teacher.api_token));
    const alice = res.body.members.find((m: { student_name: string }) => m.student_name === 'Alice');
    expect(alice.file).toBe('new.py');
    expect(alice.cursor_line).toBe(42);
    expect(alice.project_id).toBe(pNew);
  });

  it('marks stale (>5 min) presence as idle', async () => {
    const groupId = await makeGroupWithMembers();
    const p1 = mkProject(s1.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'main.py', cursor_line: 1 });
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

describe('pruneStaleLivePresence', () => {
  it('deletes rows past retention, keeps fresh ones', async () => {
    const p1 = mkProject(s1.id);
    const p2 = mkProject(s2.id);
    await request(app).post('/api/live/presence').set(auth(s1.api_token))
      .send({ project_id: p1, file: 'a.py', cursor_line: 1 });
    await request(app).post('/api/live/presence').set(auth(s2.api_token))
      .send({ project_id: p2, file: 'b.py', cursor_line: 1 });
    db.prepare('UPDATE live_presence SET updated_at = ? WHERE student_id = ?')
      .run(Date.now() - 2 * 24 * 60 * 60 * 1000, s1.id);

    await pruneStaleLivePresence(24 * 60 * 60 * 1000);

    const rows = db.prepare('SELECT student_id FROM live_presence').all() as { student_id: string }[];
    expect(rows.map((r) => r.student_id)).toEqual([s2.id]);
  });
});
