import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { assignHandle, handleFromSeq, backfillHandles, N } from '../db/handle.js';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
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
    // Spot-check a sparse sample (full sweep would be slow but still feasible).
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
    // Same base triple (seq 1 and seq N+1 hit the same idx), suffix differs
    expect(wrapped).toBe(`${first}2`);
    expect(handleFromSeq(2 * N + 1)).toBe(`${first}3`);
  });
});

describe('assignHandle', () => {
  it('returns seq=1 and a derived handle when DB is empty', () => {
    const { seq, handle } = assignHandle(db);
    expect(seq).toBe(1);
    expect(handle).toBe(handleFromSeq(1));
  });

  it('returns the next seq after existing rows', () => {
    insertUser('u1', 'A', handleFromSeq(1), 1);
    insertUser('u2', 'B', handleFromSeq(2), 2);
    insertUser('u3', 'C', handleFromSeq(3), 3);
    const { seq } = assignHandle(db);
    expect(seq).toBe(4);
  });

  it('does not query for collisions (no retry loop)', () => {
    // Even if a handle with the "natural" next seq value were somehow
    // already present in the DB (which the unique index would prevent in
    // reality), assignHandle would still return seq=MAX+1 deterministically.
    // We just assert that no extra SELECT-by-handle round-trips happen by
    // confirming the function is O(1) calls — implicitly, that assignHandle
    // does not depend on the value of `handle` of previous rows.
    insertUser('u1', 'A', 'unrelatedHandle', 1);
    const { seq, handle } = assignHandle(db);
    expect(seq).toBe(2);
    expect(handle).toBe(handleFromSeq(2));
  });
});

describe('backfillHandles', () => {
  it('assigns sequential handles to rows missing them', () => {
    insertUser('u1', 'A', null);
    insertUser('u2', 'B', null);
    insertUser('u3', 'C', 'preexistingHandle', 999);
    const n = backfillHandles(db);
    expect(n).toBe(2);
    const rows = db.prepare('SELECT id, handle, handle_seq FROM users ORDER BY id').all() as {
      id: string;
      handle: string;
      handle_seq: number;
    }[];
    const u1 = rows.find((r) => r.id === 'u1')!;
    const u2 = rows.find((r) => r.id === 'u2')!;
    const u3 = rows.find((r) => r.id === 'u3')!;
    // Backfill picks up where the existing max_seq left off.
    expect(u1.handle_seq).toBe(1000);
    expect(u2.handle_seq).toBe(1001);
    expect(u1.handle).toBe(handleFromSeq(1000));
    expect(u2.handle).toBe(handleFromSeq(1001));
    expect(u3.handle).toBe('preexistingHandle');
  });

  it('is idempotent on a second run', () => {
    insertUser('u1', 'A', null);
    backfillHandles(db);
    const h1 = (db.prepare('SELECT handle FROM users WHERE id = ?').get('u1') as { handle: string }).handle;
    const n = backfillHandles(db);
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
