import { readFileSync } from 'fs';
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

  const migrationsDir = fileURLToPath(new URL('migrations', import.meta.url));
  const schemaPath = join(migrationsDir, '001_initial.sql');
  const schema2Path = join(migrationsDir, '002_teacher_dashboard.sql');
  for (const stmt of splitSql(readFileSync(schemaPath, 'utf8'))) {
    await swallow(c, stmt);
  }
  for (const stmt of splitSql(readFileSync(schema2Path, 'utf8'))) {
    await swallow(c, stmt);
  }

  const migrations = [
    `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher'))`,
    `ALTER TABLE users ADD COLUMN password_hash TEXT`,
    `ALTER TABLE projects ADD COLUMN files TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE projects ADD COLUMN assets TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE projects ADD COLUMN current_file TEXT NOT NULL DEFAULT 'main.py'`,
    `ALTER TABLE users ADD COLUMN oauth_provider_id TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_provider_id ON users(oauth_provider_id) WHERE oauth_provider_id IS NOT NULL`,
    `ALTER TABLE projects ADD COLUMN tilemaps TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE projects ADD COLUMN animations TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE projects ADD COLUMN sounds TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE users ADD COLUMN handle TEXT`,
    `ALTER TABLE users ADD COLUMN handle_seq INTEGER`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_lower ON users(lower(handle)) WHERE handle IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_seq ON users(handle_seq) WHERE handle_seq IS NOT NULL`,
    `ALTER TABLE groups ADD COLUMN invite_code TEXT`,
    `ALTER TABLE groups ADD COLUMN archived_at INTEGER`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code) WHERE invite_code IS NOT NULL`,
    `ALTER TABLE projects ADD COLUMN thumbnail BLOB`,
    `ALTER TABLE projects ADD COLUMN thumbnail_updated_at INTEGER`,
    `ALTER TABLE projects ADD COLUMN sheet TEXT`,
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
  ];
  for (const stmt of migrations) {
    await swallow(c, stmt);
  }

  try {
    await backfillHandles(c);
  } catch (err) {
    console.error('Handle backfill failed:', err);
  }
}

async function swallow(c: DbClient, sql: string): Promise<void> {
  try {
    await c.execute(sql);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('already exists') && !msg.includes('duplicate column')) {
      console.error('Migration failed:', sql.slice(0, 80), err);
      throw err;
    }
  }
}

function splitSql(sql: string): string[] {
  return sql
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
  ]);
}

export async function createDatabase(): Promise<void> {
  await resetDatabase();
  await initDb();
}

export default { getClient, closeClient, initDb, resetDatabase, createDatabase };
