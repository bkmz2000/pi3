import type Database from 'better-sqlite3';
import { ADJ_COLOR, ADJ_TRAIT, ANIMAL } from './word-lists.js';

// Monotonic counter + coprime-stride bijection.
//
// Each user is assigned a `handle_seq` (1, 2, 3, ...). The display handle is
// derived from `seq` by mapping it to a unique (color, trait, animal) triple:
//
//   idx = (seq * STRIDE) mod N          // shuffles order so handles do not
//                                        // leak account-creation order
//   a = idx mod A;  idx //= A;
//   t = idx mod B;  n = idx // B;
//   handle = COLORS[a] + TRAITS[t] + ANIMALS[n]
//
// Uniqueness is guaranteed by the bijection up to N = A*B*C users. After
// that, a "generation" numeric suffix is appended (`...2`, `...3`, ...) so
// the second pass still produces unique handles. No DB collision check is
// needed at generation time; the unique index on lower(handle) remains as
// a backstop and should never fire.

const A = ADJ_COLOR.length;
const B = ADJ_TRAIT.length;
const C = ANIMAL.length;
export const N = A * B * C;

// A large prime; gcd(STRIDE, N) must be 1 for the mapping to be a bijection.
// Verified at module load below.
const STRIDE = 1000003;

function gcd(x: number, y: number): number {
  return y === 0 ? x : gcd(y, x % y);
}

if (gcd(STRIDE, N) !== 1) {
  // Word list sizes were changed in a way that breaks the bijection. Pick a
  // different STRIDE coprime to N.
  throw new Error(`handle.ts: STRIDE ${STRIDE} is not coprime to N=${N} (gcd=${gcd(STRIDE, N)})`);
}

export function handleFromSeq(seq: number): string {
  if (seq < 1) throw new Error(`handle_seq must be >= 1, got ${seq}`);
  const generation = Math.floor((seq - 1) / N) + 1; // 1, 2, 3, ...
  const idxInGen = (seq - 1) % N;
  const idx = (idxInGen * STRIDE) % N;
  const a = idx % A;
  const rest = Math.floor(idx / A);
  const t = rest % B;
  const n = Math.floor(rest / B);
  const base = `${ADJ_COLOR[a]}${ADJ_TRAIT[t]}${ANIMAL[n]}`;
  return generation === 1 ? base : `${base}${generation}`;
}

function nextSeq(db: Database.Database): number {
  const row = db.prepare('SELECT COALESCE(MAX(handle_seq), 0) as max_seq FROM users').get() as { max_seq: number };
  return row.max_seq + 1;
}

// Assign the next handle. Returns { seq, handle }. Caller must persist both.
export function assignHandle(db: Database.Database): { seq: number; handle: string } {
  const seq = nextSeq(db);
  return { seq, handle: handleFromSeq(seq) };
}

// Backfill rows that have no handle yet. Idempotent. Runs in a single
// transaction; assigns sequential handle_seq values starting from the
// current max.
export function backfillHandles(db: Database.Database): number {
  const rows = db.prepare('SELECT id FROM users WHERE handle IS NULL ORDER BY created_at ASC').all() as { id: string }[];
  if (rows.length === 0) return 0;
  const startRow = db.prepare('SELECT COALESCE(MAX(handle_seq), 0) as max_seq FROM users').get() as { max_seq: number };
  let seq = startRow.max_seq;
  const update = db.prepare('UPDATE users SET handle = ?, handle_seq = ? WHERE id = ?');
  const tx = db.transaction((users: { id: string }[]) => {
    for (const u of users) {
      seq += 1;
      update.run(handleFromSeq(seq), seq, u.id);
    }
  });
  tx(rows);
  return rows.length;
}
