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
    expect(res.body.author_name).toBe(teacher.name);
    expect(res.body.file_path).toBe('main.py');
    expect(res.body.line_number).toBe(1);
  });

  it('student (owner) can add a comment', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set(auth(student.api_token))
      .send({ file_path: 'main.py', line_number: 1, anchor_text: '', text: 'Self note' });
    expect(res.status).toBe(201);
  });

  it('student with viewer share cannot add a comment (not a teacher)', async () => {
    const now = Date.now();
    const studentViewerId = uuidv4();
    const studentViewerToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(studentViewerId, studentViewerToken, 'StudentViewer', 'student', now, now);
    db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), projectId, studentViewerId, 'viewer', now, now);
    const res = await request(app)
      .post(`/api/projects/${projectId}/comments`)
      .set({ Authorization: `Bearer ${studentViewerToken}` })
      .send({ file_path: 'main.py', line_number: 1, anchor_text: '', text: 'Peer review' });
    expect(res.status).toBe(403);
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

  it('rejects comment with email as flagged (422)', async () => {
    const res = await addComment({ text: 'ping me at hello@example.com' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('content_flagged');
    expect(res.body.findings.some((f: { kind: string }) => f.kind === 'email')).toBe(true);
  });
});
