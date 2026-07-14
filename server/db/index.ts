import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { backfillHandles } from './handle.js';
import { createLibsqlClient } from './libsql.js';
import { createSqliteClient } from './sqlite-shim.js';
import type { DbClient } from './client.js';

// Production client (set by initDb); test client (set by setTestClient in beforeEach).
let _client: DbClient | undefined;
let _testClient: DbClient | undefined;

export function getClient(): DbClient {
  if (_testClient) return _testClient;
  if (_client) return _client;
  throw new Error('DB not initialized. Call await initDb() before handling requests.');
}

export function setTestClient(c: DbClient | undefined): void {
  _testClient = c;
}

export function closeClient(): void {
  _client = undefined;
  _testClient = undefined;
}

async function makeDefaultClient(): Promise<DbClient> {
  if (process.env.TURSO_DATABASE_URL) {
    return createLibsqlClient();
  }
  // Local dev fallback: wrap better-sqlite3 in the async shim.
  // Dynamic import avoids bundling native bindings on Vercel.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: Database } = await import('better-sqlite3') as any;
  const dbPath = process.env.DB_PATH || join(process.cwd(), 'pi3.db');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Database(dbPath) as any;
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return createSqliteClient(db);
}

export async function initDb(): Promise<void> {
  if (!_testClient && !_client) {
    _client = await makeDefaultClient();
  }
  const c = getClient();

  // Schema migration tracking table
  await c.execute(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`,
  );

  // Load and apply file-based migrations with tracking
  const migrationsDir = fileURLToPath(new URL('migrations', import.meta.url));
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = (await c.execute(
      'SELECT 1 FROM schema_migrations WHERE filename = ?',
      [file],
    )).rows[0];
    if (already) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const stmts = splitSql(sql);
    const now = Date.now();

    // Apply migration file + tracking insert in one batch (transactional).
    // If the DB predates migration tracking, ALTER/CREATE may fail as
    // already-present — tolerate those per-statement and still record the
    // migration as applied.
    try {
      await c.batch([
        ...stmts.map(s => ({ sql: s })),
        { sql: 'INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)', args: [file, now] },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('duplicate column')) {
        throw err;
      }
      for (const s of stmts) {
        try { await c.execute(s); }
        catch (e: unknown) {
          const m = e instanceof Error ? e.message : String(e);
          if (!m.includes('already exists') && !m.includes('duplicate column')) throw e;
        }
      }
      await c.execute('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)', [file, now]);
    }
  }

  // Inline migrations for schema elements not yet extracted to migration files.
  // Each is individually guarded to stay idempotent across re-runs.
  const inlineMigrations = [
    // Columns that may pre-date the migration file system
    `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher'))`,
    `ALTER TABLE users ADD COLUMN password_hash TEXT`,
    `ALTER TABLE projects ADD COLUMN files TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE projects ADD COLUMN assets TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE projects ADD COLUMN current_file TEXT NOT NULL DEFAULT 'main.py'`,
    `ALTER TABLE projects ADD COLUMN thumbnail BLOB`,
    `ALTER TABLE projects ADD COLUMN thumbnail_updated_at INTEGER`,
    `ALTER TABLE projects ADD COLUMN sheet TEXT`,
    // Problems / tests / submissions subsystem
    `CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      statement TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      starter_code TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_problems_archived_order ON problems(archived, order_index)`,
    `CREATE TABLE IF NOT EXISTS problem_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      tier INTEGER NOT NULL,
      is_visible INTEGER NOT NULL DEFAULT 0,
      ordinal INTEGER NOT NULL,
      input TEXT NOT NULL,
      expected TEXT NOT NULL,
      UNIQUE(problem_id, ordinal)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tests_problem_tier ON problem_tests(problem_id, tier, ordinal)`,
    `CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      problem_id INTEGER NOT NULL REFERENCES problems(id),
      code TEXT NOT NULL,
      stars INTEGER NOT NULL,
      verdict TEXT NOT NULL,
      failed_test INTEGER,
      failed_tier INTEGER,
      ts TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_user_problem ON submissions(user_id, problem_id, ts DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_submissions_problem ON submissions(problem_id, ts DESC)`,
    `ALTER TABLE problems ADD COLUMN generator_py TEXT NULL`,
    `ALTER TABLE problems ADD COLUMN reference_solution_py TEXT NULL`,
    `ALTER TABLE problems ADD COLUMN checker_py TEXT NULL`,
    `ALTER TABLE problem_tests ADD COLUMN fields_json TEXT NULL`,
    // Problem publish pipeline: bring compete under the same shape as
    // project snapshots (scanner + immutable published copy + review gate).
    `ALTER TABLE problems ADD COLUMN source TEXT`,
    `ALTER TABLE problems ADD COLUMN scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged'))`,
    `ALTER TABLE problems ADD COLUMN scan_findings TEXT`,
    `ALTER TABLE problems ADD COLUMN public_status TEXT NOT NULL DEFAULT 'unlisted' CHECK (public_status IN ('unlisted', 'pending_review', 'approved', 'rejected'))`,
    `ALTER TABLE problems ADD COLUMN published_json TEXT`,
    `ALTER TABLE problems ADD COLUMN first_published_at INTEGER`,
    `ALTER TABLE problems ADD COLUMN last_published_at INTEGER`,
    `ALTER TABLE problems ADD COLUMN distinct_view_count INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS problem_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
      viewer_id TEXT NOT NULL REFERENCES users(id),
      first_viewed_at INTEGER NOT NULL,
      UNIQUE(problem_id, viewer_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_problem_views_problem ON problem_views(problem_id)`,
  ];

  for (const stmt of inlineMigrations) {
    try {
      await c.execute(stmt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Allow duplicate-column / already-exists on re-run; surface everything else
      if (!msg.includes('already exists') && !msg.includes('duplicate column')) {
        console.error('Inline migration failed:', stmt.slice(0, 80), err);
        throw err;
      }
    }
  }

  // Make users.name nullable. SQLite has no DROP NOT NULL — rebuild the
  // table. Idempotent: skips if the current column is already nullable.
  try {
    const cols = (await c.execute(`PRAGMA table_info(users)`)).rows as unknown as Array<{ name: string; notnull: number }>;
    const nameCol = cols.find((r) => r.name === 'name');
    if (nameCol && nameCol.notnull === 1) {
      const hasPasswordHash = cols.some((r) => r.name === 'password_hash');
      const hasHandle = cols.some((r) => r.name === 'handle');
      const hasHandleSeq = cols.some((r) => r.name === 'handle_seq');
      const optCol = (n: string, present: boolean) => (present ? n : `NULL AS ${n}`);
      await c.batch([
        { sql: `CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          api_token TEXT UNIQUE NOT NULL,
          name TEXT,
          role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
          password_hash TEXT,
          handle TEXT,
          handle_seq INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )` },
        { sql: `INSERT INTO users_new (id, api_token, name, role, password_hash, handle, handle_seq, created_at, updated_at)
          SELECT id, api_token, name, role,
                 ${optCol('password_hash', hasPasswordHash)},
                 ${optCol('handle', hasHandle)},
                 ${optCol('handle_seq', hasHandleSeq)},
                 created_at, updated_at FROM users` },
        { sql: `DROP TABLE users` },
        { sql: `ALTER TABLE users_new RENAME TO users` },
        { sql: `CREATE INDEX IF NOT EXISTS idx_users_api_token ON users(api_token)` },
        { sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_lower ON users(lower(handle)) WHERE handle IS NOT NULL` },
        { sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_seq ON users(handle_seq) WHERE handle_seq IS NOT NULL` },
      ]);
    }
  } catch (err) {
    console.error('users.name nullable rebuild failed:', err);
  }

  try {
    await backfillHandles(c);
  } catch (err) {
    console.error('Handle backfill failed:', err);
  }
}

function splitSql(sql: string): string[] {
  // Remove single-line comments (they may contain semicolons that break splitting)
  const noComments = sql.replace(/--.*$/gm, '');
  return noComments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

export async function resetDatabase(): Promise<void> {
  const c = getClient();
  await c.batch([
    { sql: 'DROP TABLE IF EXISTS submissions' },
    { sql: 'DROP TABLE IF EXISTS problem_tests' },
    { sql: 'DROP TABLE IF EXISTS problems' },
    { sql: 'DROP TABLE IF EXISTS help_requests' },
    { sql: 'DROP TABLE IF EXISTS comments' },
    { sql: 'DROP TABLE IF EXISTS group_members' },
    { sql: 'DROP TABLE IF EXISTS groups' },
    { sql: 'DROP TABLE IF EXISTS project_shares' },
    { sql: 'DROP TABLE IF EXISTS projects' },
    { sql: 'DROP TABLE IF EXISTS users' },
    { sql: 'DROP TABLE IF EXISTS schema_migrations' },
  ]);
}

export async function createDatabase(): Promise<void> {
  await resetDatabase();
  await initDb();
}

export default { getClient, closeClient, initDb, resetDatabase, createDatabase };
