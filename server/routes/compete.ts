import { Router, Request, Response, NextFunction } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware, AuthUser } from '../middleware/auth.js';
import { rateLimitPerUser } from '../middleware/rateLimitPerUser.js';
import { scanSnapshot, ScanResult } from '../snapshots/scanner.js';

const teacherProblemWriteLimit = rateLimitPerUser({ name: 'teacher-problem-write', windowMs: 3600_000, max: 60 });

function scanProblemBody(body: {
  title?: string; statement?: string; starter_code?: string;
  generator_py?: string | null; reference_solution_py?: string | null; checker_py?: string | null;
}): ScanResult {
  return scanSnapshot({
    title: body.title ?? '',
    files: {
      'statement.md': body.statement ?? '',
      'starter.py': body.starter_code ?? '',
      'generator.py': body.generator_py ?? '',
      'reference.py': body.reference_solution_py ?? '',
      'checker.py': body.checker_py ?? '',
    },
  });
}

function respondFlagged(res: Response, scan: ScanResult): void {
  res.status(422).json({
    error: 'Unprocessable Entity',
    code: 'content_flagged',
    message: 'Content flagged for review. Remove personal contact info and try again.',
    findings: scan.findings.map((f) => ({ kind: f.kind, where: f.where })),
  });
}

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
  generator_py?: string | null;
  reference_solution_py?: string | null;
  checker_py?: string | null;
}

interface ProblemTest {
  id: number;
  problem_id: number;
  tier: number;
  is_visible: number;
  ordinal: number;
  input: string;
  expected: string;
  fields_json?: string | null;
}

interface TestInput {
  tier: number;
  is_visible?: boolean;
  input: string;
  expected: string;
  fields?: Record<string, unknown> | null;
}

interface ImportTestRow {
  id?: string;
  tier: number;
  subtask?: string;
  input: string | null;
  answer: string | null;
  input_size_bytes?: number;
  answer_size_bytes?: number;
}

interface ImportProblem {
  id: string;
  slug?: string;
  contest?: string;
  title_ru?: string;
  title_en?: string;
  statement_tex?: string;
  tests?: ImportTestRow[];
}

function importSlugValid(slug: string): boolean {
  return /^[a-z][a-z0-9-]{1,79}$/.test(slug);
}

function mapImportTests(tests: ImportTestRow[]): TestInput[] {
  const result: TestInput[] = [];
  for (const t of tests) {
    if (t.input === null || t.answer === null) continue;
    const rawTier = t.tier;
    const mappedTier = Math.min(3, Math.max(1, rawTier === 0 ? 1 : rawTier)) as 1 | 2 | 3;
    // tier-0 = regional examples subtask; tier-1 with no subtask = municipal first tier
    const is_visible = rawTier === 0 || t.subtask === 'examples' || (rawTier === 1 && !t.subtask);
    result.push({ tier: mappedTier, is_visible, input: t.input, expected: t.answer });
  }
  return result;
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

function normalizeTests(tests: TestInput[]): { ordinal: number; tier: number; is_visible: number; input: string; expected: string; fields_json: string | null }[] {
  const sorted = [...tests].sort((a, b) => a.tier - b.tier);
  return sorted.map((t, i) => ({
    ordinal: i + 1,
    tier: t.tier,
    is_visible: t.is_visible ? 1 : 0,
    input: t.input,
    expected: t.expected,
    fields_json: t.fields != null ? JSON.stringify(t.fields) : null,
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

  router.use(authMiddleware);

  // Sidebar list
  router.get('/problems', async (_req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT id, slug, title, order_index
       FROM problems
       WHERE archived = 0
       ORDER BY order_index ASC, id ASC`,
    );
    res.json(result.rows);
  });

  // Full problem — visible tests only
  router.get('/problems/:slug', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      `SELECT id, slug, title, statement, starter_code, order_index, checker_py
       FROM problems WHERE slug = ? AND archived = 0`,
      [req.params.slug],
    )).rows[0] as unknown as Problem | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const tests = (await client.execute(
      `SELECT id, ordinal, tier, input, expected
       FROM problem_tests
       WHERE problem_id = ? AND is_visible = 1
       ORDER BY ordinal ASC`,
      [problem.id],
    )).rows;
    res.json({ ...problem, visibleTests: tests });
  });

  // All tests for submit runner
  router.get('/problems/:slug/tests-for-submit', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ? AND archived = 0',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const tests = (await client.execute(
      `SELECT id, ordinal, tier, is_visible, input, expected, fields_json
       FROM problem_tests
       WHERE problem_id = ?
       ORDER BY tier ASC, ordinal ASC`,
      [problem.id],
    )).rows;
    res.json(tests);
  });

  // Store a submission
  router.post('/problems/:slug/submit', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ? AND archived = 0',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const { code, stars, verdict, failed_test, failed_tier } = req.body;
    if (typeof code !== 'string' || typeof stars !== 'number' || typeof verdict !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'code, stars, and verdict are required' });
      return;
    }
    const result = await client.execute(
      `INSERT INTO submissions (user_id, problem_id, code, stars, verdict, failed_test, failed_tier)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, problem.id, code, stars, verdict, failed_test ?? null, failed_tier ?? null],
    );
    const row = (await client.execute(
      'SELECT * FROM submissions WHERE id = ?',
      [result.lastInsertRowid],
    )).rows[0];
    res.status(201).json(row);
  });

  // Best stars per problem for current user
  router.get('/submissions/me', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT problem_id, MAX(stars) as best_stars
       FROM submissions
       WHERE user_id = ?
       GROUP BY problem_id`,
      [req.user!.id],
    );
    res.json(result.rows);
  });

  // ── Teacher routes ───────────────────────────────────────────────────────────

  router.get('/teacher/problems', teacherOnly, async (_req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT p.id, p.slug, p.title, p.order_index, p.archived, p.updated_at,
              COUNT(CASE WHEN pt.tier = 1 THEN 1 END) as tests_t1,
              COUNT(CASE WHEN pt.tier = 2 THEN 1 END) as tests_t2,
              COUNT(CASE WHEN pt.tier = 3 THEN 1 END) as tests_t3
       FROM problems p
       LEFT JOIN problem_tests pt ON pt.problem_id = p.id
       GROUP BY p.id
       ORDER BY p.order_index ASC, p.id ASC`,
    );
    res.json(result.rows);
  });

  router.get('/teacher/problems/:slug', teacherOnly, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      'SELECT * FROM problems WHERE slug = ?',
      [req.params.slug],
    )).rows[0] as unknown as Problem | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const tests = (await client.execute(
      'SELECT * FROM problem_tests WHERE problem_id = ? ORDER BY ordinal ASC',
      [problem.id],
    )).rows as unknown as ProblemTest[];
    res.json({ ...problem, tests });
  });

  router.post('/teacher/problems', teacherOnly, teacherProblemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const validationError = validateProblemBody(req.body);
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }
    const { slug, title, statement, starter_code, order_index, tests, generator_py, reference_solution_py, checker_py } = req.body as {
      slug: string; title: string; statement: string;
      starter_code?: string; order_index?: number; tests: TestInput[];
      generator_py?: string | null; reference_solution_py?: string | null; checker_py?: string | null;
    };
    const scan = scanProblemBody({ title, statement, starter_code, generator_py, reference_solution_py, checker_py });
    if (scan.status === 'flagged') { respondFlagged(res, scan); return; }
    const client = getClient();
    const existing = (await client.execute('SELECT id FROM problems WHERE slug = ?', [slug])).rows[0];
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'slug already exists' });
      return;
    }
    const insertResult = await client.execute(
      `INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by, generator_py, reference_solution_py, checker_py)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, title.trim(), statement.trim(), starter_code ?? '', order_index ?? 0, (req.user as AuthUser).id,
       generator_py ?? null, reference_solution_py ?? null, checker_py ?? null],
    );
    const problemId = insertResult.lastInsertRowid;
    const normalized = normalizeTests(tests);
    await client.batch(
      normalized.map(t => ({
        sql: `INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected, fields_json)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [problemId, t.tier, t.is_visible, t.ordinal, t.input, t.expected, t.fields_json],
      })),
    );
    const problem = (await client.execute('SELECT * FROM problems WHERE id = ?', [problemId])).rows[0];
    res.status(201).json(problem);
  });

  router.put('/teacher/problems/:slug', teacherOnly, teacherProblemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const validationError = validateProblemBody({ ...req.body, slug: req.params.slug });
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ? AND created_by = ?',
      [req.params.slug, req.user!.id],
    )).rows[0] as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const { title, statement, starter_code, order_index, tests, generator_py, reference_solution_py, checker_py } = req.body as {
      title: string; statement: string; starter_code?: string; order_index?: number; tests: TestInput[];
      generator_py?: string | null; reference_solution_py?: string | null; checker_py?: string | null;
    };
    const scanPut = scanProblemBody({ title, statement, starter_code, generator_py, reference_solution_py, checker_py });
    if (scanPut.status === 'flagged') { respondFlagged(res, scanPut); return; }
    await client.execute(
      `UPDATE problems SET title = ?, statement = ?, starter_code = ?, order_index = ?,
         generator_py = ?, reference_solution_py = ?, checker_py = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [title.trim(), statement.trim(), starter_code ?? '', order_index ?? 0,
       generator_py ?? null, reference_solution_py ?? null, checker_py ?? null, problem.id],
    );
    await client.execute('DELETE FROM problem_tests WHERE problem_id = ?', [problem.id]);
    const normalized = normalizeTests(tests);
    await client.batch(
      normalized.map(t => ({
        sql: `INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected, fields_json)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [problem.id, t.tier, t.is_visible, t.ordinal, t.input, t.expected, t.fields_json],
      })),
    );
    const updated = (await client.execute(
      `SELECT p.*, (SELECT COUNT(*) FROM problem_tests WHERE problem_id = p.id) as test_count
       FROM problems p WHERE p.id = ?`,
      [problem.id],
    )).rows[0];
    res.json(updated);
  });

  router.post('/teacher/problems/import', teacherOnly, teacherProblemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const { problems: rawProblems, lang = 'ru', overwrite = false } = req.body as {
      problems: ImportProblem[];
      lang?: 'ru' | 'en';
      overwrite?: boolean;
    };

    if (!Array.isArray(rawProblems) || rawProblems.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'problems must be a non-empty array' });
      return;
    }

    const client = getClient();
    const maxRow = (await client.execute('SELECT COALESCE(MAX(order_index), 0) as m FROM problems')).rows[0] as { m: number };
    let nextOrder = maxRow.m + 1;

    const imported: string[] = [];
    const skipped: string[] = [];
    const errors: { id: string; reason: string }[] = [];

    for (const p of rawProblems) {
      const id = p.id ?? '';
      try {
        const slug = id;
        if (!importSlugValid(slug)) {
          errors.push({ id, reason: `invalid id/slug: "${slug}"` });
          continue;
        }

        const title = (lang === 'en' ? p.title_en : p.title_ru) || p.title_ru || p.title_en || '';
        if (!title.trim()) {
          errors.push({ id, reason: 'no title (title_ru / title_en both missing)' });
          continue;
        }

        const tests = mapImportTests(p.tests ?? []);
        if (!tests.some((t) => t.tier === 1)) {
          errors.push({ id, reason: 'no usable tier-1 tests (inputs may all be >64 KB)' });
          continue;
        }
        if (!tests.some((t) => t.is_visible)) {
          errors.push({ id, reason: 'no visible test after mapping' });
          continue;
        }

        const statement = p.statement_tex ?? '';
        const scanImport = scanProblemBody({ title, statement });
        if (scanImport.status === 'flagged') {
          errors.push({ id, reason: `content flagged: ${scanImport.findings.map((f) => f.kind).join(',')}` });
          continue;
        }
        const existing = (await client.execute(
          'SELECT id, created_by FROM problems WHERE slug = ?', [slug],
        )).rows[0] as { id: number; created_by: string } | undefined;

        if (existing && !overwrite) {
          skipped.push(id);
          continue;
        }
        if (existing && existing.created_by !== req.user!.id) {
          errors.push({ id, reason: 'slug owned by another teacher' });
          continue;
        }

        if (existing) {
          await client.execute(
            `UPDATE problems SET title = ?, statement = ?, updated_at = datetime('now') WHERE id = ?`,
            [title.trim(), statement, existing.id],
          );
          await client.execute('DELETE FROM problem_tests WHERE problem_id = ?', [existing.id]);
          const normalized = normalizeTests(tests);
          await client.batch(normalized.map((t) => ({
            sql: `INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [existing.id, t.tier, t.is_visible, t.ordinal, t.input, t.expected],
          })));
        } else {
          const ins = await client.execute(
            `INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [slug, title.trim(), statement, '', nextOrder++, (req.user as AuthUser).id],
          );
          const problemId = ins.lastInsertRowid;
          const normalized = normalizeTests(tests);
          if (normalized.length > 0) {
            await client.batch(normalized.map((t) => ({
              sql: `INSERT INTO problem_tests (problem_id, tier, is_visible, ordinal, input, expected)
                    VALUES (?, ?, ?, ?, ?, ?)`,
              args: [problemId, t.tier, t.is_visible, t.ordinal, t.input, t.expected],
            })));
          }
        }

        imported.push(id);
      } catch (err) {
        errors.push({ id, reason: String(err) });
      }
    }

    res.json({ imported: imported.length, skipped: skipped.length, errors });
  });

  // Freeze the current problem state into published_json and move
  // public_status back to unlisted (the request/review cycle re-runs on
  // every republish). Any prior approval is invalidated.
  router.post('/teacher/problems/:slug/publish', teacherOnly, teacherProblemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT id, title, statement, starter_code, created_by, scan_status FROM problems WHERE slug = ? AND archived = 0',
      [req.params.slug],
    )).rows[0] as { id: number; title: string; statement: string; starter_code: string; created_by: string; scan_status: string } | undefined;
    if (!row) { res.status(404).json({ error: 'Not Found' }); return; }
    if (row.created_by !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (row.scan_status === 'flagged') {
      res.status(409).json({ error: 'Conflict', message: 'Problem has open scanner findings; resolve before publishing.' });
      return;
    }
    const frozen = { title: row.title, statement: row.statement, starter_code: row.starter_code };
    const now = Date.now();
    await client.execute(
      `UPDATE problems
         SET published_json = ?,
             first_published_at = COALESCE(first_published_at, ?),
             last_published_at = ?,
             public_status = 'unlisted'
       WHERE id = ?`,
      [JSON.stringify(frozen), now, now, row.id],
    );
    res.status(204).end();
  });

  // Author asks for a published problem to be listed on the public
  // sidebar. Same gate as project snapshots: scan clean + distinct-viewer
  // threshold. Reviewer approves via /api/moderation/... (once wired).
  router.post('/teacher/problems/:slug/request-public', teacherOnly, teacherProblemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      `SELECT id, created_by, scan_status, public_status, published_json, distinct_view_count
         FROM problems WHERE slug = ? AND archived = 0`,
      [req.params.slug],
    )).rows[0] as { id: number; created_by: string; scan_status: string; public_status: string; published_json: string | null; distinct_view_count: number } | undefined;
    if (!row) { res.status(404).json({ error: 'Not Found' }); return; }
    if (row.created_by !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!row.published_json) {
      res.status(409).json({ error: 'Conflict', message: 'Publish a frozen copy first.' });
      return;
    }
    if (row.scan_status !== 'clean') {
      res.status(409).json({ error: 'Conflict', message: 'Problem has open scanner findings' });
      return;
    }
    if (row.public_status !== 'unlisted') {
      res.status(409).json({ error: 'Conflict', message: `Cannot request from status '${row.public_status}'` });
      return;
    }
    const PROBLEM_REQUEST_VIEW_THRESHOLD = 5;
    if (row.distinct_view_count < PROBLEM_REQUEST_VIEW_THRESHOLD) {
      res.status(409).json({
        error: 'Conflict',
        message: `Need at least ${PROBLEM_REQUEST_VIEW_THRESHOLD} distinct viewers before requesting public listing (currently ${row.distinct_view_count}).`,
      });
      return;
    }
    await client.execute(
      "UPDATE problems SET public_status = 'pending_review' WHERE id = ?",
      [row.id],
    );
    res.status(204).end();
  });

  // Aggregate stat only — no enumeration of which users solved.
  router.get('/problems/:slug/solve-count', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ?',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!problem) { res.status(404).json({ error: 'Not Found' }); return; }
    const row = (await client.execute(
      `SELECT COUNT(DISTINCT user_id) as n FROM submissions
         WHERE problem_id = ? AND verdict = 'accepted'`,
      [problem.id],
    )).rows[0] as { n: number };
    res.json({ slug: req.params.slug, solve_count: row.n });
  });

  router.post('/teacher/problems/:slug/archive', teacherOnly, teacherProblemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `UPDATE problems SET archived = 1, updated_at = datetime('now') WHERE slug = ? AND created_by = ?`,
      [req.params.slug, req.user!.id],
    );
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    res.status(204).end();
  });

  router.get('/teacher/problems/:slug/submissions', teacherOnly, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ?',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await client.execute(
      `SELECT DISTINCT s.*, u.name as user_name, u.handle as user_handle
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN group_members gm ON gm.student_id = s.user_id
       JOIN groups g ON g.id = gm.group_id AND g.teacher_id = ?
       WHERE s.problem_id = ?
       ORDER BY s.ts DESC
       LIMIT ?`,
      [req.user!.id, problem.id, limit],
    );
    res.json(result.rows);
  });

  return router;
}
