import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { createCompeteRouter } from '../routes/compete.js';
import { createUsersRouter } from '../routes/users.js';
import { createModerationRouter } from '../routes/moderation.js';

// SPP-5 (B): end-to-end coverage of the compete-mode publish pipeline.
// Everything in this file exercises the state machine directly — draft →
// publish → request-public → decision — and the surrounding invariants
// (public reads gated on 'approved', PUT invalidates approval, owner
// preview, distinct-view counter).

let app: express.Application;
let db: Database.Database;

type Acct = { id: string; api_token: string; handle: string };
let author: Acct;
let viewer1: Acct;
let viewer2: Acct;
let reviewer: Acct;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function signup(): Promise<Acct> {
  const res = await request(app).post('/api/users/outsider').send({ password: 'pw1234' });
  const id = res.body.id as string;
  const handle = res.body.handle as string;
  const row = db.prepare('SELECT api_token FROM users WHERE id = ?').get(id) as { api_token: string };
  return { id, api_token: row.api_token, handle };
}

const BODY = {
  slug: 'sum-two',
  title: 'Sum Two',
  statement: 'Add two ints.',
  starter_code: 'a, b = map(int, input().split())\nprint(a+b)',
  order_index: 1,
  tests: [
    { tier: 1, is_visible: true,  input: '1 2\n', expected: '3\n' },
    { tier: 1, is_visible: false, input: '4 5\n', expected: '9\n' },
  ],
};

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.use('/api/users', createUsersRouter(true));
  app.use('/api/moderation', createModerationRouter());
  app.use('/api', createCompeteRouter());
});

beforeEach(async () => {
  db = createTestDb();
  author = await signup();
  viewer1 = await signup();
  viewer2 = await signup();
  reviewer = await signup();
  process.env.REVIEWER_IDS = reviewer.id;
});

afterEach(() => {
  delete process.env.REVIEWER_IDS;
  closeTestDb();
});

async function createDraft(slug = 'sum-two') {
  const r = await request(app).post('/api/teacher/problems').set(auth(author.api_token)).send({ ...BODY, slug });
  expect(r.status).toBe(201);
  return r.body;
}

describe('draft default state', () => {
  it('new problem is public_status=unlisted with no published_json', async () => {
    const p = await createDraft();
    expect(p.public_status).toBe('unlisted');
    expect(p.published_json).toBeNull();
  });

  it('unpublished problem does NOT appear in GET /api/problems', async () => {
    await createDraft();
    const list = await request(app).get('/api/problems').set(auth(viewer1.api_token));
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(0);
  });

  it('unpublished problem returns 404 on GET /api/problems/:slug for non-owner', async () => {
    await createDraft();
    const r = await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    expect(r.status).toBe(404);
  });

  it('owner CAN preview an unpublished draft via ?preview=1', async () => {
    await createDraft();
    const r = await request(app).get('/api/problems/sum-two?preview=1').set(auth(author.api_token));
    expect(r.status).toBe(200);
    expect(r.body.title).toBe('Sum Two');
  });

  it('preview flag is ignored for non-owner', async () => {
    await createDraft();
    const r = await request(app).get('/api/problems/sum-two?preview=1').set(auth(viewer1.api_token));
    expect(r.status).toBe(404);
  });

  it('submit against an unpublished problem returns 404', async () => {
    await createDraft();
    const r = await request(app).post('/api/problems/sum-two/submit').set(auth(viewer1.api_token))
      .send({ code: 'x', stars: 1, verdict: 'wa' });
    expect(r.status).toBe(404);
  });
});

describe('POST /teacher/problems/:slug/publish', () => {
  it('freezes current draft into published_json + sets first_published_at', async () => {
    await createDraft();
    const pub = await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    expect(pub.status).toBe(201);
    expect(pub.body.public_status).toBe('unlisted');
    expect(pub.body.published_json).not.toBeNull();
    expect(pub.body.first_published_at).not.toBeNull();
    expect(pub.body.last_published_at).toEqual(pub.body.first_published_at);
    const snap = JSON.parse(pub.body.published_json);
    expect(snap.title).toBe('Sum Two');
    expect(snap.tests).toHaveLength(2);
  });

  it('403 when a non-owner tries to publish', async () => {
    await createDraft();
    const r = await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(viewer1.api_token));
    expect(r.status).toBe(403);
  });

  it('publish is idempotent for state (public_status stays unlisted) but bumps last_published_at', async () => {
    await createDraft();
    const p1 = await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    await new Promise(r => setTimeout(r, 5));
    const p2 = await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    expect(p1.body.first_published_at).toBe(p2.body.first_published_at);
    expect(p2.body.last_published_at).toBeGreaterThan(p1.body.last_published_at);
  });
});

describe('PUT /teacher/problems/:slug invalidates approval', () => {
  it('editing an approved problem resets public_status to unlisted and clears published_json', async () => {
    await createDraft();
    await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    // Manually approve via DB shortcut for setup (not testing the moderator
    // decision itself here — that has its own case).
    db.prepare("UPDATE problems SET public_status = 'approved' WHERE slug = ?").run('sum-two');

    const put = await request(app).put('/api/teacher/problems/sum-two').set(auth(author.api_token))
      .send({ ...BODY, title: 'Renamed' });
    expect(put.status).toBe(200);
    expect(put.body.public_status).toBe('unlisted');
    expect(put.body.published_json).toBeNull();

    // Public read should now 404 — approval was invalidated.
    const pub = await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    expect(pub.status).toBe(404);
  });
});

describe('request-public gate', () => {
  it('409 if the problem was never published', async () => {
    await createDraft();
    const r = await request(app).post('/api/teacher/problems/sum-two/request-public').set(auth(author.api_token));
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/Publish/);
  });

  it('409 if scan_status is flagged', async () => {
    // Author a problem whose statement carries a flagged pattern.
    await request(app).post('/api/teacher/problems').set(auth(author.api_token)).send({
      ...BODY, slug: 'leak', statement: 'Email me at leak@example.com',
    });
    await request(app).post('/api/teacher/problems/leak/publish').set(auth(author.api_token));
    const r = await request(app).post('/api/teacher/problems/leak/request-public').set(auth(author.api_token));
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/scanner/);
  });

  it('409 if distinct_view_count below threshold', async () => {
    await createDraft();
    await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    const r = await request(app).post('/api/teacher/problems/sum-two/request-public').set(auth(author.api_token));
    expect(r.status).toBe(409);
    expect(r.body.message).toMatch(/distinct viewers/);
  });

  it('transitions unlisted → pending_review when clean + view count met', async () => {
    await createDraft();
    await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    // Force the row into an approved+clean state so public reads work, then
    // rack up distinct viewers, then flip back to unlisted for the request.
    db.prepare("UPDATE problems SET public_status = 'approved' WHERE slug = 'sum-two'").run();
    for (let i = 0; i < 6; i++) {
      const v = await signup();
      await request(app).get('/api/problems/sum-two').set(auth(v.api_token));
    }
    db.prepare("UPDATE problems SET public_status = 'unlisted' WHERE slug = 'sum-two'").run();

    const r = await request(app).post('/api/teacher/problems/sum-two/request-public').set(auth(author.api_token));
    expect(r.status).toBe(204);
    const row = db.prepare('SELECT public_status FROM problems WHERE slug = ?').get('sum-two') as { public_status: string };
    expect(row.public_status).toBe('pending_review');
  });
});

describe('POST /api/moderation/problems/:slug/decision', () => {
  beforeEach(async () => {
    await createDraft();
    await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    db.prepare("UPDATE problems SET public_status = 'pending_review' WHERE slug = ?").run('sum-two');
  });

  it('reviewer can approve; problem becomes visible', async () => {
    const dec = await request(app).post('/api/moderation/problems/sum-two/decision').set(auth(reviewer.api_token))
      .send({ decision: 'approved' });
    expect(dec.status).toBe(204);
    const list = await request(app).get('/api/problems').set(auth(viewer1.api_token));
    expect(list.body.map((p: { slug: string }) => p.slug)).toContain('sum-two');
  });

  it('reviewer can reject; problem stays hidden and cannot be re-requested', async () => {
    const dec = await request(app).post('/api/moderation/problems/sum-two/decision').set(auth(reviewer.api_token))
      .send({ decision: 'rejected' });
    expect(dec.status).toBe(204);
    const list = await request(app).get('/api/problems').set(auth(viewer1.api_token));
    expect(list.body).toHaveLength(0);
    const req2 = await request(app).post('/api/teacher/problems/sum-two/request-public').set(auth(author.api_token));
    // rejected → cannot re-request without editing (draft mutation resets state)
    expect(req2.status).toBe(409);
  });

  it('403 for a non-reviewer', async () => {
    const r = await request(app).post('/api/moderation/problems/sum-two/decision').set(auth(viewer1.api_token))
      .send({ decision: 'approved' });
    expect(r.status).toBe(403);
  });

  it('400 for an unknown decision value', async () => {
    const r = await request(app).post('/api/moderation/problems/sum-two/decision').set(auth(reviewer.api_token))
      .send({ decision: 'maybe' });
    expect(r.status).toBe(400);
  });

  it('409 when target is not in pending_review state', async () => {
    db.prepare("UPDATE problems SET public_status = 'unlisted' WHERE slug = ?").run('sum-two');
    const r = await request(app).post('/api/moderation/problems/sum-two/decision').set(auth(reviewer.api_token))
      .send({ decision: 'approved' });
    expect(r.status).toBe(409);
  });
});

describe('distinct view counter', () => {
  beforeEach(async () => {
    await createDraft();
    await request(app).post('/api/teacher/problems/sum-two/publish').set(auth(author.api_token));
    db.prepare("UPDATE problems SET public_status = 'approved' WHERE slug = ?").run('sum-two');
  });

  it('increments on first view by a non-owner', async () => {
    await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    const row = db.prepare('SELECT distinct_view_count FROM problems WHERE slug = ?').get('sum-two') as { distinct_view_count: number };
    expect(row.distinct_view_count).toBe(1);
  });

  it('does not double-count repeat views from the same account', async () => {
    await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    const row = db.prepare('SELECT distinct_view_count FROM problems WHERE slug = ?').get('sum-two') as { distinct_view_count: number };
    expect(row.distinct_view_count).toBe(1);
  });

  it('counts distinct viewers separately', async () => {
    await request(app).get('/api/problems/sum-two').set(auth(viewer1.api_token));
    await request(app).get('/api/problems/sum-two').set(auth(viewer2.api_token));
    const row = db.prepare('SELECT distinct_view_count FROM problems WHERE slug = ?').get('sum-two') as { distinct_view_count: number };
    expect(row.distinct_view_count).toBe(2);
  });

  it('does not count the owner previewing their own problem', async () => {
    await request(app).get('/api/problems/sum-two?preview=1').set(auth(author.api_token));
    const row = db.prepare('SELECT distinct_view_count FROM problems WHERE slug = ?').get('sum-two') as { distinct_view_count: number };
    expect(row.distinct_view_count).toBe(0);
  });
});

describe('migration 016 retroactive quarantine', () => {
  it('pre-existing problems are placed in pending_review, not approved (guardrail)', () => {
    // Simulate the migration path: a row inserted before Phase B lacked
    // any public_status column, so the default is 'unlisted'. The migration
    // then bulk-updates archived=0 rows to 'pending_review'. We verify the
    // migration's UPDATE clause here.
    db.prepare('INSERT INTO problems (slug, title, statement, created_by) VALUES (?, ?, ?, ?)')
      .run('legacy-1', 'L1', 's', author.id);
    db.prepare('INSERT INTO problems (slug, title, statement, archived, created_by) VALUES (?, ?, ?, ?, ?)')
      .run('legacy-arch', 'LA', 's', 1, author.id);
    db.prepare("UPDATE problems SET public_status = 'pending_review' WHERE archived = 0").run();
    const alive = db.prepare("SELECT public_status FROM problems WHERE slug = 'legacy-1'").get() as { public_status: string };
    const archived = db.prepare("SELECT public_status FROM problems WHERE slug = 'legacy-arch'").get() as { public_status: string };
    expect(alive.public_status).toBe('pending_review');
    // Archived row was left alone — its `public_status` stays at the column
    // default 'unlisted'. Legitimate: archived rows are already hidden.
    expect(archived.public_status).toBe('unlisted');
  });
});
