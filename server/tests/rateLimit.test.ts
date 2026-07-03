/**
 * Rate-limit smoke test for /api/users/outsider/login (C1).
 * RATE_LIMIT_TEST=1 lets the limiter engage under NODE_ENV=test.
 */
process.env.RATE_LIMIT_TEST = '1';

import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createTestDb, closeTestDb } from './setup.js';
import { createUsersRouter } from '../routes/users.js';

let app: express.Application;
let db: Database.Database;

beforeAll(() => {
  app = express();
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: 'lax' },
  }));
  app.use('/api/users', createUsersRouter(true));
});

afterEach(() => {
  if (db) db.close();
  closeTestDb();
});

afterAll(() => {
  closeTestDb();
  delete process.env.RATE_LIMIT_TEST;
});

describe('rate limit — outsider login (C1)', () => {
  it('returns 429 after exceeding the login limit', async () => {
    db = createTestDb();
    let sawLimit = false;
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/users/outsider/login')
        .send({ name: 'nobody', password: 'wrongpass' });
      statuses.push(res.status);
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
    }
    if (!sawLimit) console.error('statuses:', statuses);
    expect(sawLimit).toBe(true);
  });
});
