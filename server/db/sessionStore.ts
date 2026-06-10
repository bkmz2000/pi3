import type { SessionData } from 'express-session';
import { Store } from 'express-session';
import Database from 'better-sqlite3';

/**
 * Minimal SQLite-backed session store for express-session.
 * Uses the same better-sqlite3 database instance as the rest of the server.
 * The sessions table is separate from pi3.db; it is created here on first use.
 */
export class SqliteSessionStore extends Store {
  private db: Database.Database;

  constructor(dbPath: string) {
    super();
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid  TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        expires INTEGER NOT NULL
      )
    `);
  }

  get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    try {
      const row = this.db
        .prepare<[string, number], { data: string } | undefined>(
          'SELECT data FROM sessions WHERE sid = ? AND expires > ?'
        )
        .get(sid, Date.now());
      callback(null, row ? (JSON.parse(row.data) as SessionData) : null);
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    try {
      const expires =
        session.cookie?.expires
          ? new Date(session.cookie.expires).getTime()
          : Date.now() + 7 * 24 * 60 * 60 * 1000;
      this.db
        .prepare(
          'INSERT OR REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)'
        )
        .run(sid, JSON.stringify(session), expires);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    try {
      this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    this.set(sid, session, callback);
  }

  /** Remove expired rows. Call periodically to keep the DB lean. */
  prune(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
  }
}
