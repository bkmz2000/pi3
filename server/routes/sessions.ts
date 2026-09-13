import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { issueSessionToken, verifySessionToken } from '../sessions/tokens.js';
import { ALLOWED_EMOJI, addComment, isAllowedEmoji, listComments } from '../sessions/comments.js';
import {
  ALLOWED_REACTIONS, addReaction, isAllowedReaction, listReactions,
} from '../sessions/reactions.js';
import { getClient } from '../db/index.js';
import { isSessionActive } from '../sessions/classrooms.js';

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

  router.post('/join', async (req: Request, res: Response): Promise<void> => {
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
    if (!await isSessionActive(session)) {
      res.status(410).json({ error: 'Gone', message: 'This classroom session has ended' });
      return;
    }
    res.json({
      session_id: session.sid,
      starter_id: session.starterId,
      role: session.role,
      expires_at: session.exp,
      group_id: session.groupId,
    });
  });

  router.get('/allowed-reactions', (_req: Request, res: Response): void => {
    res.json({ allowed: ALLOWED_REACTIONS });
  });

  router.post('/:sid/reactions', async (req: Request, res: Response): Promise<void> => {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const reaction = req.body?.reaction;
    const target = typeof req.body?.target === 'string' ? req.body.target : '';
    const file = typeof req.body?.file === 'string' ? req.body.file.trim() : '';
    const line = Number(req.body?.line);
    if (!token) {
      res.status(400).json({ error: 'Bad Request', message: 'token is required' });
      return;
    }
    if (!isAllowedReaction(reaction)) {
      res.status(400).json({ error: 'Bad Request', message: 'reaction is not in the allowed set' });
      return;
    }
    if (!target || !file || file.length > 240 || !Number.isInteger(line) || line < 1 || line > 100000) {
      res.status(400).json({ error: 'Bad Request', message: 'target, file, and a valid line are required' });
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
    if (!await isSessionActive(verified)) {
      res.status(410).json({ error: 'Gone', message: 'This classroom session has ended' });
      return;
    }
    // A classroom is asymmetric: only the teacher who started it reacts.
    // Link rooms are symmetric, so every participant may react.
    if (verified.groupId && verified.role !== 'starter') {
      res.status(403).json({ error: 'Forbidden', message: 'Only the teacher can react in a classroom session' });
      return;
    }
    const client = getClient();
    const member = verified.groupId
      ? (await client.execute(
          'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?',
          [verified.groupId, target],
        )).rows[0]
      : (await client.execute(
          'SELECT 1 FROM live_presence WHERE session_id = ? AND student_id = ?',
          [verified.sid, target],
        )).rows[0];
    if (!member) {
      res.status(404).json({ error: 'Not Found', message: 'Session member not found' });
      return;
    }
    res.status(201).json(addReaction(verified.sid, req.user!.id, reaction, target, file, line));
  });

  router.post('/:sid/reactions/list', async (req: Request, res: Response): Promise<void> => {
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
    if (!await isSessionActive(verified)) {
      res.status(410).json({ error: 'Gone', message: 'This classroom session has ended' });
      return;
    }
    const items = listReactions(verified.sid);
    // Students in a classroom only receive reactions addressed to them.
    res.json(verified.groupId && verified.role === 'joiner'
      ? items.filter((item) => item.target === req.user!.id)
      : items);
  });

  router.get('/allowed-emoji', (_req: Request, res: Response): void => {
    res.json({ allowed: ALLOWED_EMOJI });
  });

  router.post('/:sid/comments', async (req: Request, res: Response): Promise<void> => {
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
    if (!await isSessionActive(verified)) {
      res.status(410).json({ error: 'Gone', message: 'This classroom session has ended' });
      return;
    }
    if (verified.groupId && verified.role !== 'starter') {
      res.status(403).json({ error: 'Forbidden', message: 'Only the teacher can react in a classroom session' });
      return;
    }
    const comment = addComment(verified.sid, req.user!.id, emoji, target);
    res.status(201).json(comment);
  });

  router.post('/:sid/comments/list', async (req: Request, res: Response): Promise<void> => {
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
    if (!await isSessionActive(verified)) {
      res.status(410).json({ error: 'Gone', message: 'This classroom session has ended' });
      return;
    }
    const items = listComments(verified.sid);
    res.json(verified.groupId && verified.role === 'joiner'
      ? items.filter((item) => item.target === req.user!.id)
      : items);
  });

  return router;
}

export default createSessionsRouter;
