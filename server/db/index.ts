import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  const sql = readFileSync(schemaPath, 'utf8');
  database.exec(sql);
}

export function resetDatabase(): void {
  const database = getDb();
  database.exec(`
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
