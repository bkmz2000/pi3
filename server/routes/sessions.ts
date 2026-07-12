import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { issueSessionToken, verifySessionToken } from '../sessions/tokens.js';
import { ALLOWED_EMOJI, addComment, isAllowedEmoji, listComments } from '../sessions/comments.js';

export function createSessionsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // Start an ephemeral, symmetric multiplayer session. No DB row is written;
  // the returned token is a stateless bearer-of-membership good for ~2h.
  router.post('/start', (req: Request, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { token, payload } = issueSessionToken(req.user.id);
    res.status(201).json({
      token,
      session_id: payload.sid,
      expires_at: payload.exp,
    });
  });

  // Present a token to prove membership. Returns the session id, the starter's
  // id, and the caller's role in the session ('starter' if their user id
  // matches the token's starterId, otherwise 'joiner').
  router.post('/join', (req: Request, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }
    const session = verifySessionToken(token, req.user.id);
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

  // Expose the allowed emoji set so the client can render only the whitelisted
  // picker options. This is authoritative — the server re-validates on submit.
  router.get('/allowed-emoji', (_req: Request, res: Response): void => {
    res.json({ allowed: ALLOWED_EMOJI });
  });

  // Post an emoji comment to a session. Membership is proven by the token,
  // not by any DB-backed role. The emoji must be in the whitelist — anything
  // else is rejected server-side (structural, not filter-based, prevention).
  router.post('/:sid/comments', (req: Request, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
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
    const verified = verifySessionToken(token, req.user.id);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
      return;
    }
    if (verified.sid !== req.params.sid) {
      res.status(403).json({ error: 'Forbidden', message: 'token does not match session' });
      return;
    }
    const comment = addComment(verified.sid, req.user.id, emoji, target);
    res.status(201).json(comment);
  });

  // List the comments for a session. Same membership rule as posting.
  router.post('/:sid/comments/list', (req: Request, res: Response): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }
    const verified = verifySessionToken(token, req.user.id);
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
