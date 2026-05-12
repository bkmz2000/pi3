import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import usersRouter from './routes/users.js';
import projectsRouter from './routes/projects.js';
import authRouter from './routes/auth.js';
import { createGroupsRouter } from './routes/groups.js';
import { createHelpRequestsRouter } from './routes/help-requests.js';

const PORT = process.env.PORT || 3001;
const DIST_DIR = process.env.DIST_DIR || join(dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

initDb();

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/groups', createGroupsRouter());
app.use('/api/help-requests', createHelpRequestsRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use(express.static(DIST_DIR));

// SPA fallback — only for non-file, non-API routes
app.get('*', (req, res) => {
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  // Don't serve index.html for missing static files (e.g. old hashed JS from a cached index.html)
  // — return 404 so the browser gets a correct error instead of an HTML-with-wrong-MIME-type error
  if (/\.[a-zA-Z0-9]{2,8}(\?.*)?$/.test(req.path)) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(join(DIST_DIR, 'index.html'));
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${DIST_DIR}`);
});

export default app;
