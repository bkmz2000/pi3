import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import projectsRouter from '../routes/projects.js';
import { createHelpRequestsRouter } from '../routes/help-requests.js';

let app: express.Application;
let db: Database.Database;

let teacher: { id: string; api_token: string; name: string };
let student: { id: string; api_token: string; name: string };
let projectId: string;
let groupId: string;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/projects', projectsRouter);
  app.use('/api/help-requests', createHelpRequestsRouter());
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
    .run(projectId, student.id, 'My Project', 0, '{}', '{}', 'main.py', now, now);

  groupId = uuidv4();
  db.prepare('INSERT INTO groups (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)')
    .run(groupId, teacher.id, 'Class A', now);
  db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), groupId, student.id, now);
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

async function shareWithTeacher() {
  const shareId = uuidv4();
  const now = Date.now();
  db.prepare('INSERT INTO project_shares (id, project_id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(shareId, projectId, teacher.id, 'viewer', now, now);
}

describe('Teacher Share Status', () => {
  it('GET /api/projects/:id/teacher-share returns not shared for unshared project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/teacher-share`)
      .set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.shared).toBe(false);
    expect(res.body.teachers).toHaveLength(0);
    expect(res.body.help_request).toBeNull();
  });

  it('GET /api/projects/:id/teacher-share returns shared after sharing', async () => {
    await shareWithTeacher();
    const res = await request(app)
      .get(`/api/projects/${projectId}/teacher-share`)
      .set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.shared).toBe(true);
    expect(res.body.teachers).toHaveLength(1);
    expect(res.body.teachers[0].name).toBe(teacher.name);
  });

  it('teacher cannot get teacher-share status (not owner)', async () => {
    await shareWithTeacher();
    const res = await request(app)
      .get(`/api/projects/${projectId}/teacher-share`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(403);
  });
});

describe('Help Requests', () => {
  beforeEach(async () => {
    await shareWithTeacher();
  });

  it('student can create a help request', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/help-request`)
      .set(auth(student.api_token));
    expect(res.status).toBe(201);
    expect(res.body.help_request.status).toBe('pending');
  });

  it('toggling again cancels the request', async () => {
    await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .post(`/api/projects/${projectId}/help-request`)
      .set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.help_request.status).toBe('cancelled');
  });

  it('help request shows in teacher-share status', async () => {
    await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .get(`/api/projects/${projectId}/teacher-share`)
      .set(auth(student.api_token));
    expect(res.body.help_request).not.toBeNull();
    expect(res.body.help_request.status).toBe('pending');
  });

  it('teacher can list pending help requests', async () => {
    await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .get('/api/help-requests')
      .set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].student_name).toBe(student.name);
    expect(res.body[0].project_name).toBe('My Project');
  });

  it('teacher can address a help request', async () => {
    const createRes = await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const hrId = createRes.body.help_request.id;
    const res = await request(app)
      .patch(`/api/help-requests/${hrId}`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('addressed');
    // Should no longer appear in list
    const listRes = await request(app).get('/api/help-requests').set(auth(teacher.api_token));
    expect(listRes.body).toHaveLength(0);
  });

  it('cannot create help request without teacher share', async () => {
    db.prepare('DELETE FROM project_shares WHERE project_id = ?').run(projectId);
    const res = await request(app)
      .post(`/api/projects/${projectId}/help-request`)
      .set(auth(student.api_token));
    expect(res.status).toBe(400);
  });

  it('cannot create help request without group membership', async () => {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    const res = await request(app)
      .post(`/api/projects/${projectId}/help-request`)
      .set(auth(student.api_token));
    expect(res.status).toBe(400);
  });

  it('GET /api/projects/shared-with-me shows shared projects for teacher with group membership', async () => {
    const res = await request(app)
      .get('/api/projects/shared-with-me')
      .set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].student_name).toBe(student.name);
    expect(res.body[0].group_name).toBe('Class A');
  });

  it('GET /api/projects/shared-with-me excludes projects outside teacher group', async () => {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    const res = await request(app)
      .get('/api/projects/shared-with-me')
      .set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('shared-with-me shows help request indicator', async () => {
    await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .get('/api/projects/shared-with-me')
      .set(auth(teacher.api_token));
    expect(res.body[0].help_request_status).toBe('pending');
  });

  it('non-teacher gets 403 on GET /api/help-requests', async () => {
    const res = await request(app)
      .get('/api/help-requests')
      .set(auth(student.api_token));
    expect(res.status).toBe(403);
  });

  it('teacher list can filter by group_id', async () => {
    await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .get(`/api/help-requests?group_id=${groupId}`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('non-teacher gets 403 on PATCH', async () => {
    const cr = await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .patch(`/api/help-requests/${cr.body.help_request.id}`)
      .set(auth(student.api_token));
    expect(res.status).toBe(403);
  });

  it('PATCH rejects invalid status', async () => {
    const cr = await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .patch(`/api/help-requests/${cr.body.help_request.id}`)
      .set(auth(teacher.api_token))
      .send({ status: 'nonsense' });
    expect(res.status).toBe(400);
  });

  it('PATCH returns 404 for unknown help request', async () => {
    const res = await request(app)
      .patch(`/api/help-requests/${uuidv4()}`)
      .set(auth(teacher.api_token));
    expect(res.status).toBe(404);
  });

  it('teacher can mark help request in_progress', async () => {
    const cr = await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const res = await request(app)
      .patch(`/api/help-requests/${cr.body.help_request.id}`)
      .set(auth(teacher.api_token))
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('PATCH rejects transition of already-addressed request', async () => {
    const cr = await request(app).post(`/api/projects/${projectId}/help-request`).set(auth(student.api_token));
    const hrId = cr.body.help_request.id;
    await request(app).patch(`/api/help-requests/${hrId}`).set(auth(teacher.api_token));
    const res = await request(app)
      .patch(`/api/help-requests/${hrId}`)
      .set(auth(teacher.api_token))
      .send({ status: 'in_progress' });
    expect(res.status).toBe(400);
  });
});
