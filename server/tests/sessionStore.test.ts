import { describe, it, expect, afterEach } from '@jest/globals';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { SessionData } from 'express-session';
import { SqliteSessionStore } from '../db/sessionStore.js';

const DB_PATH = join(tmpdir(), `sessions-test-${process.pid}.db`);

afterEach(() => {
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
});

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    cookie: {
      originalMaxAge: 7 * 24 * 60 * 60 * 1000,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      path: '/',
      secure: false,
      sameSite: 'lax',
    } as SessionData['cookie'],
    ...overrides,
  } as SessionData;
}

describe('SqliteSessionStore', () => {
  it('get returns null for unknown sid', (done) => {
    const store = new SqliteSessionStore(DB_PATH);
    store.get('no-such-sid', (err, session) => {
      expect(err).toBeNull();
      expect(session).toBeNull();
      done();
    });
  });

  it('set then get round-trips session data', (done) => {
    const store = new SqliteSessionStore(DB_PATH);
    const sid = 'test-sid-1';
    const sess = makeSession({ userId: 'user-abc' } as SessionData);
    store.set(sid, sess, (err) => {
      expect(err).toBeUndefined();
      store.get(sid, (err2, result) => {
        expect(err2).toBeNull();
        expect((result as SessionData & { userId?: string }).userId).toBe('user-abc');
        done();
      });
    });
  });

  it('destroy removes session', (done) => {
    const store = new SqliteSessionStore(DB_PATH);
    const sid = 'test-sid-2';
    store.set(sid, makeSession(), () => {
      store.destroy(sid, () => {
        store.get(sid, (err, result) => {
          expect(err).toBeNull();
          expect(result).toBeNull();
          done();
        });
      });
    });
  });

  it('expired session is not returned', (done) => {
    const store = new SqliteSessionStore(DB_PATH);
    const sid = 'test-sid-expired';
    const expiredSess = makeSession();
    expiredSess.cookie.expires = new Date(Date.now() - 1000);
    store.set(sid, expiredSess, () => {
      store.get(sid, (err, result) => {
        expect(err).toBeNull();
        expect(result).toBeNull();
        done();
      });
    });
  });

  it('session survives a store restart (persistence check)', (done) => {
    const store1 = new SqliteSessionStore(DB_PATH);
    const sid = 'persist-sid';
    const sess = makeSession({ userId: 'persisted-user' } as SessionData);
    store1.set(sid, sess, () => {
      // Simulate server restart: new store instance, same DB file
      const store2 = new SqliteSessionStore(DB_PATH);
      store2.get(sid, (err, result) => {
        expect(err).toBeNull();
        expect((result as SessionData & { userId?: string }).userId).toBe('persisted-user');
        done();
      });
    });
  });

  it('prune removes expired rows without touching live ones', (done) => {
    const store = new SqliteSessionStore(DB_PATH);
    const expiredSid = 'prune-expired';
    const liveSid = 'prune-live';
    const expiredSess = makeSession();
    expiredSess.cookie.expires = new Date(Date.now() - 1000);
    store.set(expiredSid, expiredSess, () => {
      store.set(liveSid, makeSession(), () => {
        store.prune();
        store.get(expiredSid, (_, r1) => {
          store.get(liveSid, (_, r2) => {
            expect(r1).toBeNull();
            expect(r2).not.toBeNull();
            done();
          });
        });
      });
    });
  });
});
