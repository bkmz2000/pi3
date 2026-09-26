#!/usr/bin/env node
// Run only inside an isolated candidate image against a disposable copy of the
// verified predeploy SQLite snapshot. Never pass the host production DB here.
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { initDb } from '../dist-server/db/index.js';
import { assertMigrationSet } from '../dist-server/db/migrationSafety.js';

const [dbPath, metadataPath] = process.argv.slice(2);
if (!dbPath || !metadataPath || process.env.DB_PATH !== dbPath || process.env.TURSO_DATABASE_URL) {
  throw new Error('Disposable DB_PATH and metadata are required; remote DB credentials are forbidden');
}
const expected = JSON.parse(readFileSync(metadataPath, 'utf8'));
const count = (db, table) => db.prepare(`SELECT count(*) n FROM "${table}"`).get().n;
const migrationNames = (db) => db.prepare('SELECT filename FROM schema_migrations ORDER BY filename').all().map((row) => row.filename);
const projectHash = (db) => {
  const row = db.prepare('SELECT id,name,user_id,version,files,assets,tilemaps,sounds,sheet,current_file FROM projects WHERE id=?').get(expected.canary.id);
  if (!row) throw new Error('Predeploy canary project is missing');
  return createHash('sha256').update(JSON.stringify([
    row.id, row.name, row.user_id, row.version, row.files, row.assets,
    row.tilemaps, row.sounds, row.sheet, row.current_file,
  ])).digest('hex');
};
const check = (db, beforeMigration) => {
  if (db.pragma('integrity_check')[0].integrity_check !== 'ok'
    || count(db, 'projects') !== expected.projects || count(db, 'users') !== expected.users
    || projectHash(db) !== expected.canary.contentSha256) {
    throw new Error(`Candidate migration dry-run ${beforeMigration ? 'source' : 'result'} differs from verified snapshot`);
  }
  const names = migrationNames(db);
  if (beforeMigration) {
    if (names.length !== expected.migrations || JSON.stringify(names) !== JSON.stringify(expected.migrationNames)) {
      throw new Error('Disposable snapshot migration baseline differs from verified source');
    }
  } else {
    const available = readdirSync(new URL('../dist-server/db/migrations/', import.meta.url))
      .filter((name) => name.endsWith('.sql')).sort();
    assertMigrationSet(names, available, expected.migrationNames);
    if (count(db, 'schema_migrations') !== names.length) throw new Error('Candidate migration tracking count mismatch');
  }
};

const before = new Database(dbPath, { readonly: true });
try { check(before, true); } finally { before.close(); }
await initDb();
const after = new Database(dbPath, { readonly: true });
try { check(after, false); } finally { after.close(); }
console.log('Candidate migrations passed on isolated predeploy snapshot; projects and users unchanged.');
