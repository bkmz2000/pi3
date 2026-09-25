#!/usr/bin/env node
// Local release gate: exercise the same verifier shipped in the candidate image
// against an isolated SQLite fixture with one unapplied candidate migration.
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { initDb } from '../dist-server/db/index.js';

const dir = mkdtempSync(join(tmpdir(), 'pi3-candidate-migration-'));
const originalPath = join(dir, 'original.db');
const copyPath = join(dir, 'dry-run.db');
const containerCopyPath = join(dir, 'container-source.db');
const metadataPath = join(dir, 'metadata.json');
const priorDbPath = process.env.DB_PATH;
try {
  process.env.DB_PATH = originalPath;
  await initDb();
  const db = new Database(originalPath);
  const now = Date.now();
  db.prepare('INSERT INTO users (id, api_token, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('fixture-user', 'fixture-token', 'Fixture', now, now);
  db.prepare('INSERT INTO projects (id, user_id, name, files, assets, tilemaps, sounds, sheet, current_file, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('fixture-project', 'fixture-user', 'Fixture project', '{"main.py":"print(42)"}', '{}', '{}', '{}', null, 'main.py', now, now);
  db.exec("DROP TABLE canary_tokens; DELETE FROM schema_migrations WHERE filename = '014_canary_tokens.sql'");
  const project = db.prepare('SELECT id,name,user_id,version,files,assets,tilemaps,sounds,sheet,current_file FROM projects WHERE id=?').get('fixture-project');
  const contentSha256 = createHash('sha256').update(JSON.stringify([
    project.id, project.name, project.user_id, project.version, project.files, project.assets,
    project.tilemaps, project.sounds, project.sheet, project.current_file,
  ])).digest('hex');
  const names = db.prepare('SELECT filename FROM schema_migrations ORDER BY filename').all().map((row) => row.filename);
  writeFileSync(metadataPath, JSON.stringify({
    users: 1, projects: 1, migrations: names.length, migrationNames: names,
    canary: { id: project.id, contentSha256 },
  }));
  await db.backup(copyPath);
  await db.backup(containerCopyPath);
  db.close();

  const result = spawnSync(process.execPath, ['scripts/verify-candidate-migrations.mjs', copyPath, metadataPath], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DB_PATH: copyPath, TURSO_DATABASE_URL: '' },
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(`Candidate migration fixture failed: ${result.stderr || result.stdout}`);
  const migrated = new Database(copyPath, { readonly: true });
  try {
    if (!migrated.prepare("SELECT 1 FROM schema_migrations WHERE filename = '014_canary_tokens.sql'").get()) {
      throw new Error('Candidate migration was not applied to the disposable copy');
    }
  } finally { migrated.close(); }
  const source = new Database(originalPath, { readonly: true });
  try {
    if (source.prepare("SELECT 1 FROM schema_migrations WHERE filename = '014_canary_tokens.sql'").get()) {
      throw new Error('Dry-run modified the source database');
    }
  } finally { source.close(); }

  if (process.env.PI3_TEST_CANDIDATE_IMAGE) {
    const image = process.env.PI3_TEST_CANDIDATE_IMAGE;
    const container = spawnSync('docker', [
      'run', '--rm', '--network', 'none', '--read-only', '--user', '0',
      '--tmpfs', '/app/db:rw,mode=0700,size=1g', '--tmpfs', '/tmp:rw,mode=0700,size=64m',
      '--mount', `type=bind,src=${containerCopyPath},dst=/snapshot/pi3.db,readonly`,
      '--mount', `type=bind,src=${metadataPath},dst=/snapshot/metadata.json,readonly`,
      '-e', 'DB_PATH=/app/db/pi3.db', '--entrypoint', '/bin/sh', image,
      '-ec', 'cp /snapshot/pi3.db /app/db/pi3.db && exec node /app/scripts/verify-candidate-migrations.mjs /app/db/pi3.db /snapshot/metadata.json',
    ], { encoding: 'utf8' });
    if (container.status !== 0) throw new Error(`Container migration dry-run failed: ${container.stderr || container.stdout}`);
    const unchanged = new Database(containerCopyPath, { readonly: true });
    try {
      if (unchanged.prepare("SELECT 1 FROM schema_migrations WHERE filename = '014_canary_tokens.sql'").get()) {
        throw new Error('Container dry-run modified the read-only source snapshot');
      }
    } finally { unchanged.close(); }
  }

  const invalid = JSON.parse(readFileSync(metadataPath, 'utf8'));
  invalid.canary.contentSha256 = '0'.repeat(64);
  writeFileSync(metadataPath, JSON.stringify(invalid));
  const rejected = spawnSync(process.execPath, ['scripts/verify-candidate-migrations.mjs', copyPath, metadataPath], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DB_PATH: copyPath, TURSO_DATABASE_URL: '' },
    encoding: 'utf8',
  });
  if (rejected.status === 0) throw new Error('Candidate verifier accepted a tampered baseline');
  console.log('Candidate migration dry-run fixture passed (apply, source isolation, tamper rejection).');
} finally {
  if (priorDbPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = priorDbPath;
  rmSync(dir, { recursive: true, force: true });
}
