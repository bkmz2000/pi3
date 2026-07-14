import { Router, Request, Response, NextFunction } from 'express';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { rateLimitPerUser } from '../middleware/rateLimitPerUser.js';

// Minimum-viable moderation surface.
//
//   POST /api/moderation/report — any authed caller. Records a report.
//   GET  /api/moderation/flagged — reviewer-only queue: open content_reports.
//
// Reviewer identity: hardcoded allowlist from REVIEWER_IDS env var
// (comma-separated). Unset → GET returns 503 (loud: gate not configured).
//
// Flagged-content queue for snapshots / problems / comments will grow once
// scan_status/scan_findings columns land (PR #5 snapshot pipeline).

const VALID_TARGET_TYPES = new Set(['snapshot', 'problem', 'comment', 'share_link']);
const REPORT_REASON_MAX = 500;

const reportLimit = rateLimitPerUser({ name: 'content-report', windowMs: 3600_000, max: 20 });

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
    const reports = (await client.execute(
      `SELECT id, target_type, target_id, reporter_id, reason, created_at
       FROM content_reports
       WHERE handled_at IS NULL
       ORDER BY created_at ASC LIMIT 100`,
    )).rows;
    res.json({ reports });
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
