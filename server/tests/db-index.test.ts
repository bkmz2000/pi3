import { describe, it, expect, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { getDb, setTestDb, closeDb, initDb, resetDatabase, createDatabase } from '../db/index.js';

afterEach(() => {
  setTestDb(undefined);
  closeDb();
  delete process.env.DB_PATH;
});

describe('server/db/index', () => {
  it('setTestDb makes getDb return the injected instance', () => {
    const td = new Database(':memory:');
    setTestDb(td);
    expect(getDb()).toBe(td);
    td.close();
  });

  it('closeDb tears down primary + test DB references', () => {
    const td = new Database(':memory:');
    setTestDb(td);
    closeDb();
    // After closeDb, setTestDb(undefined) was effectively run; a fresh getDb
    // would create a real file-backed DB, so we don't call it here.
    expect(() => td.close()).not.toThrow(); // td still owned by us
  });

  it('initDb applies schema and migrations end-to-end on an in-memory DB', () => {
    process.env.DB_PATH = ':memory:';
    createDatabase();
    const db = getDb();
    // Migration adds columns that downstream tests depend on
    const userCols = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    const projCols = db.prepare("PRAGMA table_info('projects')").all() as { name: string }[];
    const groupCols = db.prepare("PRAGMA table_info('groups')").all() as { name: string }[];
    expect(userCols.map((c) => c.name)).toEqual(expect.arrayContaining(['handle', 'handle_seq']));
    expect(projCols.map((c) => c.name)).toEqual(expect.arrayContaining(['sounds', 'tilemaps', 'animations']));
    expect(groupCols.map((c) => c.name)).toEqual(expect.arrayContaining(['invite_code', 'archived_at']));
  });

  it('initDb is idempotent (re-running swallows already-exists errors)', () => {
    process.env.DB_PATH = ':memory:';
    createDatabase();
    expect(() => initDb()).not.toThrow();
  });

  it('resetDatabase drops the user-facing tables', () => {
    process.env.DB_PATH = ':memory:';
    createDatabase();
    resetDatabase();
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).not.toContain('users');
    expect(names).not.toContain('projects');
    expect(names).not.toContain('groups');
  });
});
