import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { v4 as uuidv4 } from 'uuid';
import { createCompeteRouter } from '../routes/compete.js';
import { createUsersRouter } from '../routes/users.js';

let app: express.Application;
let db: Database.Database;
let student: { id: string; api_token: string };
let teacher: { id: string; api_token: string };

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

const SAMPLE_TESTS = [
  { tier: 1, is_visible: true,  input: '1 2\n', expected: '3\n' },
  { tier: 1, is_visible: false, input: '5 5\n', expected: '10\n' },
  { tier: 2, is_visible: false, input: '100 200\n', expected: '300\n' },
];

const PROBLEM_BODY = {
  slug: 'sum-two',
  title: 'Sum Two Numbers',
  statement: '## Task\nGiven two numbers, print their sum.',
  starter_code: 'a, b = map(int, input().split())\nprint(a + b)',
  order_index: 1,
  tests: SAMPLE_TESTS,
};

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use('/api/users', createUsersRouter(true));
  app.use('/api', createCompeteRouter());
});

// Real-signup helper for the regression proof. No fixture shortcuts.
async function signup(): Promise<{ id: string; api_token: string; handle: string }> {
  const res = await request(app).post('/api/users/outsider').send({ password: 'pw1234' });
  const id = res.body.id as string;
  const handle = res.body.handle as string;
  const row = db.prepare('SELECT api_token FROM users WHERE id = ?').get(id) as { api_token: string };
  return { id, api_token: row.api_token, handle };
}

beforeEach(() => {
  db = createTestDb();
  const now = Date.now();

  student = { id: uuidv4(), api_token: uuidv4() };
  teacher = { id: uuidv4(), api_token: uuidv4() };

  // Both accounts are inserted with role='student' — the same shape a real
  // signup would produce after 92abf57 (see routes/users.ts). The variable
  // names `student` and `teacher` are legacy; both are just accounts. Any
  // account can author problems now (Phase 2 role-gate removal).
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(student.id, student.api_token, null, 'student', now, now);
  db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(teacher.id, teacher.api_token, null, 'student', now, now);
});

afterEach(() => {
  closeTestDb();
});

// ── Migration / schema ────────────────────────────────────────────────────────

describe('schema', () => {
  it('problems table exists', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='problems'").get();
    expect(row).toBeTruthy();
  });

  it('problem_tests table exists with FK', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='problem_tests'").get();
    expect(row).toBeTruthy();
  });

  it('submissions table exists', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'").get();
    expect(row).toBeTruthy();
  });

  it('FK constraint enforced on problem_tests', () => {
    expect(() => {
      db.prepare('INSERT INTO problem_tests (problem_id, tier, ordinal, input, expected) VALUES (?, ?, ?, ?, ?)')
        .run(999999, 1, 1, 'x', 'y');
    }).toThrow();
  });

  it('problems table has generator_py, reference_solution_py, checker_py columns', () => {
    const cols = db.prepare("PRAGMA table_info(problems)").all() as { name: string }[];
    const names = cols.map(c => c.name);
    expect(names).toContain('generator_py');
    expect(names).toContain('reference_solution_py');
    expect(names).toContain('checker_py');
  });

  it('problem_tests table has fields_json column', () => {
    const cols = db.prepare("PRAGMA table_info(problem_tests)").all() as { name: string }[];
    expect(cols.map(c => c.name)).toContain('fields_json');
  });

  it('new columns default to NULL for existing-style rows', () => {
    const id = (db.prepare("INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by) VALUES (?, ?, ?, ?, ?, ?)")
      .run('test-null', 'T', 'S', '', 0, 'u') as { lastInsertRowid: number }).lastInsertRowid;
    const row = db.prepare("SELECT generator_py, reference_solution_py, checker_py FROM problems WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row.generator_py).toBeNull();
    expect(row.reference_solution_py).toBeNull();
    expect(row.checker_py).toBeNull();
  });
});

// ── GET /api/problems ─────────────────────────────────────────────────────────

describe('GET /api/problems', () => {
  beforeEach(() => {
    db.prepare('INSERT INTO problems (slug, title, statement, order_index, created_by) VALUES (?, ?, ?, ?, ?)')
      .run('alpha', 'Alpha', 'stmt', 10, teacher.id);
    db.prepare('INSERT INTO problems (slug, title, statement, order_index, created_by) VALUES (?, ?, ?, ?, ?)')
      .run('beta', 'Beta', 'stmt', 5, teacher.id);
    db.prepare('INSERT INTO problems (slug, title, statement, order_index, archived, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .run('gamma', 'Gamma', 'stmt', 1, 1, teacher.id);
  });

  it('returns non-archived problems ordered by order_index', async () => {
    const res = await request(app).get('/api/problems').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual(['beta', 'alpha']);
  });

  it('excludes archived problems', async () => {
    const res = await request(app).get('/api/problems').set(auth(student.api_token));
    const slugs = res.body.map((p: { slug: string }) => p.slug);
    expect(slugs).not.toContain('gamma');
  });

  it('401 without auth', async () => {
    const res = await request(app).get('/api/problems');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/problems/:slug ───────────────────────────────────────────────────

describe('GET /api/problems/:slug', () => {
  let problemId: number;

  beforeEach(() => {
    const result = db.prepare('INSERT INTO problems (slug, title, statement, starter_code, created_by) VALUES (?, ?, ?, ?, ?)')
      .run('sum-two', 'Sum Two', 'stmt', 'print()', teacher.id);
    problemId = result.lastInsertRowid as number;
    db.prepare('INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected) VALUES (?, ?, ?, ?, ?, ?)')
      .run(problemId, 1, 1, 1, 'a\n', 'b\n');
    db.prepare('INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected) VALUES (?, ?, ?, ?, ?, ?)')
      .run(problemId, 1, 0, 2, 'c\n', 'd\n');
  });

  it('returns problem with visible tests only', async () => {
    const res = await request(app).get('/api/problems/sum-two').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('sum-two');
    expect(res.body.visibleTests).toHaveLength(1);
    expect(res.body.visibleTests[0].ordinal).toBe(1);
  });

  it('404 for unknown slug', async () => {
    const res = await request(app).get('/api/problems/nope').set(auth(student.api_token));
    expect(res.status).toBe(404);
  });

  it('returns checker_py when set', async () => {
    db.prepare('UPDATE problems SET checker_py = ? WHERE id = ?').run('def check(): pass', problemId);
    const res = await request(app).get('/api/problems/sum-two').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.checker_py).toBe('def check(): pass');
  });

  it('checker_py is null when not set', async () => {
    const res = await request(app).get('/api/problems/sum-two').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body.checker_py).toBeNull();
  });
});

// ── GET /api/problems/:slug/tests-for-submit ──────────────────────────────────

describe('GET /api/problems/:slug/tests-for-submit', () => {
  let problemId: number;

  beforeEach(() => {
    const result = db.prepare('INSERT INTO problems (slug, title, statement, created_by) VALUES (?, ?, ?, ?)')
      .run('sum-two', 'Sum Two', 'stmt', teacher.id);
    problemId = result.lastInsertRowid as number;
    db.prepare('INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected) VALUES (?, ?, ?, ?, ?, ?)')
      .run(problemId, 1, 1, 1, 'visible\n', 'v_out\n');
    db.prepare('INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected) VALUES (?, ?, ?, ?, ?, ?)')
      .run(problemId, 2, 0, 2, 'hidden\n', 'h_out\n');
  });

  it('401 for anonymous', async () => {
    const res = await request(app).get('/api/problems/sum-two/tests-for-submit');
    expect(res.status).toBe(401);
  });

  it('returns all tests including hidden', async () => {
    const res = await request(app).get('/api/problems/sum-two/tests-for-submit').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const inputs = res.body.map((t: { input: string }) => t.input);
    expect(inputs).toContain('visible\n');
    expect(inputs).toContain('hidden\n');
  });

  it('returns fields_json for tests that have it', async () => {
    db.prepare('UPDATE problem_tests SET fields_json = ? WHERE problem_id = ? AND ordinal = ?')
      .run('{"n":5}', problemId, 1);
    const res = await request(app).get('/api/problems/sum-two/tests-for-submit').set(auth(student.api_token));
    expect(res.status).toBe(200);
    const t1 = res.body.find((t: { ordinal: number }) => t.ordinal === 1);
    expect(t1.fields_json).toBe('{"n":5}');
  });

  it('fields_json is null when not set', async () => {
    const res = await request(app).get('/api/problems/sum-two/tests-for-submit').set(auth(student.api_token));
    expect(res.status).toBe(200);
    for (const t of res.body) {
      expect(t.fields_json ?? null).toBeNull();
    }
  });
});

// ── POST /api/problems/:slug/submit ───────────────────────────────────────────

describe('POST /api/problems/:slug/submit', () => {
  beforeEach(() => {
    db.prepare('INSERT INTO problems (slug, title, statement, created_by) VALUES (?, ?, ?, ?)')
      .run('sum-two', 'Sum Two', 'stmt', teacher.id);
  });

  it('stores a submission row', async () => {
    const res = await request(app)
      .post('/api/problems/sum-two/submit')
      .set(auth(student.api_token))
      .send({ code: 'print(3)', stars: 3, verdict: 'ok' });
    expect(res.status).toBe(201);
    expect(res.body.stars).toBe(3);
    expect(res.body.verdict).toBe('ok');
    expect(res.body.user_id).toBe(student.id);
  });

  it('stores wa with failed_test and failed_tier', async () => {
    const res = await request(app)
      .post('/api/problems/sum-two/submit')
      .set(auth(student.api_token))
      .send({ code: 'print(0)', stars: 1, verdict: 'wa', failed_test: 4, failed_tier: 2 });
    expect(res.status).toBe(201);
    expect(res.body.failed_test).toBe(4);
    expect(res.body.failed_tier).toBe(2);
  });

  it('400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/problems/sum-two/submit')
      .set(auth(student.api_token))
      .send({ code: 'x' });
    expect(res.status).toBe(400);
  });

  it('401 without auth', async () => {
    const res = await request(app).post('/api/problems/sum-two/submit').send({ code: '', stars: 0, verdict: 'wa' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/submissions/me ────────────────────────────────────────────────────

describe('GET /api/submissions/me', () => {
  let p1: number; let p2: number;

  beforeEach(() => {
    p1 = (db.prepare('INSERT INTO problems (slug, title, statement, created_by) VALUES (?, ?, ?, ?)').run('p1', 'P1', 's', teacher.id)).lastInsertRowid as number;
    p2 = (db.prepare('INSERT INTO problems (slug, title, statement, created_by) VALUES (?, ?, ?, ?)').run('p2', 'P2', 's', teacher.id)).lastInsertRowid as number;
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, p1, 'x', 1, 'wa');
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, p1, 'y', 3, 'ok');
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, p2, 'z', 2, 'wa');
  });

  it('returns best stars per problem', async () => {
    const res = await request(app).get('/api/submissions/me').set(auth(student.api_token));
    expect(res.status).toBe(200);
    const byProblem: Record<number, number> = {};
    for (const row of res.body as { problem_id: number; best_stars: number }[]) {
      byProblem[row.problem_id] = row.best_stars;
    }
    expect(byProblem[p1]).toBe(3);
    expect(byProblem[p2]).toBe(2);
  });
});

// ── Teacher routes ─────────────────────────────────────────────────────────────

describe('teacher routes — access control (open to any authed account under Phase 2)', () => {
  it('any authenticated account can list problems (previously teacher-only)', async () => {
    const res = await request(app).get('/api/teacher/problems').set(auth(student.api_token));
    expect(res.status).toBe(200);
  });

  it('401 for anonymous on GET /teacher/problems', async () => {
    const res = await request(app).get('/api/teacher/problems');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/teacher/problems', () => {
  it('creates problem with tests', async () => {
    const res = await request(app)
      .post('/api/teacher/problems')
      .set(auth(teacher.api_token))
      .send(PROBLEM_BODY);
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('sum-two');
    const tests = db.prepare('SELECT * FROM problem_tests WHERE problem_id = ?').all(res.body.id);
    expect(tests).toHaveLength(3);
  });

  it('assigns contiguous ordinals sorted by tier', async () => {
    const res = await request(app)
      .post('/api/teacher/problems')
      .set(auth(teacher.api_token))
      .send(PROBLEM_BODY);
    const tests = db.prepare('SELECT * FROM problem_tests WHERE problem_id = ? ORDER BY ordinal ASC').all(res.body.id) as ProblemTest[];
    expect(tests.map(t => t.ordinal)).toEqual([1, 2, 3]);
    expect(tests[0].tier).toBe(1);
    expect(tests[1].tier).toBe(1);
    expect(tests[2].tier).toBe(2);
  });

  it('409 for duplicate slug', async () => {
    await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    expect(res.status).toBe(409);
  });

  it('400 for invalid slug', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, slug: 'BAD SLUG' });
    expect(res.status).toBe(400);
  });

  it('400 when no tier-1 test', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, tests: [{ tier: 2, is_visible: true, input: 'x', expected: 'y' }] });
    expect(res.status).toBe(400);
  });

  it('400 when no visible test', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, tests: [{ tier: 1, is_visible: false, input: 'x', expected: 'y' }] });
    expect(res.status).toBe(400);
  });

  it('persists generator_py, reference_solution_py, checker_py when provided', async () => {
    const res = await request(app)
      .post('/api/teacher/problems')
      .set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, generator_py: 'gen', reference_solution_py: 'ref', checker_py: 'chk' });
    expect(res.status).toBe(201);
    const row = db.prepare('SELECT generator_py, reference_solution_py, checker_py FROM problems WHERE id = ?').get(res.body.id) as Record<string, string>;
    expect(row.generator_py).toBe('gen');
    expect(row.reference_solution_py).toBe('ref');
    expect(row.checker_py).toBe('chk');
  });

  it('stores NULL for generator columns when omitted', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    const row = db.prepare('SELECT generator_py, reference_solution_py, checker_py FROM problems WHERE id = ?').get(res.body.id) as Record<string, unknown>;
    expect(row.generator_py).toBeNull();
    expect(row.reference_solution_py).toBeNull();
    expect(row.checker_py).toBeNull();
  });

  it('persists fields_json for tests that have fields', async () => {
    const testsWithFields = [
      { tier: 1, is_visible: true, input: '5\n1 2 3 4 5\n', expected: '15', fields: { n: 5, arr: [1,2,3,4,5] } },
    ];
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, tests: testsWithFields });
    expect(res.status).toBe(201);
    const test = db.prepare('SELECT fields_json FROM problem_tests WHERE problem_id = ?').get(res.body.id) as { fields_json: string };
    expect(JSON.parse(test.fields_json)).toEqual({ n: 5, arr: [1,2,3,4,5] });
  });
});

interface ProblemTest {
  id: number;
  problem_id: number;
  tier: number;
  is_visible: number;
  ordinal: number;
  input: string;
  expected: string;
}

describe('PUT /api/teacher/problems/:slug', () => {
  let problemId: number;

  beforeEach(async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    problemId = res.body.id;
  });

  it('replaces tests and updates fields', async () => {
    const res = await request(app)
      .put('/api/teacher/problems/sum-two')
      .set(auth(teacher.api_token))
      .send({
        ...PROBLEM_BODY,
        title: 'Updated Title',
        tests: [{ tier: 1, is_visible: true, input: 'new\n', expected: 'new_out\n' }],
      });
    expect(res.status).toBe(200);
    const tests = db.prepare('SELECT * FROM problem_tests WHERE problem_id = ?').all(problemId) as ProblemTest[];
    expect(tests).toHaveLength(1);
    expect(tests[0].input).toBe('new\n');
  });

  it('updates generator_py, reference_solution_py, checker_py', async () => {
    const res = await request(app)
      .put('/api/teacher/problems/sum-two')
      .set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, generator_py: 'gen2', reference_solution_py: 'ref2', checker_py: 'chk2' });
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT generator_py, reference_solution_py, checker_py FROM problems WHERE id = ?').get(problemId) as Record<string, string>;
    expect(row.generator_py).toBe('gen2');
    expect(row.reference_solution_py).toBe('ref2');
    expect(row.checker_py).toBe('chk2');
  });

  it('clears generator columns when not sent', async () => {
    await request(app).put('/api/teacher/problems/sum-two').set(auth(teacher.api_token))
      .send({ ...PROBLEM_BODY, generator_py: 'gen2' });
    const res = await request(app).put('/api/teacher/problems/sum-two').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    expect(res.status).toBe(200);
    const row = db.prepare('SELECT generator_py FROM problems WHERE id = ?').get(problemId) as { generator_py: unknown };
    expect(row.generator_py).toBeNull();
  });

  it('403 for a different authenticated account that is not the author (ownership check, not role check)', async () => {
    const res = await request(app).put('/api/teacher/problems/sum-two').set(auth(student.api_token)).send(PROBLEM_BODY);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/teacher/problems/:slug/archive', () => {
  beforeEach(async () => {
    await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
  });

  it('soft-deletes the problem', async () => {
    const res = await request(app).post('/api/teacher/problems/sum-two/archive').set(auth(teacher.api_token));
    expect(res.status).toBe(204);
    const p = db.prepare('SELECT archived FROM problems WHERE slug = ?').get('sum-two') as { archived: number };
    expect(p.archived).toBe(1);
  });

  it('hidden from GET /api/problems after archive', async () => {
    await request(app).post('/api/teacher/problems/sum-two/archive').set(auth(teacher.api_token));
    const res = await request(app).get('/api/problems').set(auth(student.api_token));
    expect(res.body.map((p: { slug: string }) => p.slug)).not.toContain('sum-two');
  });
});

describe('GET /api/teacher/problems/:slug/submissions', () => {
  function addToGroup(teacherId: string, studentId: string): void {
    const groupId = uuidv4();
    const now = Date.now();
    db.prepare('INSERT INTO groups (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)')
      .run(groupId, teacherId, 'Class', now);
    db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), groupId, studentId, now);
  }

  beforeEach(async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    const problemId = res.body.id;
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, problemId, 'code', 2, 'wa');
  });

  it('returns submissions from students in the requesting teacher\'s groups', async () => {
    addToGroup(teacher.id, student.id);
    const res = await request(app).get('/api/teacher/problems/sum-two/submissions').set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    // Handle-only — no `user_name`, no PII (Safety & Privacy Principle #2).
    expect(res.body[0]).not.toHaveProperty('user_name');
    expect(res.body[0].user_handle === null || typeof res.body[0].user_handle === 'string').toBe(true);
  });

  it('does not leak submissions to a teacher who does not own the student\'s group (cross-teacher isolation)', async () => {
    addToGroup(teacher.id, student.id);
    const now = Date.now();
    const otherTeacher = { id: uuidv4(), api_token: uuidv4() };
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(otherTeacher.id, otherTeacher.api_token, null, 'student', now, now);
    const res = await request(app).get('/api/teacher/problems/sum-two/submissions').set(auth(otherTeacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns empty for a teacher with no groups', async () => {
    const res = await request(app).get('/api/teacher/problems/sum-two/submissions').set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('an account not in any group with the submitter sees an empty list, not 403', async () => {
    const res = await request(app).get('/api/teacher/problems/sum-two/submissions').set(auth(student.api_token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

// ── Phase 9 alignment tests ───────────────────────────────────────────────────

describe('Phase 9: created_by never in any compete-mode response body', () => {
  beforeEach(async () => {
    await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
  });

  function assertNoCreatedBy(body: unknown, path = ''): void {
    if (Array.isArray(body)) {
      body.forEach((item, i) => assertNoCreatedBy(item, `${path}[${i}]`));
      return;
    }
    if (body && typeof body === 'object') {
      for (const [k, v] of Object.entries(body)) {
        if (k === 'created_by') {
          throw new Error(`created_by leaked at ${path}.${k}`);
        }
        assertNoCreatedBy(v, `${path}.${k}`);
      }
    }
  }

  it('GET /api/problems does not include created_by', async () => {
    const res = await request(app).get('/api/problems').set(auth(student.api_token));
    expect(res.status).toBe(200);
    assertNoCreatedBy(res.body);
  });

  it('GET /api/problems/:slug does not include created_by', async () => {
    const res = await request(app).get('/api/problems/sum-two').set(auth(student.api_token));
    expect(res.status).toBe(200);
    assertNoCreatedBy(res.body);
  });

  it('GET /api/teacher/problems does not include created_by', async () => {
    const res = await request(app).get('/api/teacher/problems').set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    assertNoCreatedBy(res.body);
  });

  it('GET /api/teacher/problems/:slug does not include created_by (previously a SELECT * leak)', async () => {
    const res = await request(app).get('/api/teacher/problems/sum-two').set(auth(teacher.api_token));
    expect(res.status).toBe(200);
    assertNoCreatedBy(res.body);
  });

  it('POST /api/teacher/problems response body does not include created_by', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'sum-three',
    });
    expect(res.status).toBe(201);
    assertNoCreatedBy(res.body);
  });

  it('PUT /api/teacher/problems/:slug response body does not include created_by', async () => {
    const res = await request(app).put('/api/teacher/problems/sum-two').set(auth(teacher.api_token)).send({
      ...PROBLEM_BODY,
      title: 'Renamed',
    });
    expect(res.status).toBe(200);
    assertNoCreatedBy(res.body);
  });
});

describe('Phase 9: problem source (archive provenance) is separate from created_by', () => {
  it('accepts and returns a `source` field independent of created_by', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'vsosh-2024',
      source: 'ВсОШ 2024, региональный этап, задача 3',
    });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('ВсОШ 2024, региональный этап, задача 3');
    expect(res.body).not.toHaveProperty('created_by');
    // Round-trip via GET
    const get = await request(app).get('/api/teacher/problems/vsosh-2024').set(auth(teacher.api_token));
    expect(get.body.source).toBe('ВсОШ 2024, региональный этап, задача 3');
    expect(get.body).not.toHaveProperty('created_by');
  });
});

describe('Phase 9: content scanner runs at author boundaries', () => {
  it('flags a problem whose statement contains an email', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'contact-me',
      statement: 'Email me at foo@example.com for hints.',
    });
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('flagged');
  });

  it('flags a problem whose reference_solution contains a phone number', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'phone-leak',
      reference_solution_py: '# my phone: +7 900 123 4567\nprint(input())',
    });
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('flagged');
  });

  it('reports clean on a well-behaved problem', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'clean-one',
    });
    expect(res.status).toBe(201);
    expect(res.body.scan_status).toBe('clean');
  });
});

describe('GET /api/problems/:slug/solve-count (Phase 9 aggregate-only)', () => {
  it('returns distinct-account solve count with no identity', async () => {
    const res = await request(app).post('/api/teacher/problems').set(auth(teacher.api_token)).send(PROBLEM_BODY);
    const problemId = res.body.id;
    // 2 submissions from same user with stars, 1 from another user, 1 with 0 stars
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, problemId, 'c1', 3, 'ok');
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(student.id, problemId, 'c2', 2, 'ok');
    const other = uuidv4();
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(other, uuidv4(), 'Zed', 'student', Date.now(), Date.now());
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(other, problemId, 'c3', 1, 'ok');
    const zero = uuidv4();
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(zero, uuidv4(), 'Q', 'student', Date.now(), Date.now());
    db.prepare('INSERT INTO submissions (user_id, problem_id, code, stars, verdict) VALUES (?, ?, ?, ?, ?)')
      .run(zero, problemId, 'c4', 0, 'wa');

    const sc = await request(app).get('/api/problems/sum-two/solve-count').set(auth(student.api_token));
    expect(sc.status).toBe(200);
    expect(sc.body).toEqual({ solve_count: 2 });
    // No solver list, no user id, no user name
    expect(sc.body).not.toHaveProperty('users');
    expect(sc.body).not.toHaveProperty('solvers');
  });

  it('404 for unknown problem', async () => {
    const sc = await request(app).get('/api/problems/nope/solve-count').set(auth(student.api_token));
    expect(sc.status).toBe(404);
  });
});

// ── Phase 2 regression proof: real signup can author a problem end-to-end ──

describe('Phase 2 regression: real signup can author a problem, no role gate', () => {
  it('freshly signed-up account creates + edits + archives its own problem', async () => {
    const author = await signup();
    // Create — previously would have 403'd with teacherOnly.
    const create = await request(app).post('/api/teacher/problems').set(auth(author.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'author-owned',
    });
    expect(create.status).toBe(201);
    // Edit — ownership check passes for the author.
    const put = await request(app).put('/api/teacher/problems/author-owned').set(auth(author.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'author-owned',
      title: 'Renamed',
    });
    expect(put.status).toBe(200);
    // Archive — same ownership rule.
    const archive = await request(app).post('/api/teacher/problems/author-owned/archive').set(auth(author.api_token));
    expect(archive.status).toBe(204);
  });

  it('a fresh signup does NOT get 403 on GET /teacher/problems (the failure that shipped)', async () => {
    const anyone = await signup();
    const res = await request(app).get('/api/teacher/problems').set(auth(anyone.api_token));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it('ownership blocks a different fresh account from editing someone else\'s problem', async () => {
    const author = await signup();
    const outsider = await signup();
    await request(app).post('/api/teacher/problems').set(auth(author.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'protected',
    });
    const putRes = await request(app).put('/api/teacher/problems/protected').set(auth(outsider.api_token)).send({
      ...PROBLEM_BODY,
      slug: 'protected',
      title: 'Hostile edit',
    });
    expect(putRes.status).toBe(403);
    const archRes = await request(app).post('/api/teacher/problems/protected/archive').set(auth(outsider.api_token));
    expect(archRes.status).toBe(403);
  });
});
