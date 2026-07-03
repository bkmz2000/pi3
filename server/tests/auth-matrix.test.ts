import { describe, it, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';

import usersRouter from '../routes/users.js';
import projectsRouter from '../routes/projects.js';

// Tier 1 — foundation regression net.
//
// This file is the authorization matrix the `auth-and-data-isolation` change
// needs as a safety net. Every assertion here locks behavior that is ALREADY
// correct, so it must stay green; the desired-but-not-yet-implemented invariants
// (foundation fixes) are captured as `test.todo` so the scope is visible without
// turning the now-live CI coverage/test gate red. Convert each todo into a real
// assertion in the PR that implements the corresponding fix.

let app: express.Application;
let db: Database.Database;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

interface TestUser { id: string; api_token: string; name: string; role: 'student' | 'teacher'; }

function mkUser(name: string, role: 'student' | 'teacher' = 'student'): TestUser {
  const u: TestUser = {
    id: uuidv4(),
    api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
    name,
    role,
  };
  const now = Date.now();
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(u.id, u.api_token, u.name, u.role, now, now);
  return u;
}

function mkProject(ownerId: string, opts: { isPublic?: boolean } = {}): string {
  const id = uuidv4();
  const now = Date.now();
  db.prepare(
    'INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, ownerId, 'P', opts.isPublic ? 1 : 0, '{"main.py":"print(1)"}', '{}', 'main.py', now, now);
  return id;
}

function share(projectId: string, userId: string, role: 'owner' | 'editor' | 'viewer'): void {
  const now = Date.now();
  db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), projectId, userId, role, now, now);
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use('/api/users', usersRouter);
  app.use('/api/projects', projectsRouter);
});

beforeEach(() => {
  db = createTestDb();
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

// ---------------------------------------------------------------------------
// Project access matrix: (actor × verb) -> status
// ---------------------------------------------------------------------------
describe('project access matrix', () => {
  // actorFor builds a project owned by `owner` and returns the auth header (or
  // none) for the named actor relative to that project.
  type Actor = 'owner' | 'editor' | 'viewer' | 'stranger' | 'unauth';

  function setup(actor: Actor): { projectId: string; headers: Record<string, string> } {
    const owner = mkUser('owner-' + uuidv4().slice(0, 8));
    const projectId = mkProject(owner.id);
    if (actor === 'owner') return { projectId, headers: auth(owner.api_token) };
    if (actor === 'unauth') return { projectId, headers: {} };
    const other = mkUser('other-' + uuidv4().slice(0, 8));
    if (actor === 'editor') share(projectId, other.id, 'editor');
    if (actor === 'viewer') share(projectId, other.id, 'viewer');
    return { projectId, headers: actor === 'stranger' ? auth(other.api_token) : auth(other.api_token) };
  }

  const readCases: Array<[Actor, number]> = [
    ['owner', 200], ['editor', 200], ['viewer', 200], ['stranger', 403], ['unauth', 401],
  ];
  for (const [actor, expected] of readCases) {
    it(`GET /:id — ${actor} -> ${expected}`, async () => {
      const { projectId, headers } = setup(actor);
      const res = await request(app).get(`/api/projects/${projectId}`).set(headers);
      expect(res.status).toBe(expected);
    });
  }

  const metaWriteCases: Array<[Actor, number]> = [
    ['owner', 200], ['editor', 200], ['viewer', 403], ['stranger', 403], ['unauth', 401],
  ];
  for (const [actor, expected] of metaWriteCases) {
    it(`PUT /:id (rename) — ${actor} -> ${expected}`, async () => {
      const { projectId, headers } = setup(actor);
      const res = await request(app).put(`/api/projects/${projectId}`).set(headers).send({ name: 'renamed' });
      expect(res.status).toBe(expected);
    });
  }

  const saveCases: Array<[Actor, number]> = [
    ['owner', 200], ['editor', 200], ['viewer', 403], ['stranger', 403], ['unauth', 401],
  ];
  for (const [actor, expected] of saveCases) {
    it(`PUT /:id/save — ${actor} -> ${expected}`, async () => {
      const { projectId, headers } = setup(actor);
      const res = await request(app).put(`/api/projects/${projectId}/save`).set(headers).send({ files: { 'main.py': 'x' } });
      expect(res.status).toBe(expected);
    });
  }

  const deleteCases: Array<[Actor, number]> = [
    ['editor', 403], ['viewer', 403], ['stranger', 403], ['unauth', 401], ['owner', 204],
  ];
  for (const [actor, expected] of deleteCases) {
    it(`DELETE /:id — ${actor} -> ${expected}`, async () => {
      const { projectId, headers } = setup(actor);
      const res = await request(app).delete(`/api/projects/${projectId}`).set(headers);
      expect(res.status).toBe(expected);
    });
  }

  const shareCases: Array<[Actor, number]> = [
    ['editor', 403], ['viewer', 403], ['stranger', 403], ['owner', 201],
  ];
  for (const [actor, expected] of shareCases) {
    it(`POST /:id/share — ${actor} -> ${expected}`, async () => {
      const { projectId, headers } = setup(actor);
      const target = mkUser('share-target-' + uuidv4().slice(0, 8));
      const res = await request(app).post(`/api/projects/${projectId}/share`).set(headers).send({ username: target.name, role: 'viewer' });
      expect(res.status).toBe(expected);
    });
  }

  it('missing project -> 404 (not 403) for an authenticated user', async () => {
    const u = mkUser('u');
    const res = await request(app).get(`/api/projects/${uuidv4()}`).set(auth(u.api_token));
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// is_public is an owner-only field even for editors with write access
// ---------------------------------------------------------------------------
describe('is_public is owner-only', () => {
  it('editor renaming with is_public=1 does not flip visibility', async () => {
    const owner = mkUser('owner');
    const editor = mkUser('editor');
    const projectId = mkProject(owner.id, { isPublic: false });
    share(projectId, editor.id, 'editor');

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set(auth(editor.api_token))
      .send({ name: 'still-private', is_public: 1 });

    expect(res.status).toBe(200);
    const row = db.prepare('SELECT is_public FROM projects WHERE id = ?').get(projectId) as { is_public: number };
    expect(row.is_public).toBe(0);
  });

  it('owner can flip is_public', async () => {
    const owner = mkUser('owner');
    const projectId = mkProject(owner.id, { isPublic: false });
    await request(app).put(`/api/projects/${projectId}`).set(auth(owner.api_token)).send({ is_public: 1 });
    const row = db.prepare('SELECT is_public FROM projects WHERE id = ?').get(projectId) as { is_public: number };
    expect(row.is_public).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// IDOR / cross-tenant isolation: a stranger must not touch another user's
// private project through ANY verb, and owner-only project sub-actions reject
// non-owners. This is the child-data-isolation regression net.
// ---------------------------------------------------------------------------
describe('IDOR / cross-tenant isolation', () => {
  it('a stranger cannot read, rename, save, or delete another user private project', async () => {
    const owner = mkUser('owner');
    const stranger = mkUser('stranger');
    const projectId = mkProject(owner.id);
    const h = auth(stranger.api_token);

    expect((await request(app).get(`/api/projects/${projectId}`).set(h)).status).toBe(403);
    expect((await request(app).put(`/api/projects/${projectId}`).set(h).send({ name: 'pwned' })).status).toBe(403);
    expect((await request(app).put(`/api/projects/${projectId}/save`).set(h).send({ files: {} })).status).toBe(403);
    expect((await request(app).delete(`/api/projects/${projectId}`).set(h)).status).toBe(403);

    // Side-effect check: nothing was mutated.
    const row = db.prepare('SELECT name, files FROM projects WHERE id = ?').get(projectId) as { name: string; files: string };
    expect(row.name).toBe('P');
    expect(row.files).toBe('{"main.py":"print(1)"}');
  });

  it('only the project owner can toggle a help request or view teacher-share status', async () => {
    const owner = mkUser('owner');
    const stranger = mkUser('stranger');
    const projectId = mkProject(owner.id);
    const h = auth(stranger.api_token);

    expect((await request(app).get(`/api/projects/${projectId}/teacher-share`).set(h)).status).toBe(403);
    expect((await request(app).post(`/api/projects/${projectId}/help-request`).set(h)).status).toBe(403);
  });

  it('a viewer-shared user cannot escalate to write via /save', async () => {
    const owner = mkUser('owner');
    const viewer = mkUser('viewer');
    const projectId = mkProject(owner.id);
    share(projectId, viewer.id, 'viewer');

    const res = await request(app)
      .put(`/api/projects/${projectId}/save`)
      .set(auth(viewer.api_token))
      .send({ files: { 'main.py': 'escalated' } });

    expect(res.status).toBe(403);
    const row = db.prepare('SELECT files FROM projects WHERE id = ?').get(projectId) as { files: string };
    expect(row.files).toBe('{"main.py":"print(1)"}');
  });

  it('removing a share immediately revokes access', async () => {
    const owner = mkUser('owner');
    const friend = mkUser('friend');
    const projectId = mkProject(owner.id);
    share(projectId, friend.id, 'viewer');

    expect((await request(app).get(`/api/projects/${projectId}`).set(auth(friend.api_token))).status).toBe(200);
    await request(app).delete(`/api/projects/${projectId}/share/${friend.id}`).set(auth(owner.api_token));
    expect((await request(app).get(`/api/projects/${projectId}`).set(auth(friend.api_token))).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Comment authorization (current correct behavior)
// ---------------------------------------------------------------------------
describe('comment authorization', () => {
  it('project owner (student) can comment on their own project', async () => {
    const owner = mkUser('student', 'student');
    const projectId = mkProject(owner.id);
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(owner.api_token))
      .send({ file_path: 'main.py', line_number: 1, text: 'nope' });
    expect(res.status).toBe(201);
  });

  it('a shared user can comment; a stranger cannot', async () => {
    const owner = mkUser('student', 'student');
    const teacher = mkUser('teacher', 'teacher');
    const stranger = mkUser('stranger');
    const projectId = mkProject(owner.id);
    share(projectId, teacher.id, 'viewer');

    const ok = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(teacher.api_token))
      .send({ file_path: 'main.py', line_number: 1, text: 'good work' });
    expect(ok.status).toBe(201);

    const denied = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(stranger.api_token))
      .send({ file_path: 'main.py', line_number: 1, text: 'sneaky' });
    expect(denied.status).toBe(403);
  });

  it('only the comment author can delete it', async () => {
    const owner = mkUser('student', 'student');
    const teacherA = mkUser('teacherA', 'teacher');
    const teacherB = mkUser('teacherB', 'teacher');
    const projectId = mkProject(owner.id);
    share(projectId, teacherA.id, 'viewer');
    share(projectId, teacherB.id, 'viewer');

    const created = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(teacherA.api_token))
      .send({ file_path: 'main.py', line_number: 1, text: 'mine' });
    const commentId = (created.body as { id: string }).id;

    expect((await request(app).delete(`/api/projects/${projectId}/comments/${commentId}`).set(auth(teacherB.api_token))).status).toBe(403);
    expect((await request(app).delete(`/api/projects/${projectId}/comments/${commentId}`).set(auth(teacherA.api_token))).status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Pending foundation invariants — NOT yet implemented. These are the test
// tasks owned by `critical-foundation-fixes` / `auth-and-data-isolation`.
// Keep as todo so the gate stays green; convert to real assertions in the PR
// that lands each fix (and bump the server coverage floor in that same PR).
// ---------------------------------------------------------------------------
describe('pending foundation invariants (convert to assertions when implemented)', () => {
  // critical-foundation-fixes: password signup must always create a student;
  // teacher role is OAuth-only. Today server/routes/users.ts:32 honors a
  // client-supplied role:'teacher'.
  test.todo('POST /api/users/outsider ignores client role and always creates a student');

  // auth-and-data-isolation: a share role of "owner" must be rejected. Today
  // server/routes/shares.ts:40 accepts owner/editor/viewer.
  test.todo('POST /api/projects/:id/share rejects role=owner');

  // auth-and-data-isolation: comment authors must be teachers. Today
  // server/routes/comments.ts:62 only checks for a share, not user.role.
  test.todo('POST /api/projects/:id/comments rejects a shared non-teacher author');

  // auth-and-data-isolation: teacher /shared-with-me must be classroom-scoped
  // (only students in a group the teacher owns).
  test.todo('GET /api/projects/shared-with-me is scoped to the teacher classroom');

  // auth-and-data-isolation: GET (403) and /save (404) disagree on the
  // not-authorized response for an existing project; unify the contract.
  test.todo('unauthorized access to an existing project returns a consistent status');
});
