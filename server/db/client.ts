export type Row = Record<string, unknown>;

export interface ResultSet {
  rows: Row[];
  rowsAffected: number;
  lastInsertRowid?: number | bigint;
}

export interface DbClient {
  execute(sql: string, args?: unknown[]): Promise<ResultSet>;
  batch(statements: { sql: string; args?: unknown[] }[]): Promise<void>;
}

// Typed cast helpers — use instead of `as T` which TypeScript rejects across
// the Row ↔ interface boundary in strict mode.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const first = <T>(result: ResultSet): T | undefined => result.rows[0] as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const all = <T>(result: ResultSet): T[] => result.rows as any;
