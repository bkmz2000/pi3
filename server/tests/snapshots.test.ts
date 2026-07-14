process.env.RATE_LIMIT_TEST = '0';
// Pin institutional profile — cross-profile snapshot coverage lives in
// profileMatrix.test.ts (public profile strips author_name).
process.env.DEPLOYMENT_PROFILE = 'institutional';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { createTestDb, closeTestDb } from './setup.js';
import { createSnapshotsRouter } from '../routes/snapshots.js';

let app: express.Application;
let db: Database.Database;

let owner: { id: string; api_token: string };
let viewer: { id: string; api_token: string };
let projectId: string;

function auth(t: string) { return { Authorization: `Bearer ${t}` }; }

async function createSnapshot(): Promise<string> {
  const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token)).send({});
  return res.body.share_link;
}

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/snapshots', createSnapshotsRouter());
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();
  owner = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
  viewer = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(owner.id, owner.api_token, 'Alice', 'student', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(viewer.id, viewer.api_token, 'Bob', 'student', now, now);
  projectId = uuidv4();
  db.prepare('INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, owner.id, 'Hello', 0, '{"main.py": "print(1)"}', '{}', 'main.py', now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('snapshots — create + list', () => {
  it('owner creates a snapshot; scan status clean; owner projection returned', async () => {
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token)).send({});
    expect(res.status).toBe(201);
    expect(res.body.share_link).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(res.body.scan_status).toBe('clean');
    expect(res.body.public_status).toBe('unlisted');
    expect(res.body.view_count).toBe(0);
    expect(res.body.fork_count).toBe(0);
  });

  it('non-owner cannot snapshot foreign project', async () => {
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(viewer.api_token)).send({});
    expect(res.status).toBe(403);
  });

  it('flagged content still stored but marked flagged', async () => {
    db.prepare('UPDATE projects SET files = ? WHERE id = ?')
      .run('{"main.py": "# reach me at x@y.co"}', projectId);
    const res = await request(app).post(`/api/snapshots/projects/${projectId}/snapshot`).set(auth(owner.api_token)).send({});
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('flagged');
    expect(res.body.scan_findings.length).toBeGreaterThan(0);
  });
});

describe('snapshots — public read', () => {
  it('public projection strips owner_id and internal state', async () => {
    const link = await createSnapshot();
    const res = await request(app).get(`/api/snapshots/s/${link}`);
    expect(res.status).toBe(200);
    expect(res.body.owner_id).toBeUndefined();
    expect(res.body.scan_status).toBeUndefined();
    expect(res.body.view_count).toBeUndefined();
    expect(res.body.author_name).toBe('Alice');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  it('distinct viewer counted once', async () => {
    const link = await createSnapshot();
    await request(app).get(`/api/snapshots/s/${link}`).set(auth(viewer.api_token));
    await request(app).get(`/api/snapshots/s/${link}`).set(auth(viewer.api_token));
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    expect(mine.body[0].view_count).toBe(1);
  });

  it('owner view does not count', async () => {
    const link = await createSnapshot();
    await request(app).get(`/api/snapshots/s/${link}`).set(auth(owner.api_token));
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    expect(mine.body[0].view_count).toBe(0);
  });
});

describe('snapshots — revoke', () => {
  it('owner revokes → public read returns 410', async () => {
    const link = await createSnapshot();
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    const snapId = mine.body[0].id;
    const rev = await request(app).post(`/api/snapshots/${snapId}/revoke`).set(auth(owner.api_token));
    expect(rev.status).toBe(204);
    const read = await request(app).get(`/api/snapshots/s/${link}`);
    expect(read.status).toBe(410);
  });
});

describe('snapshots — request-public gate', () => {
  it('blocked below threshold', async () => {
    await createSnapshot();
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    const snapId = mine.body[0].id;
    const req1 = await request(app).post(`/api/snapshots/${snapId}/request-public`).set(auth(owner.api_token));
    expect(req1.status).toBe(409);
    expect(req1.body.message).toMatch(/distinct viewers/);
  });
});

describe('snapshots — fork', () => {
  it('viewer forks into own private project; parent fork_count increments', async () => {
    const link = await createSnapshot();
    const forkRes = await request(app).post(`/api/snapshots/s/${link}/fork`).set(auth(viewer.api_token)).send({});
    expect(forkRes.status).toBe(201);
    expect(forkRes.body.project_id).toBeDefined();
    expect(forkRes.body.forked_from.share_link).toBe(link);
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    expect(mine.body[0].fork_count).toBe(1);
  });

  it('cannot fork a revoked share', async () => {
    const link = await createSnapshot();
    const mine = await request(app).get('/api/snapshots/mine').set(auth(owner.api_token));
    await request(app).post(`/api/snapshots/${mine.body[0].id}/revoke`).set(auth(owner.api_token));
    const forkRes = await request(app).post(`/api/snapshots/s/${link}/fork`).set(auth(viewer.api_token)).send({});
    expect(forkRes.status).toBe(410);
  });
});
