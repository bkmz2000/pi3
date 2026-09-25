import { describe, it, expect, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { getClient, setTestClient, closeClient, initDb, resetDatabase, createDatabase } from '../db/index.js';
import { createSqliteClient } from '../db/sqlite-shim.js';
import { assertMigrationSet } from '../db/migrationSafety.js';

afterEach(() => {
  setTestClient(undefined);
  closeClient();
});

describe('server/db/index', () => {
  it('setTestClient makes getClient return the injected client', () => {
    const db = new Database(':memory:');
    const client = createSqliteClient(db);
    setTestClient(client);
    expect(getClient()).toBe(client);
    db.close();
  });

  it('closeClient tears down references', () => {
    const db = new Database(':memory:');
    const client = createSqliteClient(db);
    setTestClient(client);
    closeClient();
    expect(() => getClient()).toThrow('DB not initialized');
    db.close();
  });

  it('initDb applies schema and migrations end-to-end on an in-memory DB', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);
    await createDatabase();
    const userCols = (await client.execute("PRAGMA table_info('users')")).rows.map(r => r['name']);
    const projCols = (await client.execute("PRAGMA table_info('projects')")).rows.map(r => r['name']);
    const groupCols = (await client.execute("PRAGMA table_info('groups')")).rows.map(r => r['name']);
    const canaryTables = (await client.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'canary_tokens'")).rows;
    expect(userCols).toEqual(expect.arrayContaining(['handle', 'handle_seq']));
    expect(projCols).toEqual(expect.arrayContaining(['sounds', 'tilemaps', 'animations']));
    expect(groupCols).toEqual(expect.arrayContaining(['invite_code', 'archived_at']));
    expect(canaryTables).toHaveLength(1);
    db.close();
  });

  it('applies the canary migration to an existing database without changing project data', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);
    await createDatabase();
    const now = Date.now();
    db.prepare('INSERT INTO users (id, api_token, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('migration-user', 'migration-token', 'Migration User', 'student', now, now);
    db.prepare(`INSERT INTO projects (id, user_id, name, files, assets, tilemaps, animations, sounds, current_file, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, '{}', '{}', '{}', '{}', 'main.py', 1, ?, ?)`)
      .run('migration-project', 'migration-user', 'Migration Project', JSON.stringify({ 'main.py': 'print(42)' }), now, now);
    const before = db.prepare('SELECT id, user_id, name, files, version FROM projects WHERE id = ?')
      .get('migration-project') as Record<string, unknown>;

    db.exec('DROP TABLE canary_tokens');
    db.prepare('DELETE FROM schema_migrations WHERE filename = ?').run('014_canary_tokens.sql');
    await initDb();

    const after = db.prepare('SELECT id, user_id, name, files, version FROM projects WHERE id = ?')
      .get('migration-project') as Record<string, unknown>;
    expect(after).toEqual(before);
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    expect(integrity[0].integrity_check).toBe('ok');
    expect(db.prepare('SELECT count(*) n FROM users').get()).toMatchObject({ n: 1 });
    expect(db.prepare('SELECT count(*) n FROM projects').get()).toMatchObject({ n: 1 });
    expect(db.prepare("SELECT filename FROM schema_migrations WHERE filename = '014_canary_tokens.sql'").get()).toBeDefined();
    db.close();
  });

  it('initDb is idempotent (re-running is safe via schema_migrations tracking)', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);
    await createDatabase();
    await expect(initDb()).resolves.not.toThrow();
    db.close();
  });

  it('accepts expected candidate migrations and rejects missing or unexpected migration records', () => {
    const before = ['001_initial.sql', '013_presence.sql'];
    const candidate = [...before, '014_canary_tokens.sql'];
    expect(() => assertMigrationSet(candidate, candidate, before)).not.toThrow();
    expect(() => assertMigrationSet(before, candidate, before)).toThrow(/candidate migrations not applied/);
    expect(() => assertMigrationSet(['001_initial.sql'], candidate, before)).toThrow(/lost baseline migrations/);
    expect(() => assertMigrationSet([...candidate, '999_unknown.sql'], candidate, before)).toThrow(/absent from candidate/);
  });

  it('resetDatabase drops the user-facing tables', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);
    await createDatabase();
    await resetDatabase();
    const tables = (await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table'",
    )).rows.map(r => r['name']);
    expect(tables).not.toContain('users');
    expect(tables).not.toContain('projects');
    expect(tables).not.toContain('groups');
    expect(tables).not.toContain('canary_tokens');
    db.close();
  });
});
