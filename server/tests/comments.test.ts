import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import projectsRouter from '../routes/projects.js';

let app: express.Application;
let db: Database.Database;

let teacher: { id: string; api_token: string; name: string };
let student: { id: string; api_token: string; name: string };
let projectId: string;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/projects', projectsRouter);
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();

  teacher = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name: 'Teacher' };
  student = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name: 'Alice' };

  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(teacher.id, teacher.api_token, teacher.name, 'teacher', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(student.id, student.api_token, student.name, 'student', now, now);

  projectId = uuidv4();
  db.prepare('INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(projectId, student.id, 'My Project', 0, '{"main.py": "x = 1\n"}', '{}', 'main.py', now, now);

  // Share project with teacher
  const shareId = uuidv4();
  db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(shareId, projectId, teacher.id, 'viewer', now, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

async function addComment(overrides: Partial<{
  file_path: string; line_number: number; anchor_text: string; text: string;
}> = {}) {
  return request(app)
    .post(`/api/projects/${projectId}/comments`)
    .set(auth(teacher.api_token))
    .send({
      file_path: 'main.py',
      line_number: 1,
      anchor_text: 'x = 1',
      text: 'Nice work!',
      ...overrides,
    });
}

describe('Comments — create', () => {
  it('teacher can add a comment', async () => {
    const res = await addComment();
    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Nice work!');
    // C2: handle-only projection — no author_name.
    expect(res.body).not.toHaveProperty('author_name');
    expect(res.body.file_path).toBe('main.py');
    expect(res.body.line_number).toBe(1);
  });

  it('student (owner) cannot add a comment', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token))
      .send({ file_path: 'main.py', line_number: 1, anchor_text: '', text: 'Self note' });
    expect(res.status).toBe(403);
  });

  it('any account with viewer share can add a comment (role gate removed under SPP-1)', async () => {
    const now = Date.now();
    const viewerId = uuidv4();
    const viewerToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(viewerId, viewerToken, null, 'student', now, now);
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), projectId, viewerId, 'viewer', now, now);
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .send({ file_path: 'main.py', line_number: 1, anchor_text: '', text: 'Peer review' });
    expect(res.status).toBe(201);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .send({ file_path: 'main.py', line_number: 1, anchor_text: '', text: 'Anon note' });
    expect(res.status).toBe(401);
  });

  it('rejects missing text', async () => {
    const res = await addComment({ text: '' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid line_number', async () => {
    const res = await addComment({ line_number: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects missing file_path', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(teacher.api_token))
      .send({ line_number: 1, anchor_text: '', text: 'hi' });
    expect(res.status).toBe(400);
  });
});

describe('Comments — list', () => {
  it('student (owner) can list all comments for the project', async () => {
    await addComment({ file_path: 'main.py', line_number: 1 });
    await addComment({ file_path: 'helpers.py', line_number: 3, anchor_text: 'def f', text: 'Good' });
    const res = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('teacher (viewer) can list comments', async () => {
    await addComment();
    const res = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('can filter by file via ?file= query param', async () => {
    await addComment({ file_path: 'main.py' });
    await addComment({ file_path: 'helpers.py', anchor_text: 'def f', text: 'Good' });
    const res = await request(app)
      .get(`/api/projects/${projectId}/comments?file=main.py`)
      .set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].file_path).toBe('main.py');
  });

  it('third party cannot list comments', async () => {
    const now = Date.now();
    const otherId = uuidv4();
    const otherToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(otherId, otherToken, 'Other', 'student', now, now);
    const res = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set({ Authorization: `Bearer ${otherToken}` });
    expect(res.status).toBe(403);
  });
});

describe('Comments — delete', () => {
  it('author (teacher) can delete their own comment', async () => {
    const createRes = await addComment();
    const commentId = createRes.body.id;
    const res = await request(app)
      .delete(`/api/projects/${projectId}/comments/${commentId}`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(204);
    const listRes = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token));
    expect(listRes.body).toHaveLength(0);
  });

  it('student cannot delete teacher comment', async () => {
    const createRes = await addComment();
    const commentId = createRes.body.id;
    const res = await request(app)
      .delete(`/api/projects/${projectId}/comments/${commentId}`)
      .set(auth(student.api_token));
    expect(res.status).toBe(403);
  });

  it('deleting non-existent comment returns 404', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/comments/${uuidv4()}`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(404);
  });
});

// ── C1 / C2 / C3 follow-up (audit 2026-07-13) ───────────────────────────────

describe('Comments — SPP-6 content scanner (C1 Option B)', () => {
  it('accepts a clean comment and marks scan_status=clean', async () => {
    const res = await addComment({ text: 'Nice loop!' });
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('clean');
  });

  it('stores (does not block) a comment whose text contains an email — held for review with scan_status=flagged', async () => {
    const res = await addComment({ text: 'ping me at leak@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('flagged');
  });

  it('flags disclosure phrase in anchor_text (both fields scanned)', async () => {
    const res = await addComment({ anchor_text: 'DM me on telegram', text: 'ok' });
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('flagged');
  });
});

describe('Comments — C3 length cap', () => {
  it('rejects text longer than 200 chars', async () => {
    const res = await addComment({ text: 'a'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/200/);
  });

  it('accepts exactly 200 chars', async () => {
    const res = await addComment({ text: 'a'.repeat(200) });
    expect(res.status).toBe(201);
  });

  it('rejects anchor_text longer than 200 chars', async () => {
    const res = await addComment({ anchor_text: 'a'.repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/anchor_text/);
  });
});

describe('Comments — C2 handle-only projection', () => {
  it('POST response omits author_name', async () => {
    const res = await addComment();
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('author_name');
    expect(typeof res.body.author_handle === 'string' || res.body.author_handle === null).toBe(true);
  });

  it('GET response omits author_name across the list', async () => {
    await addComment({ text: 'A' });
    await addComment({ text: 'B' });
    const res = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token));
    expect(res.status).toBe(200);
    for (const row of res.body) {
      expect(row).not.toHaveProperty('author_name');
    }
  });
});

// ── Structural review gate for flagged comments ─────────────────────────────

describe('Comments — flagged comments are structurally held from other viewers', () => {
  it('author sees their own flagged comment; other share-holders do not; a clean-flip releases it', async () => {
    // Author (teacher) posts a comment that gets flagged.
    const post = await addComment({ text: 'ping me at leak@example.com' });
    expect(post.status).toBe(201);
    expect(post.body.scan_status).toBe('flagged');
    const commentId = post.body.id as string;

    // Owner (student) — a different share-holder — must NOT see it.
    const other = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token));
    expect(other.status).toBe(200);
    expect(other.body.some((c: { id: string }) => c.id === commentId)).toBe(false);

    // Author (teacher) sees their own pending row — otherwise the write
    // silently disappears from their view, which is worse UX than the leak.
    const author = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(teacher.api_token));
    expect(author.status).toBe(200);
    expect(author.body.some((c: { id: string }) => c.id === commentId)).toBe(true);

    // Moderator flip: scan_status -> clean. Now the other viewer sees it.
    db.prepare("UPDATE comments SET scan_status = 'clean' WHERE id = ?").run(commentId);
    const afterFlip = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token));
    expect(afterFlip.status).toBe(200);
    expect(afterFlip.body.some((c: { id: string }) => c.id === commentId)).toBe(true);
  });

  it('same rule applies when the ?file= filter is used', async () => {
    const post = await addComment({ text: 'email me at hi@ex.com', file_path: 'main.py' });
    expect(post.body.scan_status).toBe('flagged');
    const commentId = post.body.id as string;

    const other = await request(app)
      .get(`/api/projects/${projectId}/comments?file=main.py`)
      .set(auth(student.api_token));
    expect(other.body.some((c: { id: string }) => c.id === commentId)).toBe(false);
  });

  it('clean comments are visible to all share-holders (regression — filter must not over-apply)', async () => {
    const post = await addComment({ text: 'just fine, no issue' });
    expect(post.body.scan_status).toBe('clean');
    const commentId = post.body.id as string;

    const other = await request(app)
      .get(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token));
    expect(other.body.some((c: { id: string }) => c.id === commentId)).toBe(true);
  });
});
