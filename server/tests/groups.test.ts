import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createGroupsRouter, __resetJoinRateLimitForTests } from '../routes/groups.js';

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
  __resetJoinRateLimitForTests();
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

    it('rejects 4th group with cap_groups_reached', async () => {
      for (const n of ['G1', 'G2', 'G3']) {
        await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: n });
      }
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G4' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('cap_groups_reached');
      expect(res.body.limit).toBe(3);
    });

    it('archived groups do not count toward cap', async () => {
      const created: string[] = [];
      for (const n of ['G1', 'G2', 'G3']) {
        const r = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: n });
        created.push(r.body.id);
      }
      await request(app).patch(`/api/groups/${created[0]}`).set(auth(teacher.api_token)).send({ archived: true });
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G4' });
      expect(res.status).toBe(201);
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

    it('rejects 11th member with cap_members_reached', async () => {
      const now = Date.now();
      const extras: { id: string; name: string; api_token: string }[] = [];
      for (let i = 0; i < 11; i++) {
        const u = { id: uuidv4(), name: `Extra${i}`, api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
        db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(u.id, u.api_token, u.name, 'student', now, now);
        extras.push(u);
      }
      for (let i = 0; i < 10; i++) {
        const r = await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: extras[i]!.name });
        expect(r.status).toBe(201);
      }
      const res = await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: extras[10]!.name });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('cap_members_reached');
      expect(res.body.limit).toBe(10);
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

  describe('POST /api/groups/join', () => {
    async function createGroupAndCode(): Promise<{ id: string; code: string }> {
      const r = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      return { id: r.body.id, code: r.body.invite_code };
    }

    it('student joins with valid code', async () => {
      const { code } = await createGroupAndCode();
      const res = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code });
      expect(res.status).toBe(201);
    });

    it('invalid code returns 404', async () => {
      const res = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'NOPE99' });
      expect(res.status).toBe(404);
    });

    it('rejects 11th student with cap_members_reached', async () => {
      const { code } = await createGroupAndCode();
      const now = Date.now();
      for (let i = 0; i < 11; i++) {
        const u = { id: uuidv4(), name: `S${i}`, api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
        db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(u.id, u.api_token, u.name, 'student', now, now);
        const res = await request(app).post('/api/groups/join').set(auth(u.api_token)).send({ code });
        if (i < 10) expect(res.status).toBe(201);
        else {
          expect(res.status).toBe(409);
          expect(res.body.code).toBe('cap_members_reached');
        }
      }
    });

    it('rate-limits after 10 invalid attempts within window', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'BADCOD' });
        expect(res.status).toBe(404);
      }
      const res = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'BADCOD' });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('join_rate_limited');
    });

    it('successful join clears failure counter', async () => {
      const { code } = await createGroupAndCode();
      for (let i = 0; i < 9; i++) {
        await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'BADCOD' });
      }
      const good = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code });
      expect(good.status).toBe(201);
      // Fresh bad attempts should not immediately trip 429
      const bad = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'BADCOD' });
      expect(bad.status).toBe(404);
    });
  });

  describe('GET /api/groups/:id/snapshot', () => {
    let groupId: string;

    beforeEach(async () => {
      const r = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      groupId = r.body.id;
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.name });
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student2.name });
    });

    it('returns null files for members with no projects', async () => {
      const res = await request(app).get(`/api/groups/${groupId}/snapshot`).set(auth(teacher.api_token));
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0].files).toBeNull();
      expect(res.body.members[0].project_id).toBeNull();
    });

    it('returns latest project files parsed as JSON', async () => {
      const now = Date.now();
      db.prepare(`INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at)
                  VALUES (?, ?, ?, 0, ?, '{}', 'main.py', ?, ?)`)
        .run(uuidv4(), student1.id, 'Old', JSON.stringify({ 'main.py': 'print(1)' }), now - 1000, now - 1000);
      db.prepare(`INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at)
                  VALUES (?, ?, ?, 0, ?, '{}', 'main.py', ?, ?)`)
        .run(uuidv4(), student1.id, 'New', JSON.stringify({ 'main.py': 'print(2)' }), now, now);
      const res = await request(app).get(`/api/groups/${groupId}/snapshot`).set(auth(teacher.api_token));
      expect(res.status).toBe(200);
      const alice = res.body.members.find((m: { student_id: string }) => m.student_id === student1.id);
      expect(alice.project_name).toBe('New');
      expect(alice.files['main.py']).toBe('print(2)');
    });

    it('rejects a different teacher (authz)', async () => {
      const teacher2 = { id: uuidv4(), name: 'T2', api_token: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '') };
      const now = Date.now();
      db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(teacher2.id, teacher2.api_token, teacher2.name, 'teacher', now, now);
      const res = await request(app).get(`/api/groups/${groupId}/snapshot`).set(auth(teacher2.api_token));
      expect(res.status).toBe(404);
    });

    it('rejects students', async () => {
      const res = await request(app).get(`/api/groups/${groupId}/snapshot`).set(auth(student1.api_token));
      expect(res.status).toBe(403);
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
});
