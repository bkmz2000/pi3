import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createGroupsRouter } from '../routes/groups.js';

let app: express.Application;
let db: Database.Database;

let teacher: { id: string; api_token: string; name: string; role: string };
let student1: { id: string; api_token: string; name: string; role: string };
let student2: { id: string; api_token: string; name: string; role: string };

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/groups', createGroupsRouter());
});

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();

  teacher = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name: 'Teacher', role: 'teacher' };
  student1 = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name: 'Alice', role: 'student' };
  student2 = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name: 'Bob', role: 'student' };

  for (const u of [teacher, student1, student2]) {
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(u.id, u.api_token, u.name, u.role, now, now);
  }
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('Groups API', () => {
  describe('POST /api/groups', () => {
    it('teacher can create a group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set(auth(teacher.api_token))
        .send({ name: 'Class A' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Class A');
      expect(res.body.teacher_id).toBe(teacher.id);
      expect(res.body.member_count).toBe(0);
    });

    it('student cannot create a group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set(auth(student1.api_token))
        .send({ name: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set(auth(teacher.api_token))
        .send({ name: '  ' });
      expect(res.status).toBe(400);
    });

    it('requires auth', async () => {
      const res = await request(app).post('/api/groups').send({ name: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/groups', () => {
    it('returns teacher groups with member count', async () => {
      await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G2' });
      const res = await request(app).get('/api/groups').set(auth(teacher.api_token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('member_count');
    });

    it('student gets 403', async () => {
      const res = await request(app).get('/api/groups').set(auth(student1.api_token));
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/groups/:id/invite', () => {
    let groupId: string;

    beforeEach(async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      groupId = res.body.id;
    });

    it('teacher can invite an existing user', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(teacher.api_token))
        .send({ username: student1.name });
      expect(res.status).toBe(201);
      expect(res.body.student_name).toBe(student1.name);
    });

    it('returns 404 for unknown user', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(teacher.api_token))
        .send({ username: 'nobody' });
      expect(res.status).toBe(404);
    });

    it('returns 409 on duplicate invite', async () => {
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.name });
      const res = await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.name });
      expect(res.status).toBe(409);
    });

    it('student cannot invite', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(student1.api_token))
        .send({ username: student2.name });
      expect(res.status).toBe(403);
    });

    it('cannot invite a teacher (non-student)', async () => {
      const teacher2 = { id: uuidv4(), api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''), name: 'Teacher2', role: 'teacher' };
      db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(teacher2.id, teacher2.api_token, teacher2.name, teacher2.role, Date.now(), Date.now());
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(teacher.api_token))
        .send({ username: teacher2.name });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/groups/:id/members/:userId', () => {
    let groupId: string;

    beforeEach(async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      groupId = res.body.id;
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.name });
    });

    it('teacher can remove a member', async () => {
      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${student1.id}`)
        .set(auth(teacher.api_token));
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-member', async () => {
      const res = await request(app)
        .delete(`/api/groups/${groupId}/members/${student2.id}`)
        .set(auth(teacher.api_token));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/groups/my', () => {
    it('student sees their groups', async () => {
      const res1 = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      await request(app).post(`/api/groups/${res1.body.id}/invite`).set(auth(teacher.api_token)).send({ username: student1.name });
      const res = await request(app).get('/api/groups/my').set(auth(student1.api_token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('G1');
    });

    it('returns empty for student with no groups', async () => {
      const res = await request(app).get('/api/groups/my').set(auth(student1.api_token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('teacher can delete their group', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const del = await request(app).delete(`/api/groups/${res.body.id}`).set(auth(teacher.api_token));
      expect(del.status).toBe(204);
    });

    it('deleting group removes members', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const gId = res.body.id;
      await request(app).post(`/api/groups/${gId}/invite`).set(auth(teacher.api_token)).send({ username: student1.name });
      await request(app).delete(`/api/groups/${gId}`).set(auth(teacher.api_token));
      const members = db.prepare('SELECT id FROM group_members WHERE group_id = ?').all(gId);
      expect(members).toHaveLength(0);
    });

    it('student cannot delete a group', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const del = await request(app).delete(`/api/groups/${res.body.id}`).set(auth(student1.api_token));
      expect(del.status).toBe(403);
    });
  });

  describe('POST /:id/session/start + GET /:id/snapshot', () => {
    it('owner mints token, then snapshot returns member projections', async () => {
      const gres = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const groupId = gres.body.id;
      const code = gres.body.invite_code;
      await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code });

      // Give the member a project so snapshot has something to project
      const now = Date.now();
      db.prepare('INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), student1.id, 'ProjA', 0, '{"main.py": "print(1)"}', '{}', 'main.py', now, now);

      const startRes = await request(app).post(`/api/groups/${groupId}/session/start`).set(auth(teacher.api_token)).send({});
      expect(startRes.status).toBe(201);
      const token = startRes.body.token;

      const snap = await request(app).get(`/api/groups/${groupId}/snapshot?token=${encodeURIComponent(token)}`).set(auth(teacher.api_token));
      expect(snap.status).toBe(200);
      expect(snap.body.group_id).toBe(groupId);
      expect(snap.body.members.length).toBe(1);
      expect(snap.body.members[0].project_name).toBe('ProjA');
      expect(snap.body.members[0].files['main.py']).toContain('print');
      // handle-only projection; no student_name field
      expect(snap.body.members[0].student_name).toBeUndefined();
    });

    it('non-owner cannot start a session', async () => {
      const gres = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const res = await request(app).post(`/api/groups/${gres.body.id}/session/start`).set(auth(student1.api_token)).send({});
      expect(res.status).toBe(404);
    });

    it('snapshot without token returns 401', async () => {
      const gres = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const res = await request(app).get(`/api/groups/${gres.body.id}/snapshot`).set(auth(teacher.api_token));
      expect(res.status).toBe(401);
    });

    it('snapshot rejects token bound to a different group', async () => {
      const g1 = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const g2 = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G2' });
      const start = await request(app).post(`/api/groups/${g1.body.id}/session/start`).set(auth(teacher.api_token)).send({});
      const res = await request(app).get(`/api/groups/${g2.body.id}/snapshot?token=${encodeURIComponent(start.body.token)}`).set(auth(teacher.api_token));
      expect(res.status).toBe(403);
    });
  });
});
