import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createGroupsRouter, __resetJoinRateLimitForTests } from '../routes/groups.js';
import { createUsersRouter } from '../routes/users.js';

let app: express.Application;
let db: Database.Database;

type Acct = { id: string; api_token: string; handle: string };
let teacher: Acct;
let student1: Acct;
let student2: Acct;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Real-signup helper. This is the whole point of the regression fix: the
// tests must go through the *actual* registration endpoint, so the account
// they exercise has the same role and shape as one a real user would create.
// Any fixture that hand-inserts role='teacher' is exactly what allowed the
// requireTeacher dead-end to ship silently.
async function signup(): Promise<Acct> {
  const res = await request(app)
    .post('/api/users/outsider')
    .send({ password: 'pass1234' });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  const id = res.body.id as string;
  const handle = res.body.handle as string;
  const row = db.prepare('SELECT api_token FROM users WHERE id = ?').get(id) as { api_token: string };
  return { id, api_token: row.api_token, handle };
}

beforeAll(() => {
  app = express();
  app.use(cors());
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/api/users', createUsersRouter(true));
  app.use('/api/groups', createGroupsRouter());
});

beforeEach(async () => {
  __resetJoinRateLimitForTests();
  db = createTestDb();
  // All three accounts are minted through the real signup endpoint — no
  // hand-inserted role='teacher' rows, no fixture shortcuts. Any account
  // can create groups now; "teacher" is just a variable name pointing at
  // the account that owns the group in these tests.
  teacher = await signup();
  student1 = await signup();
  student2 = await signup();
});

afterAll(() => {
  if (db) db.close();
  closeTestDb();
});

describe('Groups API — regression proof: real signup can use the group flow end-to-end', () => {
  it('a freshly signed-up account can create a group + start session + read its own snapshot', async () => {
    // This is the exact path that was silently broken by requireTeacher after
    // 92abf57. If any of these fails with 403, the regression has recurred.
    const create = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'RG' });
    expect(create.status).toBe(201);
    const groupId = create.body.id as string;

    const startSession = await request(app).post(`/api/groups/${groupId}/session/start`).set(auth(teacher.api_token));
    expect(startSession.status).toBe(201);
    const token = startSession.body.token as string;

    const snap = await request(app).get(`/api/groups/${groupId}/snapshot?token=${token}`).set(auth(teacher.api_token));
    expect(snap.status).toBe(200);
    expect(Array.isArray(snap.body.members)).toBe(true);
  });

  it('a fresh signup does NOT get 403 on any of the previously teacher-gated endpoints', async () => {
    // Explicit negative — the specific failure mode that shipped in 92abf57.
    const responses = [
      await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'X' }),
      await request(app).get('/api/groups').set(auth(teacher.api_token)),
    ];
    for (const r of responses) expect(r.status).not.toBe(403);
  });
});

describe('Groups API', () => {
  describe('POST /api/groups', () => {
    it('any authenticated account can create a group', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set(auth(teacher.api_token))
        .send({ name: 'Class A' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Class A');
      expect(res.body.teacher_id).toBe(teacher.id);
      expect(res.body.member_count).toBe(0);
    });

    it('rejects empty name', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('rejects 4th active group with cap_groups_reached', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: `G${i}` });
      }
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G4' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('cap_groups_reached');
      expect(res.body.limit).toBe(3);
    });

    it('archiving a group frees a slot', async () => {
      const created: string[] = [];
      for (let i = 0; i < 3; i++) {
        const r = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: `G${i}` });
        created.push(r.body.id);
      }
      await request(app).patch(`/api/groups/${created[0]}`).set(auth(teacher.api_token)).send({ archived: true });
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G3' });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/groups', () => {
    it('returns the caller\'s own groups with member count', async () => {
      await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G2' });
      const res = await request(app).get('/api/groups').set(auth(teacher.api_token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('member_count');
    });

    it('another account sees only their own groups, not the caller\'s', async () => {
      await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const res = await request(app).get('/api/groups').set(auth(student1.api_token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/groups/:id/invite', () => {
    let groupId: string;

    beforeEach(async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      groupId = res.body.id;
    });

    it('creator can invite another user by handle', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(teacher.api_token))
        .send({ username: student1.handle });
      expect(res.status).toBe(201);
      expect(res.body.student_id).toBe(student1.id);
    });

    it('returns 404 for unknown handle', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(teacher.api_token))
        .send({ username: 'nobody-here' });
      expect(res.status).toBe(404);
    });

    it('returns 409 on duplicate invite', async () => {
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.handle });
      const res = await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.handle });
      expect(res.status).toBe(409);
    });

    it('a non-owner cannot invite into someone else\'s group', async () => {
      const res = await request(app)
        .post(`/api/groups/${groupId}/invite`)
        .set(auth(student1.api_token))
        .send({ username: student2.handle });
      // Ownership check yields 404 (the caller has no group by this id).
      expect(res.status).toBe(404);
    });

    it('rejects 11th member with cap_members_reached', async () => {
      const extras: Acct[] = [];
      for (let i = 0; i < 11; i++) extras.push(await signup());
      for (let i = 0; i < 10; i++) {
        const r = await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: extras[i]!.handle });
        expect(r.status).toBe(201);
      }
      const res = await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: extras[10]!.handle });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('cap_members_reached');
      expect(res.body.limit).toBe(10);
    });
  });

  describe('DELETE /api/groups/:id/members/:userId', () => {
    let groupId: string;

    beforeEach(async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      groupId = res.body.id;
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.handle });
    });

    it('creator can remove a member', async () => {
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
    it('member sees the groups they are in', async () => {
      const res1 = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      await request(app).post(`/api/groups/${res1.body.id}/invite`).set(auth(teacher.api_token)).send({ username: student1.handle });
      const res = await request(app).get('/api/groups/my').set(auth(student1.api_token));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('G1');
    });

    it('returns empty for an account with no group memberships', async () => {
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

    it('joins with valid code', async () => {
      const { code } = await createGroupAndCode();
      const res = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code });
      expect(res.status).toBe(201);
    });

    it('invalid code returns 404', async () => {
      const res = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'NOPE99' });
      expect(res.status).toBe(404);
    });

    it('rejects 11th member with cap_members_reached', async () => {
      const { code } = await createGroupAndCode();
      for (let i = 0; i < 11; i++) {
        const u = await signup();
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
      const bad = await request(app).post('/api/groups/join').set(auth(student1.api_token)).send({ code: 'BADCOD' });
      expect(bad.status).toBe(404);
    });
  });

  describe('GET /api/groups/:id/snapshot (time-boxed)', () => {
    let groupId: string;

    async function mintToken(): Promise<string> {
      const r = await request(app).post(`/api/groups/${groupId}/session/start`).set(auth(teacher.api_token));
      return r.body.token as string;
    }

    beforeEach(async () => {
      const r = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      groupId = r.body.id;
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student1.handle });
      await request(app).post(`/api/groups/${groupId}/invite`).set(auth(teacher.api_token)).send({ username: student2.handle });
    });

    it('401 without a session token', async () => {
      const res = await request(app).get(`/api/groups/${groupId}/snapshot`).set(auth(teacher.api_token));
      expect(res.status).toBe(401);
    });

    it('403 when the token is bound to a different group', async () => {
      const r2 = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G2' });
      const otherToken = (await request(app).post(`/api/groups/${r2.body.id}/session/start`).set(auth(teacher.api_token))).body.token;
      const res = await request(app).get(`/api/groups/${groupId}/snapshot?token=${otherToken}`).set(auth(teacher.api_token));
      expect(res.status).toBe(403);
    });

    it('returns members with null files and no student_name when a valid token is presented', async () => {
      const token = await mintToken();
      const res = await request(app).get(`/api/groups/${groupId}/snapshot?token=${token}`).set(auth(teacher.api_token));
      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(2);
      expect(res.body.members[0].files).toBeNull();
      expect(res.body.members[0].project_id).toBeNull();
      expect(res.body.members[0]).not.toHaveProperty('student_name');
      expect(typeof res.body.session_expires_at).toBe('number');
    });

    it('returns latest project files parsed as JSON', async () => {
      const now = Date.now();
      db.prepare(`INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at)
                  VALUES (?, ?, ?, 0, ?, '{}', 'main.py', ?, ?)`)
        .run(uuidv4(), student1.id, 'Old', JSON.stringify({ 'main.py': 'print(1)' }), now - 1000, now - 1000);
      db.prepare(`INSERT INTO projects (id, user_id, name, is_public, files, assets, current_file, created_at, updated_at)
                  VALUES (?, ?, ?, 0, ?, '{}', 'main.py', ?, ?)`)
        .run(uuidv4(), student1.id, 'New', JSON.stringify({ 'main.py': 'print(2)' }), now, now);
      const token = await mintToken();
      const res = await request(app).get(`/api/groups/${groupId}/snapshot?token=${token}`).set(auth(teacher.api_token));
      expect(res.status).toBe(200);
      const alice = res.body.members.find((m: { student_id: string }) => m.student_id === student1.id);
      expect(alice.project_name).toBe('New');
      expect(alice.files['main.py']).toBe('print(2)');
    });

    it('a different account that does not own the group gets 404', async () => {
      // Ownership check (not role check) is the gate. The other account is
      // a fully valid, freshly signed-up user — the only reason they can't
      // read the snapshot is they don't own this group.
      const outsider = await signup();
      const res = await request(app).get(`/api/groups/${groupId}/snapshot?token=whatever`).set(auth(outsider.api_token));
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('creator can delete their group', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const del = await request(app).delete(`/api/groups/${res.body.id}`).set(auth(teacher.api_token));
      expect(del.status).toBe(204);
    });

    it('deleting group removes members', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const gId = res.body.id;
      await request(app).post(`/api/groups/${gId}/invite`).set(auth(teacher.api_token)).send({ username: student1.handle });
      await request(app).delete(`/api/groups/${gId}`).set(auth(teacher.api_token));
      const members = db.prepare('SELECT id FROM group_members WHERE group_id = ?').all(gId);
      expect(members).toHaveLength(0);
    });

    it('a non-owner cannot delete someone else\'s group', async () => {
      const res = await request(app).post('/api/groups').set(auth(teacher.api_token)).send({ name: 'G1' });
      const del = await request(app).delete(`/api/groups/${res.body.id}`).set(auth(student1.api_token));
      // Ownership check: caller doesn't own this group → 404.
      expect(del.status).toBe(404);
    });
  });
});
