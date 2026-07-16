import { describe, it, expect, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { setTestClient, closeClient, initDb, createDatabase } from '../db/index.js';
import { createSqliteClient } from '../db/sqlite-shim.js';

// Guard against the recurring landmine: every time a new users column lands,
// the "make users.name nullable" rebuild in initDb has to be updated to carry
// it forward, or the column is silently wiped on the next server start.
// See commits 49cc947 (oauth_provider_id + email) and 3c3be30 (freeze_updates)
// — same bug, twice. This test locks it down so future additions fail loudly.

const OPTIONAL_LIVE_COLUMNS = ['oauth_provider_id', 'email', 'freeze_updates'] as const;

// Recreate users with name NOT NULL + every optional column we've historically
// carried, mirroring the shape a real prod DB reaches just before the rebuild.
// Runs AFTER a normal initDb so all sibling tables exist and inline-migrations
// on other tables have nothing left to do.
function reintroducePreRebuildUsersTable(db: Database.Database) {
  db.exec(`
    DROP TABLE IF EXISTS users;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      api_token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
      password_hash TEXT,
      handle TEXT,
      handle_seq INTEGER,
      oauth_provider_id TEXT,
      email TEXT,
      freeze_updates INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

afterEach(() => {
  setTestClient(undefined);
  closeClient();
});

describe('users table rebuild preserves all live columns', () => {
  it('preserves oauth_provider_id, email, and freeze_updates values across rebuild', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);

    // Bring the DB to a fully-migrated shape (all sibling tables), then
    // reintroduce the pre-rebuild users schema and seed a row.
    await createDatabase();
    reintroducePreRebuildUsersTable(db);

    const now = Date.now();
    db.prepare(`INSERT INTO users
      (id, api_token, name, role, password_hash, handle, handle_seq,
       oauth_provider_id, email, freeze_updates, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'u1', 'tok1', 'Alice', 'teacher', null, 'alice', 1,
      'oauth-abc', 'alice@example.com', 1, now, now,
    );

    // Second initDb → sees name NOT NULL and rebuilds.
    await initDb();

    const cols = (await client.execute("PRAGMA table_info('users')")).rows as Array<{ name: string; notnull: number }>;
    const nameCol = cols.find(c => c.name === 'name');
    expect(nameCol?.notnull).toBe(0);

    const names = cols.map(c => c.name);
    for (const col of OPTIONAL_LIVE_COLUMNS) {
      expect(names).toContain(col);
    }

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get('u1') as Record<string, unknown>;
    expect(row.name).toBe('Alice');
    expect(row.oauth_provider_id).toBe('oauth-abc');
    expect(row.email).toBe('alice@example.com');
    expect(row.freeze_updates).toBe(1);
    expect(row.handle).toBe('alice');
    expect(row.handle_seq).toBe(1);

    db.close();
  });

  it('rebuild is a no-op when name is already nullable (freeze_updates survives)', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const client = createSqliteClient(db);
    setTestClient(client);
    await createDatabase();
    const now = Date.now();
    db.prepare('INSERT INTO users (id, api_token, name, role, freeze_updates, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('u1', 'tok1', 'Bob', 'student', 1, now, now);

    // Re-run initDb: name is already nullable, so the rebuild branch is skipped.
    await initDb();

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get('u1') as Record<string, unknown>;
    expect(row.freeze_updates).toBe(1);
    db.close();
  });

  // Structural canary: the rebuild path must produce the same column set as a
  // fresh init. If a future migration adds a users column but the rebuild's
  // users_new schema or INSERT list forgets it, the two paths diverge and this
  // test turns red before the divergence ships.
  it('rebuild carries forward every column that a fresh initDb creates', async () => {
    // Fresh init → column set A.
    const dbFresh = new Database(':memory:');
    dbFresh.pragma('foreign_keys = ON');
    const clientFresh = createSqliteClient(dbFresh);
    setTestClient(clientFresh);
    await createDatabase();
    const freshCols = ((await clientFresh.execute("PRAGMA table_info('users')")).rows as Array<{ name: string }>)
      .map(c => c.name).sort();
    dbFresh.close();
    setTestClient(undefined);

    // Init → reintroduce pre-rebuild users → init again → column set B.
    const dbReb = new Database(':memory:');
    dbReb.pragma('foreign_keys = ON');
    const clientReb = createSqliteClient(dbReb);
    setTestClient(clientReb);
    await createDatabase();
    reintroducePreRebuildUsersTable(dbReb);
    await initDb();
    const rebuiltCols = ((await clientReb.execute("PRAGMA table_info('users')")).rows as Array<{ name: string }>)
      .map(c => c.name).sort();
    dbReb.close();

    // Divergence = a dropped column. Fail loudly so the offending PR fixes both
    // the fresh-init schema and the rebuild path in the same change.
    expect(rebuiltCols).toEqual(freshCols);
  });
});
