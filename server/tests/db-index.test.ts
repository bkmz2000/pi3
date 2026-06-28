import { describe, it, expect, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { getClient, setTestClient, closeClient, initDb, resetDatabase, createDatabase } from '../db/index.js';
import { createSqliteClient } from '../db/sqlite-shim.js';

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
    expect(userCols).toEqual(expect.arrayContaining(['handle', 'handle_seq']));
    expect(projCols).toEqual(expect.arrayContaining(['sounds', 'tilemaps', 'animations']));
    expect(groupCols).toEqual(expect.arrayContaining(['invite_code', 'archived_at']));
    db.close();
  });

  it('initDb is idempotent (re-running swallows already-exists errors)', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);
    await createDatabase();
    await expect(initDb()).resolves.not.toThrow();
    db.close();
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
    db.close();
  });
});
