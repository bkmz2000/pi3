import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { issueSessionToken, verifySessionToken } from '../sessions/tokens.js';
import { ALLOWED_EMOJI, addComment, isAllowedEmoji, listComments } from '../sessions/comments.js';

export function createSessionsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  router.post('/start', (req: Request, res: Response): void => {
    const { token, payload } = issueSessionToken(req.user!.id);
    res.status(201).json({
      token,
      session_id: payload.sid,
      expires_at: payload.exp,
    });
  });

  router.post('/join', (req: Request, res: Response): void => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }
    const session = verifySessionToken(token, req.user!.id);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
      return;
    }
    res.json({
      session_id: session.sid,
      starter_id: session.starterId,
      role: session.role,
      expires_at: session.exp,
    });
  });

  router.get('/allowed-emoji', (_req: Request, res: Response): void => {
    res.json({ allowed: ALLOWED_EMOJI });
  });

  router.post('/:sid/comments', (req: Request, res: Response): void => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const emoji = req.body?.emoji;
    const target = typeof req.body?.target === 'string' ? req.body.target : undefined;
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }
    if (!isAllowedEmoji(emoji)) {
      res.status(400).json({ error: 'Bad Request', message: 'emoji is not in the allowed set' });
      return;
    }
    const verified = verifySessionToken(token, req.user!.id);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
      return;
    }
    if (verified.sid !== req.params.sid) {
      res.status(403).json({ error: 'Forbidden', message: 'token does not match session' });
      return;
    }
    const comment = addComment(verified.sid, req.user!.id, emoji, target);
    res.status(201).json(comment);
  });

  router.post('/:sid/comments/list', (req: Request, res: Response): void => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }
    const verified = verifySessionToken(token, req.user!.id);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
      return;
    }
    if (verified.sid !== req.params.sid) {
      res.status(403).json({ error: 'Forbidden', message: 'token does not match session' });
      return;
    }
    res.json(listComments(verified.sid));
  });

  return router;
}

export default createSessionsRouter;
