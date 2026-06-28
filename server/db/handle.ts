import type { DbClient } from './client.js';
import { ADJ_COLOR, ADJ_TRAIT, ANIMAL } from './word-lists.js';

const A = ADJ_COLOR.length;
const B = ADJ_TRAIT.length;
const C = ANIMAL.length;
export const N = A * B * C;

const STRIDE = 1000003;

function gcd(x: number, y: number): number {
  return y === 0 ? x : gcd(y, x % y);
}

if (gcd(STRIDE, N) !== 1) {
  throw new Error(`handle.ts: STRIDE ${STRIDE} is not coprime to N=${N} (gcd=${gcd(STRIDE, N)})`);
}

export function handleFromSeq(seq: number): string {
  if (seq < 1) throw new Error(`handle_seq must be >= 1, got ${seq}`);
  const generation = Math.floor((seq - 1) / N) + 1;
  const idxInGen = (seq - 1) % N;
  const idx = (idxInGen * STRIDE) % N;
  const a = idx % A;
  const rest = Math.floor(idx / A);
  const t = rest % B;
  const n = Math.floor(rest / B);
  const base = `${ADJ_COLOR[a]}${ADJ_TRAIT[t]}${ANIMAL[n]}`;
  return generation === 1 ? base : `${base}${generation}`;
}

async function nextSeq(client: DbClient): Promise<number> {
  const result = await client.execute('SELECT COALESCE(MAX(handle_seq), 0) as max_seq FROM users');
  const row = result.rows[0] as { max_seq: number };
  return (row?.max_seq ?? 0) + 1;
}

export async function assignHandle(client: DbClient): Promise<{ seq: number; handle: string }> {
  const seq = await nextSeq(client);
  return { seq, handle: handleFromSeq(seq) };
}

export async function backfillHandles(client: DbClient): Promise<number> {
  const result = await client.execute(
    'SELECT id FROM users WHERE handle IS NULL ORDER BY created_at ASC',
  );
  const rows = result.rows as { id: string }[];
  if (rows.length === 0) return 0;

  const seqResult = await client.execute(
    'SELECT COALESCE(MAX(handle_seq), 0) as max_seq FROM users',
  );
  let seq = ((seqResult.rows[0] as { max_seq: number })?.max_seq ?? 0) as number;

  await client.batch(
    rows.map(u => {
      seq += 1;
      return {
        sql: 'UPDATE users SET handle = ?, handle_seq = ? WHERE id = ?',
        args: [handleFromSeq(seq), seq, u.id],
      };
    }),
  );
  return rows.length;
}
