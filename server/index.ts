import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './db/index.js';
import usersRouter from './routes/users.js';
import projectsRouter from './routes/projects.js';
import filesRouter from './routes/files.js';
import sharesRouter from './routes/shares.js';

const PORT = process.env.PORT || 3001;
const DIST_DIR = process.env.DIST_DIR || join(dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

runMigrations();

app.use('/api/users', usersRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', filesRouter);
app.use('/api/projects', sharesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use(express.static(DIST_DIR));

app.get('*', (req, res) => {
  if (!req.url.startsWith('/api/')) {
    res.sendFile(join(DIST_DIR, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not Found' });
  }
});

app.use((err: Error, req: express.Request, res: express.Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${DIST_DIR}`);
  console.log(`API endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/users`);
  console.log(`  GET  /api/users/me`);
  console.log(`  GET  /api/projects`);
  console.log(`  POST /api/projects`);
  console.log(`  GET  /api/projects/:id`);
  console.log(`  PUT  /api/projects/:id`);
  console.log(`  DELETE /api/projects/:id`);
  console.log(`  GET  /api/projects/:id/files`);
  console.log(`  POST /api/projects/:id/files`);
  console.log(`  GET  /api/projects/:id/files/:path`);
  console.log(`  PUT  /api/projects/:id/files/:path`);
  console.log(`  DELETE /api/projects/:id/files/:path`);
  console.log(`  POST /api/projects/:id/share`);
  console.log(`  GET  /api/projects/:id/share`);
  console.log(`  DELETE /api/projects/:id/share/:userId`);
});

export default app;