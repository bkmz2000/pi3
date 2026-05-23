import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { backfillHandles } from './handle.js';

let db: Database.Database | undefined;
let testDb: Database.Database | undefined;

export function getDb(): Database.Database {
  if (testDb) return testDb;
  if (!db) {
    const dbPath = process.env.DB_PATH || join(process.cwd(), 'pi3.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function setTestDb(newDb: Database.Database | undefined): void {
  testDb = newDb;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = undefined;
  }
  testDb = undefined;
}

export function initDb(): void {
  const database = getDb();
  const schemaPath = join(process.cwd(), 'server/db/migrations/001_initial.sql');
  database.exec(readFileSync(schemaPath, 'utf8'));
  const schema2Path = join(process.cwd(), 'server/db/migrations/002_teacher_dashboard.sql');
  database.exec(readFileSync(schema2Path, 'utf8'));

  // Migrate existing databases that lack newer columns
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
  ];
  for (const stmt of migrations) {
    try {
      database.exec(stmt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Swallow "already exists" idempotency errors; surface real failures
      if (!msg.includes('already exists') && !msg.includes('duplicate column')) {
        console.error('Migration failed:', stmt, err);
        throw err;
      }
    }
  }
  // Backfill handles for any users created before the handle column existed.
  // Idempotent: rows with non-null handle are skipped.
  try {
    backfillHandles(database);
  } catch (err) {
    console.error('Handle backfill failed:', err);
  }
}

export function resetDatabase(): void {
  const database = getDb();
  database.exec(`
    DROP TABLE IF EXISTS help_requests;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS group_members;
    DROP TABLE IF EXISTS groups;
    DROP TABLE IF EXISTS project_shares;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS users;
  `);
}

export function createDatabase(): void {
  resetDatabase();
  initDb();
}

export default { getDb, closeDb, initDb, resetDatabase, createDatabase };
