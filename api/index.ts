import { initDb } from '../server/db/index.js';
import app from '../server/index.js';

// server/index.ts fires initDb() without awaiting it (so listen() can be
// skipped on VERCEL=1).  We must await it here so the DB is ready before
// Vercel routes the first request into this handler.
await initDb();

export default app;
