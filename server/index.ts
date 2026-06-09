import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import { createUsersRouter } from './routes/users.js';
import projectsRouter from './routes/projects.js';
import authRouter from './routes/auth.js';
import { createGroupsRouter } from './routes/groups.js';
import { createHelpRequestsRouter } from './routes/help-requests.js';
import { decompressRequest } from './middleware/decompress.js';

const PORT = process.env.PORT || 3001;
const DIST_DIR = process.env.DIST_DIR || join(dirname(fileURLToPath(import.meta.url)), '../dist');
const ALLOW_PASSWORD_AUTH = process.env.ALLOW_PASSWORD_AUTH === 'true';

// Derive CORS allowed origins from APP_BASE_URL and environment
const DEFAULT_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://pi3.sys5.ru' : 'http://localhost:3001';
const APP_BASE_URL = process.env.APP_BASE_URL || DEFAULT_BASE_URL;
const ALLOWED_ORIGINS = [APP_BASE_URL];
// Also allow localhost variants in development
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3001');
}

// Validate SESSION_SECRET in production
if (process.env.NODE_ENV === 'production') {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret === 'dev-secret-change-in-production') {
    throw new Error(
      'FATAL: SESSION_SECRET is not set or is the default dev value. ' +
      'Set the SESSION_SECRET environment variable to a strong random secret before deploying to production.'
    );
  }
}

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(cookieParser());
// Inflate gzipped request bodies before express.json sees them. Clients only
// gzip large payloads (saves), so most requests pass through untouched.
app.use(decompressRequest);
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

const LOG_SKIP_PREFIXES = ['/assets/', '/pyodide/', '/icons/'];
const LOG_SKIP_EXACT = new Set([
  '/favicon.svg', '/favicon.ico', '/manifest.json', '/robots.txt', '/sw.js',
  '/icon-192.svg', '/icon-maskable.svg',
]);

app.use((req, res, next) => {
  const path = req.path;
  if (LOG_SKIP_EXACT.has(path) || LOG_SKIP_PREFIXES.some((p) => path.startsWith(p))) {
    return next();
  }
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const userId = req.session?.userId ?? '-';
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.url} ${res.statusCode} ${ms.toFixed(1)}ms user=${userId}`,
    );
  });
  next();
});

// Client-side runtime error sink. Browser worker posts Pyodide tracebacks here
// so they land in the server log alongside HTTP traffic. Fail open: never let
// a logging error break the client.
app.post('/api/log/client-error', (req, res) => {
  const userId = req.session?.userId ?? '-';
  const body = req.body ?? {};
  const truncate = (s: unknown, max: number) =>
    typeof s === 'string' ? s.slice(0, max) : '';
  const payload = {
    user: userId,
    project: truncate(body.projectId, 120),
    file: truncate(body.file, 120),
    category: truncate(body.category, 40),
    title: truncate(body.title, 200),
    message: truncate(body.message, 500),
    traceback: truncate(body.traceback, 2000),
  };
  console.log(`[client-error] ${JSON.stringify(payload)}`);
  res.status(204).end();
});

initDb();

app.use('/api/auth', authRouter);
app.use('/api/users', createUsersRouter(ALLOW_PASSWORD_AUTH));
app.use('/api/projects', projectsRouter);
app.use('/api/groups', createGroupsRouter());
app.use('/api/help-requests', createHelpRequestsRouter());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/config', (req, res) => {
  res.json({ allowPasswordAuth: ALLOW_PASSWORD_AUTH });
});

// Required for SharedArrayBuffer (Pyodide interrupt). Only set on app shell
// responses — API routes are excluded to keep the change surface minimal.
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }
  next();
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
  void _next; // Express error handler requires 4 params
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${DIST_DIR}`);
});

export default app;
