import { Router, Request, Response, NextFunction } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, AuthUser } from '../middleware/auth.js';

interface Problem {
  id: number;
  slug: string;
  title: string;
  statement: string;
  order_index: number;
  starter_code: string;
  archived: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ProblemTest {
  id: number;
  problem_id: number;
  tier: number;
  is_visible: number;
  ordinal: number;
  input: string;
  expected: string;
}

interface TestInput {
  tier: number;
  is_visible?: boolean;
  input: string;
  expected: string;
}

function teacherOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'teacher') {
    res.status(403).json({ error: 'Forbidden', message: 'Teacher role required' });
    return;
  }
  next();
}

function slugValid(slug: string): boolean {
  return /^[a-z][a-z0-9-]{1,40}$/.test(slug);
}

function normalizeTests(tests: TestInput[]): { ordinal: number; tier: number; is_visible: number; input: string; expected: string }[] {
  // Sort by tier then original order, assign contiguous ordinals
  const sorted = [...tests].sort((a, b) => a.tier - b.tier);
  return sorted.map((t, i) => ({
    ordinal: i + 1,
    tier: t.tier,
    is_visible: t.is_visible ? 1 : 0,
    input: t.input,
    expected: t.expected,
  }));
}

function validateProblemBody(body: {
  slug?: unknown;
  title?: unknown;
  statement?: unknown;
  starter_code?: unknown;
  order_index?: unknown;
  tests?: unknown;
}): string | null {
  if (!body.slug || typeof body.slug !== 'string' || !slugValid(body.slug)) {
    return 'slug must match ^[a-z][a-z0-9-]{1,40}$';
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return 'title is required';
  }
  if (!body.statement || typeof body.statement !== 'string' || !body.statement.trim()) {
    return 'statement is required';
  }
  if (!Array.isArray(body.tests) || body.tests.length === 0) {
    return 'tests array is required';
  }
  const tests = body.tests as TestInput[];
  const tier1 = tests.filter(t => t.tier === 1);
  if (tier1.length === 0) return 'at least one tier-1 test is required';
  const hasVisible = tests.some(t => t.is_visible);
  if (!hasVisible) return 'at least one visible test is required';
  for (const t of tests) {
    if (![1, 2, 3].includes(t.tier)) return 'test tier must be 1, 2, or 3';
    if (typeof t.input !== 'string') return 'test input must be a string';
    if (typeof t.expected !== 'string') return 'test expected must be a string';
  }
  return null;
}

export function createCompeteRouter(): Router {
  const router = Router();

  // ── Public (auth required, any role) ────────────────────────────────────────

  router.use(authMiddleware);

  // Sidebar list — lightweight
  router.get('/problems', (_req: Request, res: Response): void => {
    const db = getDb();
    const problems = db.prepare(`
      SELECT id, slug, title, order_index
      FROM problems
      WHERE archived = 0
      ORDER BY order_index ASC, id ASC
    `).all();
    res.json(problems);
  });

  // Full problem for solving — visible tests only
  router.get('/problems/:slug', (req: Request, res: Response): void => {
    const db = getDb();
    const problem = db.prepare(`
      SELECT id, slug, title, statement, starter_code, order_index
      FROM problems WHERE slug = ? AND archived = 0
    `).get(req.params.slug) as Problem | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const tests = db.prepare(`
      SELECT id, ordinal, tier, input, expected
      FROM problem_tests
      WHERE problem_id = ? AND is_visible = 1
      ORDER BY ordinal ASC
    `).all(problem.id);
    res.json({ ...problem, visibleTests: tests });
  });

  // All tests (visible + hidden) — used by submit runner client-side
  router.get('/problems/:slug/tests-for-submit', (req: Request, res: Response): void => {
    const db = getDb();
    const problem = db.prepare(`
      SELECT id FROM problems WHERE slug = ? AND archived = 0
    `).get(req.params.slug) as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const tests = db.prepare(`
      SELECT id, ordinal, tier, is_visible, input, expected
      FROM problem_tests
      WHERE problem_id = ?
      ORDER BY tier ASC, ordinal ASC
    `).all(problem.id);
    res.json(tests);
  });

  // Store a submission (verdict computed client-side)
  router.post('/problems/:slug/submit', (req: Request, res: Response): void => {
    const db = getDb();
    const problem = db.prepare(`
      SELECT id FROM problems WHERE slug = ? AND archived = 0
    `).get(req.params.slug) as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const { code, stars, verdict, failed_test, failed_tier } = req.body;
    if (typeof code !== 'string' || typeof stars !== 'number' || typeof verdict !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'code, stars, and verdict are required' });
      return;
    }
    const result = db.prepare(`
      INSERT INTO submissions (user_id, problem_id, code, stars, verdict, failed_test, failed_tier)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user!.id,
      problem.id,
      code,
      stars,
      verdict,
      failed_test ?? null,
      failed_tier ?? null,
    );
    const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(row);
  });

  // Best stars per problem for current user
  router.get('/submissions/me', (req: Request, res: Response): void => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT problem_id, MAX(stars) as best_stars
      FROM submissions
      WHERE user_id = ?
      GROUP BY problem_id
    `).all(req.user!.id) as { problem_id: number; best_stars: number }[];
    res.json(rows);
  });

  // ── Teacher routes ───────────────────────────────────────────────────────────

  router.get('/teacher/problems', teacherOnly, (_req: Request, res: Response): void => {
    const db = getDb();
    const problems = db.prepare(`
      SELECT p.id, p.slug, p.title, p.order_index, p.archived, p.updated_at,
             COUNT(CASE WHEN pt.tier = 1 THEN 1 END) as tests_t1,
             COUNT(CASE WHEN pt.tier = 2 THEN 1 END) as tests_t2,
             COUNT(CASE WHEN pt.tier = 3 THEN 1 END) as tests_t3
      FROM problems p
      LEFT JOIN problem_tests pt ON pt.problem_id = p.id
      GROUP BY p.id
      ORDER BY p.order_index ASC, p.id ASC
    `).all();
    res.json(problems);
  });

  router.get('/teacher/problems/:slug', teacherOnly, (req: Request, res: Response): void => {
    const db = getDb();
    const problem = db.prepare(`
      SELECT * FROM problems WHERE slug = ?
    `).get(req.params.slug) as Problem | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const tests = db.prepare(`
      SELECT * FROM problem_tests WHERE problem_id = ? ORDER BY ordinal ASC
    `).all(problem.id) as ProblemTest[];
    res.json({ ...problem, tests });
  });

  router.post('/teacher/problems', teacherOnly, (req: Request, res: Response): void => {
    const validationError = validateProblemBody(req.body);
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }
    const { slug, title, statement, starter_code, order_index, tests } = req.body as {
      slug: string; title: string; statement: string;
      starter_code?: string; order_index?: number; tests: TestInput[];
    };
    const db = getDb();
    const existing = db.prepare('SELECT id FROM problems WHERE slug = ?').get(slug);
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'slug already exists' });
      return;
    }
    const insert = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(slug, title.trim(), statement.trim(), starter_code ?? '', order_index ?? 0, (req.user as AuthUser).id);
      const problemId = result.lastInsertRowid;
      const normalized = normalizeTests(tests);
      const insertTest = db.prepare(`
        INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const t of normalized) {
        insertTest.run(problemId, t.tier, t.is_visible, t.ordinal, t.input, t.expected);
      }
      return db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
    });
    const problem = insert();
    res.status(201).json(problem);
  });

  router.put('/teacher/problems/:slug', teacherOnly, (req: Request, res: Response): void => {
    const validationError = validateProblemBody({ ...req.body, slug: req.params.slug });
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }
    const db = getDb();
    const problem = db.prepare('SELECT id FROM problems WHERE slug = ?').get(req.params.slug) as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const { title, statement, starter_code, order_index, tests } = req.body as {
      title: string; statement: string; starter_code?: string; order_index?: number; tests: TestInput[];
    };
    const update = db.transaction(() => {
      db.prepare(`
        UPDATE problems SET title = ?, statement = ?, starter_code = ?, order_index = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(title.trim(), statement.trim(), starter_code ?? '', order_index ?? 0, problem.id);
      db.prepare('DELETE FROM problem_tests WHERE problem_id = ?').run(problem.id);
      const normalized = normalizeTests(tests);
      const insertTest = db.prepare(`
        INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const t of normalized) {
        insertTest.run(problem.id, t.tier, t.is_visible, t.ordinal, t.input, t.expected);
      }
      return db.prepare(`
        SELECT p.*, (SELECT COUNT(*) FROM problem_tests WHERE problem_id = p.id) as test_count
        FROM problems p WHERE p.id = ?
      `).get(problem.id);
    });
    res.json(update());
  });

  router.post('/teacher/problems/:slug/archive', teacherOnly, (req: Request, res: Response): void => {
    const db = getDb();
    const result = db.prepare(`
      UPDATE problems SET archived = 1, updated_at = datetime('now') WHERE slug = ?
    `).run(req.params.slug);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    res.status(204).end();
  });

  router.get('/teacher/problems/:slug/submissions', teacherOnly, (req: Request, res: Response): void => {
    const db = getDb();
    const problem = db.prepare('SELECT id FROM problems WHERE slug = ?').get(req.params.slug) as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = db.prepare(`
      SELECT s.*, u.name as user_name, u.handle as user_handle
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      WHERE s.problem_id = ?
      ORDER BY s.ts DESC
      LIMIT ?
    `).all(problem.id, limit);
    res.json(rows);
  });

  return router;
}
