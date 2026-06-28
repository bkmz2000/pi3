import { createClient } from '@libsql/client/web';
import type { DbClient, ResultSet, Row } from './client.js';

export function createLibsqlClient(): DbClient {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  return {
    async execute(sql, args = []): Promise<ResultSet> {
      const result = await client.execute({ sql, args: args as never[] });
      return {
        rows: result.rows as unknown as Row[],
        rowsAffected: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    async batch(statements): Promise<void> {
      await client.batch(
        statements.map(s => ({ sql: s.sql, args: (s.args ?? []) as never[] })),
        'write',
      );
    },
  };
}
