import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createSessionsRouter } from '../routes/sessions.js';
import { issueSessionToken, verifySessionToken, SESSION_TTL_MS } from '../sessions/tokens.js';
import { _resetForTests as resetComments, ALLOWED_EMOJI } from '../sessions/comments.js';

let app: express.Application;
let db: Database.Database;
let starter: { id: string; api_token: string };
let joiner: { id: string; api_token: string };

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/api/sessions', createSessionsRouter());
});

beforeEach(() => {
  db = createTestDb();
  resetComments();
  const now = Date.now();
  starter = { id: uuidv4(), api_token: uuidv4() };
  joiner = { id: uuidv4(), api_token: uuidv4() };
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(starter.id, starter.api_token, 'Alice', 'student', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(joiner.id, joiner.api_token, 'Bob', 'student', now, now);
});

afterEach(() => {
  closeTestDb();
});

describe('sessions/tokens (unit)', () => {
  it('issues a token that verifies for its starter as role=starter', () => {
    const { token, payload } = issueSessionToken(starter.id);
    const verified = verifySessionToken(token, starter.id);
    expect(verified).not.toBeNull();
    expect(verified!.sid).toBe(payload.sid);
    expect(verified!.starterId).toBe(starter.id);
    expect(verified!.role).toBe('starter');
  });

  it('issues a token that verifies for a joiner as role=joiner', () => {
    const { token } = issueSessionToken(starter.id);
    const verified = verifySessionToken(token, joiner.id);
    expect(verified).not.toBeNull();
    expect(verified!.role).toBe('joiner');
  });

  it('rejects a tampered payload', () => {
    const { token } = issueSessionToken(starter.id);
    const [body, sig] = token.split('.');
    // Flip a byte in the payload; signature must no longer match.
    const tampered = body.slice(0, -1) + (body.slice(-1) === 'A' ? 'B' : 'A');
    expect(verifySessionToken(`${tampered}.${sig}`, starter.id)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const { token } = issueSessionToken(starter.id);
    const [body, sig] = token.split('.');
    // Flip a byte in the middle so the base64url still decodes to the same
    // length but a different bit pattern than the HMAC output.
    const mid = Math.floor(sig.length / 2);
    const ch = sig[mid];
    const flipped = ch === 'A' ? 'B' : 'A';
    const tampered = sig.slice(0, mid) + flipped + sig.slice(mid + 1);
    expect(verifySessionToken(`${body}.${tampered}`, starter.id)).toBeNull();
  });

  it('rejects an expired token', () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1000;
    const { token } = issueSessionToken(starter.id, issuedAt);
    expect(verifySessionToken(token, starter.id)).toBeNull();
  });

  it('accepts a token issued 1h ago (within TTL)', () => {
    const issuedAt = Date.now() - 60 * 60 * 1000;
    const { token } = issueSessionToken(starter.id, issuedAt);
    expect(verifySessionToken(token, starter.id)).not.toBeNull();
  });

  it('rejects garbage input', () => {
    expect(verifySessionToken('', starter.id)).toBeNull();
    expect(verifySessionToken('no-dot-here', starter.id)).toBeNull();
    expect(verifySessionToken('a.b', starter.id)).toBeNull();
  });
});

describe('POST /api/sessions/start', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/sessions/start');
    expect(res.status).toBe(401);
  });

  it('returns token + session_id + expires_at when authed', async () => {
    const res = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    expect(res.status).toBe(201);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.session_id).toBe('string');
    expect(typeof res.body.expires_at).toBe('number');
    expect(res.body.expires_at).toBeGreaterThan(Date.now());
    expect(res.body.expires_at).toBeLessThanOrEqual(Date.now() + SESSION_TTL_MS + 5000);
  });
});

describe('POST /api/sessions/join', () => {
  it('401 without auth', async () => {
    const res = await request(app).post('/api/sessions/join').send({ token: 'anything' });
    expect(res.status).toBe(401);
  });

  it('400 when token is missing', async () => {
    const res = await request(app).post('/api/sessions/join').set(auth(joiner.api_token)).send({});
    expect(res.status).toBe(400);
  });

  it('401 when the token is invalid', async () => {
    const res = await request(app).post('/api/sessions/join')
      .set(auth(joiner.api_token))
      .send({ token: 'clearly-not-a-real-token.sig' });
    expect(res.status).toBe(401);
  });

  it('joins a live session and reports role=joiner for a non-starter', async () => {
    const start = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    const join = await request(app).post('/api/sessions/join')
      .set(auth(joiner.api_token))
      .send({ token: start.body.token });
    expect(join.status).toBe(200);
    expect(join.body.session_id).toBe(start.body.session_id);
    expect(join.body.starter_id).toBe(starter.id);
    expect(join.body.role).toBe('joiner');
  });

  it('reports role=starter when the starter presents their own token', async () => {
    const start = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    const join = await request(app).post('/api/sessions/join')
      .set(auth(starter.api_token))
      .send({ token: start.body.token });
    expect(join.status).toBe(200);
    expect(join.body.role).toBe('starter');
  });

  it('rejects an expired token at the endpoint boundary', async () => {
    // Issue directly with a stale iat, then hit the endpoint.
    const { token } = issueSessionToken(starter.id, Date.now() - SESSION_TTL_MS - 5000);
    const res = await request(app).post('/api/sessions/join')
      .set(auth(joiner.api_token))
      .send({ token });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/sessions/allowed-emoji', () => {
  it('returns the whitelist without auth (public config)', async () => {
    const res = await request(app).get('/api/sessions/allowed-emoji').set(auth(starter.api_token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.allowed)).toBe(true);
    expect(res.body.allowed).toEqual([...ALLOWED_EMOJI]);
  });
});

describe('POST /api/sessions/:sid/comments', () => {
  async function startedSession() {
    const res = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    return { token: res.body.token as string, sid: res.body.session_id as string };
  }

  it('accepts a whitelisted emoji from a valid session member', async () => {
    const { token, sid } = await startedSession();
    const res = await request(app).post(`/api/sessions/${sid}/comments`)
      .set(auth(joiner.api_token))
      .send({ token, emoji: '👍', target: 'main.py:12' });
    expect(res.status).toBe(201);
    expect(res.body.emoji).toBe('👍');
    expect(res.body.author_id).toBe(joiner.id);
    expect(res.body.target).toBe('main.py:12');
  });

  it('rejects free text', async () => {
    const { token, sid } = await startedSession();
    const res = await request(app).post(`/api/sessions/${sid}/comments`)
      .set(auth(joiner.api_token))
      .send({ token, emoji: 'nice try, kid' });
    expect(res.status).toBe(400);
  });

  it('rejects an emoji not in the whitelist', async () => {
    const { token, sid } = await startedSession();
    const res = await request(app).post(`/api/sessions/${sid}/comments`)
      .set(auth(joiner.api_token))
      .send({ token, emoji: '🍕' });
    expect(res.status).toBe(400);
  });

  it('rejects when token belongs to a different session', async () => {
    const other = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    const { sid } = await startedSession();
    const res = await request(app).post(`/api/sessions/${sid}/comments`)
      .set(auth(joiner.api_token))
      .send({ token: other.body.token, emoji: '👍' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request even with a valid token', async () => {
    const { token, sid } = await startedSession();
    const res = await request(app).post(`/api/sessions/${sid}/comments`)
      .send({ token, emoji: '👍' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/sessions/:sid/comments/list', () => {
  it('lists comments to any session member', async () => {
    const start = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    const token = start.body.token as string;
    const sid = start.body.session_id as string;
    await request(app).post(`/api/sessions/${sid}/comments`)
      .set(auth(joiner.api_token)).send({ token, emoji: '👍' });
    await request(app).post(`/api/sessions/${sid}/comments`)
      .set(auth(starter.api_token)).send({ token, emoji: '🔥' });
    const res = await request(app).post(`/api/sessions/${sid}/comments/list`)
      .set(auth(joiner.api_token)).send({ token });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((c: { emoji: string }) => c.emoji)).toEqual(['👍', '🔥']);
  });

  it('rejects a token for a different session', async () => {
    const s1 = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    const s2 = await request(app).post('/api/sessions/start').set(auth(starter.api_token));
    const res = await request(app).post(`/api/sessions/${s1.body.session_id}/comments/list`)
      .set(auth(joiner.api_token))
      .send({ token: s2.body.token });
    expect(res.status).toBe(403);
  });
});
