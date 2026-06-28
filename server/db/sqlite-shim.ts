import type Database from 'better-sqlite3';
import type { DbClient, ResultSet, Row } from './client.js';

export function createSqliteClient(db: Database.Database): DbClient {
  return {
    async execute(sql, args = []): Promise<ResultSet> {
      const stmt = db.prepare(sql);
      const isRead = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql);
      if (isRead) {
        const rows = stmt.all(...(args as unknown[])) as Row[];
        return { rows, rowsAffected: 0 };
      } else {
        const info = stmt.run(...(args as unknown[]));
        return {
          rows: [],
          rowsAffected: info.changes,
          lastInsertRowid: info.lastInsertRowid,
        };
      }
    },
    async batch(statements): Promise<void> {
      const tx = db.transaction(() => {
        for (const s of statements) {
          db.prepare(s.sql).run(...((s.args ?? []) as unknown[]));
        }
      });
      tx();
    },
  };
}
