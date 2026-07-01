import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { createSqliteClient } from '../db/sqlite-shim.js';
import { assignHandle, handleFromSeq, backfillHandles, N } from '../db/handle.js';
import type { DbClient } from '../db/client.js';

let db: Database.Database;
let client: DbClient;

beforeEach(() => {
  db = createTestDb();
  client = createSqliteClient(db);
});

afterEach(() => {
  db.close();
  closeTestDb();
});

function insertUser(id: string, name: string, handle: string | null, seq: number | null = null): void {
  const now = Date.now();
  db.prepare(
    'INSERT INTO users (id, api_token, name, role, handle, handle_seq, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, id + '_tok', name, 'student', handle, seq, now, now);
}

describe('handleFromSeq', () => {
  it('returns a camelCase string', () => {
    const h = handleFromSeq(1);
    expect(h).toMatch(/^[a-z][a-zA-Z]+$/);
    expect(h.length).toBeGreaterThan(5);
  });

  it('produces unique handles for the first N seq values', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 5000; s++) {
      const h = handleFromSeq(s);
      expect(seen.has(h)).toBe(false);
      seen.add(h);
    }
  });

  it('appends generation suffix after the bijection wraps', () => {
    const first = handleFromSeq(1);
    const wrapped = handleFromSeq(N + 1);
    expect(wrapped).toBe(`${first}2`);
    expect(handleFromSeq(2 * N + 1)).toBe(`${first}3`);
  });
});

describe('assignHandle', () => {
  it('returns seq=1 and a derived handle when DB is empty', async () => {
    const { seq, handle } = await assignHandle(client);
    expect(seq).toBe(1);
    expect(handle).toBe(handleFromSeq(1));
  });

  it('returns the next seq after existing rows', async () => {
    insertUser('u1', 'A', handleFromSeq(1), 1);
    insertUser('u2', 'B', handleFromSeq(2), 2);
    insertUser('u3', 'C', handleFromSeq(3), 3);
    const { seq } = await assignHandle(client);
    expect(seq).toBe(4);
  });

  it('does not query for collisions', async () => {
    insertUser('u1', 'A', 'unrelatedHandle', 1);
    const { seq, handle } = await assignHandle(client);
    expect(seq).toBe(2);
    expect(handle).toBe(handleFromSeq(2));
  });
});

describe('backfillHandles', () => {
  it('assigns sequential handles to rows missing them', async () => {
    insertUser('u1', 'A', null);
    insertUser('u2', 'B', null);
    insertUser('u3', 'C', 'preexistingHandle', 999);
    const n = await backfillHandles(client);
    expect(n).toBe(2);
    const rows = db.prepare('SELECT id, handle, handle_seq FROM users ORDER BY id').all() as {
      id: string;
      handle: string;
      handle_seq: number;
    }[];
    const u1 = rows.find((r) => r.id === 'u1')!;
    const u2 = rows.find((r) => r.id === 'u2')!;
    const u3 = rows.find((r) => r.id === 'u3')!;
    expect(u1.handle_seq).toBe(1000);
    expect(u2.handle_seq).toBe(1001);
    expect(u1.handle).toBe(handleFromSeq(1000));
    expect(u2.handle).toBe(handleFromSeq(1001));
    expect(u3.handle).toBe('preexistingHandle');
  });

  it('is idempotent on a second run', async () => {
    insertUser('u1', 'A', null);
    await backfillHandles(client);
    const h1 = (db.prepare('SELECT handle FROM users WHERE id = ?').get('u1') as { handle: string }).handle;
    const n = await backfillHandles(client);
    expect(n).toBe(0);
    const h2 = (db.prepare('SELECT handle FROM users WHERE id = ?').get('u1') as { handle: string }).handle;
    expect(h2).toBe(h1);
  });

  it('confirms lower(handle) expression index works under bundled better-sqlite3', () => {
    insertUser('u1', 'A', 'TestCaseHandle', 1);
    const found = db.prepare('SELECT id FROM users WHERE lower(handle) = lower(?)').get('TESTCASEHANDLE') as
      | { id: string }
      | undefined;
    expect(found?.id).toBe('u1');
  });

  it('case-insensitive unique index rejects case-variant collisions', () => {
    insertUser('u1', 'A', 'GreenHappyOtter', 1);
    expect(() => insertUser('u2', 'B', 'greenhappyotter', 2)).toThrow();
  });
});
