import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createSessionsRouter } from '../routes/sessions.js';
import { issueSessionToken, verifySessionToken, SESSION_TTL_MS } from '../sessions/tokens.js';
import { _resetForTests as resetComments } from '../sessions/comments.js';

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
