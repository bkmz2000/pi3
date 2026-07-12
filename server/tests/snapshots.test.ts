import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createSnapshotsRouter } from '../routes/snapshots.js';
import { scanSnapshot } from '../snapshots/scanner.js';

let app: express.Application;
let db: Database.Database;
let owner: { id: string; api_token: string };
let stranger: { id: string; api_token: string };

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function seedProject(userId: string, name = 'Untitled', files: Record<string, string> = { 'main.py': 'print(1)' }): Promise<string> {
  const id = uuidv4();
  const now = Date.now();
  db.prepare(
    `INSERT INTO projects (id, user_id, name, description, is_public, files, assets, current_file, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, name, null, 0, JSON.stringify(files), '{}', 'main.py', now, now);
  return id;
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/api/snapshots', createSnapshotsRouter());
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();
  owner = { id: uuidv4(), api_token: uuidv4() };
  stranger = { id: uuidv4(), api_token: uuidv4() };
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(owner.id, owner.api_token, 'Alice', 'student', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(stranger.id, stranger.api_token, 'Bob', 'student', now, now);
});

afterEach(() => {
  closeTestDb();
});

describe('scanner (unit)', () => {
  it('flags an email in a code comment', () => {
    const r = scanSnapshot({ title: 'ok', files: { 'main.py': '# reach me at foo@example.com' } });
    expect(r.status).toBe('flagged');
    expect(r.findings.some(f => f.kind === 'email')).toBe(true);
  });

  it('flags a phone number in a string literal', () => {
    const r = scanSnapshot({ title: 'ok', files: { 'main.py': 'print("call +1 555 123 4567")' } });
    expect(r.status).toBe('flagged');
    expect(r.findings.some(f => f.kind === 'phone')).toBe(true);
  });

  it('flags a disclosure phrase in the title (not just code)', () => {
    const r = scanSnapshot({ title: 'DM me on telegram!', files: {} });
    expect(r.status).toBe('flagged');
    expect(r.findings.some(f => f.kind === 'disclosure_phrase')).toBe(true);
  });

  it('flags an email in an asset label (assets JSON blob, not carved out)', () => {
    const r = scanSnapshot({
      title: 'ok',
      files: {},
      assets: { sprites: { player: { note: 'from alice@example.org' } } },
    });
    expect(r.status).toBe('flagged');
    expect(r.findings.some(f => f.kind === 'email' && f.where === 'assets')).toBe(true);
  });

  it('reports clean on a plain project', () => {
    const r = scanSnapshot({
      title: 'Snake',
      files: { 'main.py': 'def loop():\n    pass\n' },
    });
    expect(r.status).toBe('clean');
    expect(r.findings).toEqual([]);
  });
});

describe('POST /api/snapshots/projects/:projectId/snapshot', () => {
  it('401 without auth', async () => {
    const projectId = await seedProject(owner.id);
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`);
    expect(res.status).toBe(401);
  });

  it('403 when a non-owner tries to snapshot someone else\'s project', async () => {
    const projectId = await seedProject(owner.id);
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(stranger.api_token));
    expect(res.status).toBe(403);
  });

  it('creates a snapshot for the owner and returns a share_link', async () => {
    const projectId = await seedProject(owner.id, 'MyGame');
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    expect(res.status).toBe(201);
    expect(typeof res.body.share_link).toBe('string');
    expect(res.body.share_link.length).toBeGreaterThan(10);
    expect(res.body.title).toBe('MyGame');
    expect(res.body.scan_status).toBe('clean');
    expect(res.body.owner_id).toBeUndefined(); // even the owner projection omits it — internal-only
  });

  it('marks the snapshot flagged when scanner catches disclosure', async () => {
    const projectId = await seedProject(owner.id, 'MyGame', { 'main.py': '# email: test@test.com' });
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('flagged');
    expect(Array.isArray(res.body.scan_findings)).toBe(true);
    expect(res.body.scan_findings.length).toBeGreaterThan(0);
  });

  it('editing the original project does not mutate the snapshot (immutability)', async () => {
    const projectId = await seedProject(owner.id, 'Before', { 'main.py': 'print("v1")' });
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    // Mutate the original directly, bypassing routes.
    db.prepare('UPDATE projects SET name = ?, files = ? WHERE id = ?').run('After', JSON.stringify({ 'main.py': 'print("v2")' }), projectId);
    const publicRes = await request(app).get(`/api/snapshots/s/${snap.body.share_link}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.title).toBe('Before');
    expect(publicRes.body.files['main.py']).toBe('print("v1")');
  });
});

describe('GET /api/snapshots/s/:shareLink', () => {
  it('never returns owner_id in the public response (P#7)', async () => {
    const projectId = await seedProject(owner.id);
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    const res = await request(app).get(`/api/snapshots/s/${snap.body.share_link}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('owner_id');
    expect(res.body).not.toHaveProperty('id');
    expect(res.body).not.toHaveProperty('scan_status');
    expect(res.body).not.toHaveProperty('view_count');
  });

  it('sets X-Robots-Tag noindex on unlisted snapshot', async () => {
    const projectId = await seedProject(owner.id);
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    const res = await request(app).get(`/api/snapshots/s/${snap.body.share_link}`);
    expect(res.headers['x-robots-tag']).toContain('noindex');
  });

  it('404 for unknown share_link', async () => {
    const res = await request(app).get('/api/snapshots/s/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('410 after revoke', async () => {
    const projectId = await seedProject(owner.id);
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    await request(app).post(`/api/snapshots/${snap.body.id}/revoke`).set(auth(owner.api_token));
    const res = await request(app).get(`/api/snapshots/s/${snap.body.share_link}`);
    expect(res.status).toBe(410);
  });

  it('counts distinct logged-in viewers, not repeat visits by the same account', async () => {
    const projectId = await seedProject(owner.id);
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    // First view by stranger
    await request(app).get(`/api/snapshots/s/${snap.body.share_link}`).set(auth(stranger.api_token));
    // Same stranger visits again — no increment
    await request(app).get(`/api/snapshots/s/${snap.body.share_link}`).set(auth(stranger.api_token));
    // Owner viewing their own snapshot doesn't count
    await request(app).get(`/api/snapshots/s/${snap.body.share_link}`).set(auth(owner.api_token));
    // Anonymous view doesn't count
    await request(app).get(`/api/snapshots/s/${snap.body.share_link}`);
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    expect(mine.body[0].view_count).toBe(1);
  });
});

describe('POST /api/snapshots/:id/revoke', () => {
  it('non-owner cannot revoke', async () => {
    const projectId = await seedProject(owner.id);
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    const res = await request(app).post(`/api/snapshots/${snap.body.id}/revoke`).set(auth(stranger.api_token));
    expect(res.status).toBe(403);
  });

  it('owner can revoke', async () => {
    const projectId = await seedProject(owner.id);
    const snap = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    const res = await request(app).post(`/api/snapshots/${snap.body.id}/revoke`).set(auth(owner.api_token));
    expect(res.status).toBe(204);
  });
});

describe('POST /api/snapshots/:id/request-public (Phase 7 gate)', () => {
  async function makeSnapshot(files: Record<string, string> = { 'main.py': 'print(1)' }): Promise<{ id: string; share_link: string }> {
    const projectId = await seedProject(owner.id, 'X', files);
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token));
    return { id: res.body.id, share_link: res.body.share_link };
  }

  async function bumpViews(shareLink: string, n: number): Promise<void> {
    // Create n distinct viewer accounts and view once each.
    for (let i = 0; i < n; i++) {
      const u = { id: uuidv4(), api_token: uuidv4() };
      db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(u.id, u.api_token, `V${i}`, 'student', Date.now(), Date.now());
      await request(app).get(`/api/snapshots/s/${shareLink}`).set(auth(u.api_token));
    }
  }

  it('rejects when scan_status is flagged (regardless of views)', async () => {
    const s = await makeSnapshot({ 'main.py': '# my telegram: nope' });
    await bumpViews(s.share_link, 10);
    const res = await request(app).post(`/api/snapshots/${s.id}/request-public`).set(auth(owner.api_token));
    expect(res.status).toBe(409);
  });

  it('rejects when view_count is below threshold', async () => {
    const s = await makeSnapshot();
    await bumpViews(s.share_link, 2);
    const res = await request(app).post(`/api/snapshots/${s.id}/request-public`).set(auth(owner.api_token));
    expect(res.status).toBe(409);
  });

  it('accepts when clean + threshold met', async () => {
    const s = await makeSnapshot();
    await bumpViews(s.share_link, 5);
    const res = await request(app).post(`/api/snapshots/${s.id}/request-public`).set(auth(owner.api_token));
    expect(res.status).toBe(204);
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    expect(mine.body[0].public_status).toBe('requested');
  });

  it('rejects when revoked', async () => {
    const s = await makeSnapshot();
    await bumpViews(s.share_link, 5);
    await request(app).post(`/api/snapshots/${s.id}/revoke`).set(auth(owner.api_token));
    const res = await request(app).post(`/api/snapshots/${s.id}/request-public`).set(auth(owner.api_token));
    expect(res.status).toBe(409);
  });
});
