import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createSessionsRouter } from '../routes/sessions.js';
import { issueSessionToken, verifySessionToken, SESSION_TTL_MS } from '../sessions/tokens.js';
import { _resetForTests as resetComments } from '../sessions/comments.js';
import { _resetForTests as resetReactions } from '../sessions/reactions.js';

let app: express.Application;
let db: Database.Database;
let starter: { id: string; api_token: string };
let joiner: { id: string; api_token: string };

function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/sessions', createSessionsRouter());
});

beforeEach(() => {
  db = createTestDb();
  resetComments();
  resetReactions();
  const now = Date.now();
  starter = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') };
  joiner = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') };
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(starter.id, starter.api_token, 'S', 'student', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(joiner.id, joiner.api_token, 'J', 'student', now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('sessions — token issue/verify', () => {
  it('issueSessionToken produces verifiable token bound to starter', () => {
    const { token, payload } = issueSessionToken('user-a');
    const v = verifySessionToken(token, 'user-a');
    expect(v).not.toBeNull();
    expect(v!.sid).toBe(payload.sid);
    expect(v!.role).toBe('starter');
    expect(v!.exp - v!.iat).toBe(SESSION_TTL_MS);
  });

  it('other viewers verify as joiner', () => {
    const { token } = issueSessionToken('user-a');
    const v = verifySessionToken(token, 'user-b');
    expect(v!.role).toBe('joiner');
  });

  it('tampered signature rejected', () => {
    const { token } = issueSessionToken('user-a');
    const parts = token.split('.');
    const bad = `${parts[0]}.AAAA${parts[1].slice(4)}`;
    expect(verifySessionToken(bad, 'user-a')).toBeNull();
  });

  it('expired token rejected', () => {
    const past = Date.now() - SESSION_TTL_MS - 1000;
    const { token } = issueSessionToken('user-a', past);
    expect(verifySessionToken(token, 'user-a')).toBeNull();
  });
});

describe('sessions — routes', () => {
  it('POST /start returns token and session_id', async () => {
    const res = await request(app).post('/api/sessions/start').set(auth(starter.api_token)).send({});
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.session_id).toMatch(/^[a-f0-9]{18}$/);
    expect(res.body.expires_at).toBeGreaterThan(Date.now());
  });

  it('POST /join validates token; other user is joiner', async () => {
    const startRes = await request(app).post('/api/sessions/start').set(auth(starter.api_token)).send({});
    const token = startRes.body.token;
    const joinRes = await request(app).post('/api/sessions/join').set(auth(joiner.api_token)).send({ token });
    expect(joinRes.status).toBe(200);
    expect(joinRes.body.role).toBe('joiner');
    expect(joinRes.body.starter_id).toBe(starter.id);
  });

  it('POST /join with invalid token → 401', async () => {
    const res = await request(app).post('/api/sessions/join').set(auth(joiner.api_token)).send({ token: 'garbage.token' });
    expect(res.status).toBe(401);
  });

  it('GET /allowed-emoji returns whitelist', async () => {
    const res = await request(app).get('/api/sessions/allowed-emoji').set(auth(starter.api_token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.allowed)).toBe(true);
    expect(res.body.allowed.length).toBeGreaterThan(0);
  });

  it('GET /allowed-reactions returns semantic reaction ids', async () => {
    const res = await request(app).get('/api/sessions/allowed-reactions').set(auth(starter.api_token));
    expect(res.status).toBe(200);
    expect(res.body.allowed).toEqual(['good', 'question', 'try']);
  });
});

describe('sessions — line reactions', () => {
  let token: string;
  let sid: string;

  beforeEach(async () => {
    const startRes = await request(app).post('/api/sessions/start').set(auth(starter.api_token)).send({});
    token = startRes.body.token;
    sid = startRes.body.session_id;
    db.prepare(`INSERT INTO live_presence
      (student_id, project_id, file, cursor_line, updated_at, content, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(joiner.id, `session:${sid}`, 'main.py', 4, Date.now(), 'print(1)', sid);
  });

  it('posts and lists a semantic reaction on an exact line', async () => {
    const post = await request(app).post(`/api/sessions/${sid}/reactions`).set(auth(starter.api_token))
      .send({ token, reaction: 'good', target: joiner.id, file: 'main.py', line: 4 });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({ reaction: 'good', target: joiner.id, file: 'main.py', line: 4 });

    const list = await request(app).post(`/api/sessions/${sid}/reactions/list`).set(auth(joiner.api_token))
      .send({ token });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects free text and missing line context', async () => {
    const freeText = await request(app).post(`/api/sessions/${sid}/reactions`).set(auth(starter.api_token))
      .send({ token, reaction: 'nice work', target: joiner.id, file: 'main.py', line: 4 });
    expect(freeText.status).toBe(400);
    const missingLine = await request(app).post(`/api/sessions/${sid}/reactions`).set(auth(starter.api_token))
      .send({ token, reaction: 'good', target: joiner.id, file: 'main.py' });
    expect(missingLine.status).toBe(400);
  });

  it('only the starter can react in a classroom session', async () => {
    const groupId = uuidv4();
    const now = Date.now();
    db.prepare('INSERT INTO groups (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)')
      .run(groupId, starter.id, 'A2', now);
    db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), groupId, joiner.id, now);
    const classroom = issueSessionToken(starter.id, now, { groupId });
    db.prepare('INSERT INTO live_group_sessions (group_id, sid, starter_id, started_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(groupId, classroom.payload.sid, starter.id, now, classroom.payload.exp);

    const denied = await request(app).post(`/api/sessions/${classroom.payload.sid}/reactions`).set(auth(joiner.api_token))
      .send({ token: classroom.token, reaction: 'question', target: joiner.id, file: 'main.py', line: 2 });
    expect(denied.status).toBe(403);

    const allowed = await request(app).post(`/api/sessions/${classroom.payload.sid}/reactions`).set(auth(starter.api_token))
      .send({ token: classroom.token, reaction: 'question', target: joiner.id, file: 'main.py', line: 2 });
    expect(allowed.status).toBe(201);

    db.prepare('DELETE FROM live_group_sessions WHERE group_id = ?').run(groupId);
    const afterEnd = await request(app).post(`/api/sessions/${classroom.payload.sid}/reactions/list`)
      .set(auth(joiner.api_token)).send({ token: classroom.token });
    expect(afterEnd.status).toBe(410);
  });
});

describe('sessions — emoji comments', () => {
  let token: string;
  let sid: string;

  beforeEach(async () => {
    const startRes = await request(app).post('/api/sessions/start').set(auth(starter.api_token)).send({});
    token = startRes.body.token;
    sid = startRes.body.session_id;
  });

  it('member posts whitelisted emoji', async () => {
    const res = await request(app).post(`/api/sessions/${sid}/comments`).set(auth(joiner.api_token))
      .send({ token, emoji: '👍', target: 'main.py:12' });
    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe('👍');
  });

  it('rejects free-text', async () => {
    const res = await request(app).post(`/api/sessions/${sid}/comments`).set(auth(joiner.api_token))
      .send({ token, emoji: 'looks good to me' });
    expect(res.status).toBe(400);
  });

  it('rejects mismatched session id in URL', async () => {
    const res = await request(app).post(`/api/sessions/deadbeefdeadbeefff/comments`).set(auth(joiner.api_token))
      .send({ token, emoji: '👍' });
    expect(res.status).toBe(403);
  });

  it('lists comments for session', async () => {
    await request(app).post(`/api/sessions/${sid}/comments`).set(auth(joiner.api_token))
      .send({ token, emoji: '👍' });
    await request(app).post(`/api/sessions/${sid}/comments`).set(auth(joiner.api_token))
      .send({ token, emoji: '🔥' });
    const listRes = await request(app).post(`/api/sessions/${sid}/comments/list`).set(auth(starter.api_token))
      .send({ token });
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(2);
  });
});
