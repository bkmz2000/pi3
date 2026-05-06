import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '../../pi3.db');

let db: Database.Database | undefined;
let testDb: Database.Database | undefined;

export function getDb(): Database.Database {
  if (testDb) return testDb;
  if (!db) {
    db = new Database(DB_PATH);
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

export function runMigrations(): void {
  const db = getDb();
  const migrationsDir = join(__dirname, 'migrations');

  db.exec(`
    CREATE TABLE IF NOT EXISTS db_version (
      version INTEGER PRIMARY KEY
    )
  `);

  const currentVersion = db
    .prepare('SELECT version FROM db_version ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined;

  const version = currentVersion?.version ?? 0;

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const fileVersionStr = file.split('_')[0];
    const fileVersion = parseInt(fileVersionStr || '0', 10);
    if (fileVersion > version) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      db.exec(sql);
      db.prepare('INSERT INTO db_version (version) VALUES (?)').run(fileVersion);
      console.log(`Applied migration ${file}`);
    }
  }
}

export function resetDatabase(): void {
  const database = getDb();
  database.exec(`
    DROP TABLE IF EXISTS project_shares;
    DROP TABLE IF EXISTS files;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS db_version;
  `);
}

export function createDatabase(): void {
  resetDatabase();
  runMigrations();
}

export default { getDb, closeDb, runMigrations, resetDatabase, createDatabase };
