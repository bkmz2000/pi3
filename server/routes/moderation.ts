import { Router, Request, Response, NextFunction } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

// SPP-8: minimum-viable moderation surface. Two endpoints:
//
//   GET  /api/moderation/flagged  — reviewer-only queue: every row across
//                                    snapshots / problems / comments where
//                                    scan_status='flagged', plus every open
//                                    row in content_reports.
//
//   POST /api/moderation/report   — any authed caller. Records a report.
//
// The reviewer identity check is a hardcoded allowlist read from the
// REVIEWER_IDS env var (comma-separated). No UI, no admin page — a human
// hits the endpoint directly. This is deliberate: launching without any
// review path at all is the doctrine violation; polishing the UI can wait.
//
// If REVIEWER_IDS is unset, the flagged queue endpoint returns 503 to make
// it loud that the moderation gate has not been configured.

const VALID_TARGET_TYPES = new Set(['snapshot', 'problem', 'comment', 'share_link']);
const REPORT_REASON_MAX = 500;

const reportLimit = rateLimit({ name: 'content-report', windowMs: 3600_000, max: 20 });

function parseReviewerIds(): string[] {
  return (process.env['REVIEWER_IDS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function requireReviewer(req: Request, res: Response, next: NextFunction): void {
  const allowlist = parseReviewerIds();
  if (allowlist.length === 0) {
    res.status(503).json({
      error: 'Service Unavailable',
      code: 'reviewer_allowlist_unconfigured',
      message: 'REVIEWER_IDS env var is not set; the moderation queue has no reviewers.',
    });
    return;
  }
  if (!req.user || !allowlist.includes(req.user.id)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function createModerationRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/flagged', requireReviewer, async (_req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const snapshots = (await client.execute(
      `SELECT id, share_link, owner_id, title, created_at, scan_findings
       FROM project_snapshots
       WHERE scan_status = 'flagged' AND revoked_at IS NULL
       ORDER BY created_at DESC LIMIT 100`,
    )).rows;
    const problems = (await client.execute(
      `SELECT id, slug, title, created_by, created_at, scan_findings
       FROM problems
       WHERE scan_status = 'flagged' AND archived = 0
       ORDER BY created_at DESC LIMIT 100`,
    )).rows;
    const comments = (await client.execute(
      `SELECT id, project_id, author_id, file_path, line_number, text, created_at, scan_findings
       FROM comments
       WHERE scan_status = 'flagged'
       ORDER BY created_at DESC LIMIT 100`,
    )).rows;
    const reports = (await client.execute(
      `SELECT id, target_type, target_id, reporter_id, reason, created_at
       FROM content_reports
       WHERE handled_at IS NULL
       ORDER BY created_at ASC LIMIT 100`,
    )).rows;
    res.json({ snapshots, problems, comments, reports });
  });

  router.post('/report', reportLimit, async (req: Request, res: Response): Promise<void> => {
    const { target_type, target_id, reason } = req.body ?? {};
    if (typeof target_type !== 'string' || !VALID_TARGET_TYPES.has(target_type)) {
      res.status(400).json({ error: 'Bad Request', message: 'target_type must be one of: snapshot, problem, comment, share_link' });
      return;
    }
    if (typeof target_id !== 'string' || target_id.length === 0 || target_id.length > 200) {
      res.status(400).json({ error: 'Bad Request', message: 'target_id is required' });
      return;
    }
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'reason is required' });
      return;
    }
    if (reason.length > REPORT_REASON_MAX) {
      res.status(400).json({ error: 'Bad Request', message: `reason must be at most ${REPORT_REASON_MAX} characters` });
      return;
    }
    const client = getClient();
    await client.execute(
      `INSERT INTO content_reports (target_type, target_id, reporter_id, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [target_type, target_id, req.user!.id, reason.trim(), Date.now()],
    );
    res.status(201).json({ ok: true });
  });

  return router;
}

export default createModerationRouter;
