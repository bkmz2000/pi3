import type Database from 'better-sqlite3';
import type { DbClient, ResultSet, Row } from './client.js';

export function createSqliteClient(db: Database.Database): DbClient {
  return {
    async execute(sql, args = []): Promise<ResultSet> {
      const stmt = db.prepare(sql);
      // PRAGMA in query form (e.g. `PRAGMA table_info(x)`, `PRAGMA foreign_keys`)
      // returns rows and must use .all(). PRAGMA in setter form
      // (e.g. `PRAGMA foreign_keys = OFF`) returns no data and must use .run().
      const isPragmaSet = /^\s*PRAGMA\b/i.test(sql) && /=/.test(sql);
      const isRead = !isPragmaSet && /^\s*(SELECT|PRAGMA|WITH)/i.test(sql);
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
