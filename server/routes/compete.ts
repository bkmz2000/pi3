import { Router, Request, Response, NextFunction } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware, AuthUser } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { scanSnapshot } from '../snapshots/scanner.js';

// SPP-8: 30 problem writes per hour per account (author + edit + import
// share the same bucket).
const problemWriteLimit = rateLimit({ name: 'problem-write', windowMs: 3600_000, max: 30 });

// Column list for problems that intentionally omits `created_by`, per
// Phase 9 doctrine: author-project linkage is internal-only and must never
// appear in any response body. Every teacher-facing SELECT uses this list.
const PROBLEM_PUBLIC_COLUMNS = `
  id, slug, title, statement, order_index, starter_code, archived,
  created_at, updated_at, generator_py, reference_solution_py, checker_py,
  source, scan_status, scan_findings,
  public_status, published_json, first_published_at, last_published_at, distinct_view_count
`;

// SPP-5 (B): distinct-viewer gate for request-public. Same threshold as
// snapshots.ts:10.
const PROBLEM_PUBLIC_REQUEST_VIEW_THRESHOLD = 5;

interface PublishedSnapshot {
  title: string;
  statement: string;
  starter_code: string;
  checker_py: string | null;
  tests: { ordinal: number; tier: number; is_visible: number; input: string; expected: string; fields_json: string | null }[];
}

async function freezeProblemSnapshot(client: ReturnType<typeof getClient>, problemId: number): Promise<PublishedSnapshot> {
  const row = (await client.execute(
    'SELECT title, statement, starter_code, checker_py FROM problems WHERE id = ?',
    [problemId],
  )).rows[0] as { title: string; statement: string; starter_code: string; checker_py: string | null } | undefined;
  if (!row) throw new Error(`problem ${problemId} not found during snapshot freeze`);
  const tests = (await client.execute(
    `SELECT ordinal, tier, is_visible, input, expected, fields_json
     FROM problem_tests WHERE problem_id = ? ORDER BY ordinal ASC`,
    [problemId],
  )).rows as unknown as PublishedSnapshot['tests'];
  return { title: row.title, statement: row.statement, starter_code: row.starter_code, checker_py: row.checker_py, tests };
}

// Runs the pre-share content scanner over the full raw text of a problem
// authoring payload (SPP-6: no carve-outs). Returns scan_status + JSON of
// findings, both safe to persist into `problems.scan_status` /
// `problems.scan_findings`.
function scanProblemPayload(payload: {
  title: string;
  statement: string;
  starter_code?: string | null;
  generator_py?: string | null;
  reference_solution_py?: string | null;
  checker_py?: string | null;
  tests: { input: string; expected: string }[];
}): { status: 'clean' | 'flagged'; findings_json: string } {
  const files: Record<string, string> = {
    'statement.md': payload.statement,
    'starter.py': payload.starter_code ?? '',
    'generator.py': payload.generator_py ?? '',
    'reference.py': payload.reference_solution_py ?? '',
    'checker.py': payload.checker_py ?? '',
  };
  payload.tests.forEach((t, i) => {
    files[`tests/${i}.in`] = t.input ?? '';
    files[`tests/${i}.out`] = t.expected ?? '';
  });
  const scan = scanSnapshot({ title: payload.title, files });
  return { status: scan.status, findings_json: JSON.stringify(scan.findings) };
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

// Any authenticated account. Problem authoring is open under the redesigned
// model (SPP-1: no persistent roles) — safety
// is enforced by the pre-share content scanner (Phase 6, server/snapshots/
// scanner.ts, wired into POST/PUT problem endpoints in this file) and the
// human review gate, not by role. Write endpoints below add their own
// ownership check via `created_by` where mutation semantics require it.
function authedOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// Ownership check for mutating an existing problem. Any authed user can
// author a problem; only the original author can edit or archive it.
async function requireProblemOwnership(req: Request, res: Response, problemId: number): Promise<boolean> {
  const client = getClient();
  const row = (await client.execute(
    'SELECT created_by FROM problems WHERE id = ?',
    [problemId],
  )).rows[0] as { created_by: string } | undefined;
  if (!row) {
    res.status(404).json({ error: 'Not Found' });
    return false;
  }
  if (row.created_by !== req.user!.id) {
    res.status(403).json({ error: 'Forbidden', message: 'Only the problem author can modify it' });
    return false;
  }
  return true;
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

  // SPP-5 (B): every public read below serves the frozen `published_json`
  // (not the mutable draft row) and requires `public_status='approved'`.
  // The owner can preview an unapproved draft with `?preview=1`.
  //
  // The sidebar list only shows problems that have an approved publication.
  router.get('/problems', async (_req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT id, slug, title, order_index
       FROM problems
       WHERE archived = 0 AND public_status = 'approved' AND published_json IS NOT NULL
       ORDER BY order_index ASC, id ASC`,
    );
    res.json(result.rows);
  });

  // Full problem — visible tests only. Served from the immutable snapshot,
  // not the draft row. Distinct viewers are counted for the view gate.
  router.get('/problems/:slug', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      `SELECT id, slug, order_index, public_status, published_json, created_by
       FROM problems WHERE slug = ? AND archived = 0`,
      [req.params.slug],
    )).rows[0] as { id: number; slug: string; order_index: number; public_status: string; published_json: string | null; created_by: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const isPreview = req.query.preview === '1';
    const isOwnerPreview = isPreview && req.user!.id === row.created_by;
    if (row.public_status !== 'approved' || !row.published_json) {
      if (!isOwnerPreview) {
        res.status(404).json({ error: 'Not Found' });
        return;
      }
    }
    const source: PublishedSnapshot | null = row.published_json
      ? JSON.parse(row.published_json) as PublishedSnapshot
      : null;
    // Owner preview of a draft that has never been published falls through
    // to reading the mutable row.
    const problem = source
      ? {
          id: row.id, slug: row.slug, order_index: row.order_index,
          title: source.title, statement: source.statement,
          starter_code: source.starter_code, checker_py: source.checker_py,
        }
      : await (async () => {
          const draft = (await client.execute(
            'SELECT id, slug, title, statement, starter_code, order_index, checker_py FROM problems WHERE id = ?',
            [row.id],
          )).rows[0] as unknown as Problem;
          return draft;
        })();
    const visibleTests = source
      ? source.tests.filter(t => t.is_visible === 1).map(({ ordinal, tier, input, expected }) => ({ ordinal, tier, input, expected }))
      : (await client.execute(
          `SELECT id, ordinal, tier, input, expected FROM problem_tests
           WHERE problem_id = ? AND is_visible = 1 ORDER BY ordinal ASC`,
          [row.id],
        )).rows;
    // SPP-5 distinct-view counter: don't count the owner's own preview.
    if (!isOwnerPreview && row.public_status === 'approved') {
      const insertResult = await client.execute(
        `INSERT OR IGNORE INTO problem_views (problem_id, viewer_id, first_viewed_at) VALUES (?, ?, ?)`,
        [row.id, req.user!.id, Date.now()],
      );
      if (insertResult.rowsAffected > 0) {
        await client.execute(
          'UPDATE problems SET distinct_view_count = distinct_view_count + 1 WHERE id = ?',
          [row.id],
        );
      }
    }
    res.json({ ...problem, visibleTests });
  });

  // All tests for submit runner — served from immutable snapshot.
  router.get('/problems/:slug/tests-for-submit', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT id, public_status, published_json, created_by FROM problems WHERE slug = ? AND archived = 0',
      [req.params.slug],
    )).rows[0] as { id: number; public_status: string; published_json: string | null; created_by: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const isPreview = req.query.preview === '1' && req.user!.id === row.created_by;
    if (row.public_status !== 'approved' && !isPreview) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (row.published_json) {
      const snap = JSON.parse(row.published_json) as PublishedSnapshot;
      res.json(snap.tests.map(({ ordinal, tier, is_visible, input, expected, fields_json }) => ({
        ordinal, tier, is_visible, input, expected, fields_json,
      })));
      return;
    }
    // Owner previewing a draft.
    const tests = (await client.execute(
      `SELECT id, ordinal, tier, is_visible, input, expected, fields_json
       FROM problem_tests WHERE problem_id = ? ORDER BY tier ASC, ordinal ASC`,
      [row.id],
    )).rows;
    res.json(tests);
  });

  // Store a submission. Only works against approved problems.
  router.post('/problems/:slug/submit', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      `SELECT id FROM problems WHERE slug = ? AND archived = 0
         AND public_status = 'approved' AND published_json IS NOT NULL`,
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

  router.get('/teacher/problems', authedOnly, async (_req: Request, res: Response): Promise<void> => {
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

  router.get('/teacher/problems/:slug', authedOnly, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      `SELECT ${PROBLEM_PUBLIC_COLUMNS} FROM problems WHERE slug = ?`,
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

  router.post('/teacher/problems', authedOnly, problemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const validationError = validateProblemBody(req.body);
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }
    const { slug, title, statement, starter_code, order_index, tests, generator_py, reference_solution_py, checker_py, source } = req.body as {
      slug: string; title: string; statement: string;
      starter_code?: string; order_index?: number; tests: TestInput[];
      generator_py?: string | null; reference_solution_py?: string | null; checker_py?: string | null;
      source?: string | null;
    };
    const client = getClient();
    const existing = (await client.execute('SELECT id FROM problems WHERE slug = ?', [slug])).rows[0];
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'slug already exists' });
      return;
    }
    const scan = scanProblemPayload({
      title, statement, starter_code, generator_py, reference_solution_py, checker_py, tests,
    });
    const insertResult = await client.execute(
      `INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by,
                             generator_py, reference_solution_py, checker_py,
                             source, scan_status, scan_findings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, title.trim(), statement.trim(), starter_code ?? '', order_index ?? 0, (req.user as AuthUser).id,
       generator_py ?? null, reference_solution_py ?? null, checker_py ?? null,
       source ?? null, scan.status, scan.findings_json],
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
    const problem = (await client.execute(
      `SELECT ${PROBLEM_PUBLIC_COLUMNS} FROM problems WHERE id = ?`,
      [problemId],
    )).rows[0];
    res.status(201).json(problem);
  });

  router.put('/teacher/problems/:slug', authedOnly, problemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const validationError = validateProblemBody({ ...req.body, slug: req.params.slug });
    if (validationError) {
      res.status(400).json({ error: 'Bad Request', message: validationError });
      return;
    }
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ?',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (!(await requireProblemOwnership(req, res, problem.id))) return;
    const { title, statement, starter_code, order_index, tests, generator_py, reference_solution_py, checker_py, source } = req.body as {
      title: string; statement: string; starter_code?: string; order_index?: number; tests: TestInput[];
      generator_py?: string | null; reference_solution_py?: string | null; checker_py?: string | null;
      source?: string | null;
    };
    const scan = scanProblemPayload({
      title, statement, starter_code, generator_py, reference_solution_py, checker_py, tests,
    });
    // SPP-5 (B): editing the draft invalidates any prior approval — the
    // frozen `published_json` is cleared and public_status resets to
    // 'unlisted'. Mirrors project snapshots, where a new snapshot always
    // needs a new share link. To re-publish, owner calls the publish
    // endpoint again and goes through review.
    await client.execute(
      `UPDATE problems SET title = ?, statement = ?, starter_code = ?, order_index = ?,
         generator_py = ?, reference_solution_py = ?, checker_py = ?,
         source = ?, scan_status = ?, scan_findings = ?,
         public_status = 'unlisted', published_json = NULL,
         updated_at = datetime('now')
       WHERE id = ?`,
      [title.trim(), statement.trim(), starter_code ?? '', order_index ?? 0,
       generator_py ?? null, reference_solution_py ?? null, checker_py ?? null,
       source ?? null, scan.status, scan.findings_json, problem.id],
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
      `SELECT ${PROBLEM_PUBLIC_COLUMNS},
        (SELECT COUNT(*) FROM problem_tests WHERE problem_id = problems.id) as test_count
       FROM problems WHERE id = ?`,
      [problem.id],
    )).rows[0];
    res.json(updated);
  });

  router.post('/teacher/problems/import', authedOnly, problemWriteLimit, async (req: Request, res: Response): Promise<void> => {
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
        const existing = (await client.execute(
          'SELECT id FROM problems WHERE slug = ?', [slug],
        )).rows[0] as { id: number } | undefined;

        if (existing && !overwrite) {
          skipped.push(id);
          continue;
        }

        // SPP-6 (E): scanner runs on every import path, same shape as the
        // POST/PUT authoring endpoints. Without this, importer-authored
        // problems reached the public listing with `scan_status='pending'`
        // and never went through the review pipeline.
        const scan = scanProblemPayload({
          title: title.trim(),
          statement,
          starter_code: '',
          generator_py: null,
          reference_solution_py: null,
          checker_py: null,
          tests,
        });

        if (existing) {
          await client.execute(
            `UPDATE problems SET title = ?, statement = ?, scan_status = ?, scan_findings = ?, updated_at = datetime('now') WHERE id = ?`,
            [title.trim(), statement, scan.status, scan.findings_json, existing.id],
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
            `INSERT INTO problems (slug, title, statement, starter_code, order_index, created_by, scan_status, scan_findings)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [slug, title.trim(), statement, '', nextOrder++, (req.user as AuthUser).id, scan.status, scan.findings_json],
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

  // SPP-5 (B): publish freezes the current draft into `published_json`,
  // re-runs the scanner, and sets public_status='unlisted'. Approval to
  // 'approved' happens via the moderation queue.
  router.post('/teacher/problems/:slug/publish', authedOnly, problemWriteLimit, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT id FROM problems WHERE slug = ? AND archived = 0',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (!(await requireProblemOwnership(req, res, row.id))) return;
    const snap = await freezeProblemSnapshot(client, row.id);
    // Re-scan the frozen payload, mirroring project snapshots which are
    // scanned at publish time even if the draft was scanned earlier.
    const scan = scanProblemPayload({
      title: snap.title, statement: snap.statement, starter_code: snap.starter_code,
      generator_py: null, reference_solution_py: null, checker_py: snap.checker_py,
      tests: snap.tests.map(t => ({ input: t.input, expected: t.expected })),
    });
    const now = Date.now();
    await client.execute(
      `UPDATE problems SET published_json = ?, public_status = 'unlisted',
         first_published_at = COALESCE(first_published_at, ?),
         last_published_at = ?,
         scan_status = ?, scan_findings = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(snap), now, now, scan.status, scan.findings_json, row.id],
    );
    const updated = (await client.execute(
      `SELECT ${PROBLEM_PUBLIC_COLUMNS} FROM problems WHERE id = ?`,
      [row.id],
    )).rows[0];
    res.status(201).json(updated);
  });

  // SPP-5 (B): owner requests promotion from 'unlisted' to 'pending_review'
  // once (a) scanner is clean and (b) distinct-view count clears the
  // threshold. Same shape as snapshots.ts:159-201.
  router.post('/teacher/problems/:slug/request-public', authedOnly, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      `SELECT id, public_status, scan_status, distinct_view_count, published_json
       FROM problems WHERE slug = ? AND archived = 0`,
      [req.params.slug],
    )).rows[0] as { id: number; public_status: string; scan_status: string; distinct_view_count: number; published_json: string | null } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (!(await requireProblemOwnership(req, res, row.id))) return;
    if (!row.published_json) {
      res.status(409).json({ error: 'Conflict', message: 'Publish the problem first' });
      return;
    }
    if (row.public_status !== 'unlisted') {
      res.status(409).json({ error: 'Conflict', message: `Cannot request from status '${row.public_status}'` });
      return;
    }
    if (row.scan_status !== 'clean') {
      res.status(409).json({ error: 'Conflict', message: 'Snapshot has open scanner findings' });
      return;
    }
    if (row.distinct_view_count < PROBLEM_PUBLIC_REQUEST_VIEW_THRESHOLD) {
      res.status(409).json({
        error: 'Conflict',
        message: `Need at least ${PROBLEM_PUBLIC_REQUEST_VIEW_THRESHOLD} distinct viewers before requesting public listing (currently ${row.distinct_view_count}).`,
      });
      return;
    }
    await client.execute(
      "UPDATE problems SET public_status = 'pending_review' WHERE id = ?",
      [row.id],
    );
    res.status(204).end();
  });

  router.post('/teacher/problems/:slug/archive', authedOnly, async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const row = (await client.execute(
      'SELECT id FROM problems WHERE slug = ?',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    if (!(await requireProblemOwnership(req, res, row.id))) return;
    await client.execute(
      `UPDATE problems SET archived = 1, updated_at = datetime('now') WHERE id = ?`,
      [row.id],
    );
    res.status(204).end();
  });

  // Aggregate solve count per problem — public. Returns *only* the number of
  // distinct users who have earned any stars for the problem. No solver list,
  // no leaderboard, no identity, per Phase 9 SPP-3 aggregate-only clause.
  router.get('/problems/:slug/solve-count', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const problem = (await client.execute(
      'SELECT id FROM problems WHERE slug = ? AND archived = 0',
      [req.params.slug],
    )).rows[0] as { id: number } | undefined;
    if (!problem) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }
    const row = (await client.execute(
      'SELECT COUNT(DISTINCT user_id) as count FROM submissions WHERE problem_id = ? AND stars > 0',
      [problem.id],
    )).rows[0] as { count: number };
    res.json({ solve_count: row.count });
  });

  router.get('/teacher/problems/:slug/submissions', authedOnly, async (req: Request, res: Response): Promise<void> => {
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
    // Scope to submissions from students in groups owned by the requesting teacher.
    // Without this, any teacher could read any student's submissions platform-wide.
    //
    // Only user_handle is returned — never u.name (Safety & Privacy Design
    // SPP-2: no PII from students, ever). Handle is the sole identifier.
    const result = await client.execute(
      `SELECT DISTINCT s.*, u.handle as user_handle
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
