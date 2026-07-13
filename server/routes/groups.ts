import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { issueSessionToken, verifySessionToken } from '../sessions/tokens.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;

export const MAX_GROUPS_PER_TEACHER = 3;
export const MAX_MEMBERS_PER_GROUP = 10;

const JOIN_ATTEMPT_WINDOW_MS = 60_000;
const JOIN_ATTEMPT_MAX_FAILURES = 10;
const joinFailures = new Map<string, { count: number; firstAt: number }>();

function recordJoinFailure(userId: string): boolean {
  const now = Date.now();
  const entry = joinFailures.get(userId);
  if (!entry || now - entry.firstAt > JOIN_ATTEMPT_WINDOW_MS) {
    joinFailures.set(userId, { count: 1, firstAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > JOIN_ATTEMPT_MAX_FAILURES;
}

function clearJoinFailures(userId: string): void {
  joinFailures.delete(userId);
}

export function __resetJoinRateLimitForTests(): void {
  joinFailures.clear();
}

function generateInviteCode(): string {
  const buf = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[buf[i]! % CODE_ALPHABET.length];
  }
  return out;
}

async function mintUniqueCode(): Promise<string> {
  const client = getClient();
  for (let i = 0; i < 8; i++) {
    const code = generateInviteCode();
    const existing = (await client.execute(
      'SELECT 1 FROM groups WHERE invite_code = ? LIMIT 1',
      [code],
    )).rows[0];
    if (!existing) return code;
  }
  throw new Error('Failed to mint unique invite code');
}

interface Group {
  id: string;
  teacher_id: string;
  name: string;
  invite_code: string | null;
  archived_at: number | null;
  created_at: number;
  member_count?: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  student_id: string;
  joined_at: number;
  student_name?: string;
}

// Group ownership check: the caller must be the account that created this
// group. The role concept is gone (per SPP-1);
// "who can act on this group" is now purely a question of ownership.
// The column is still called `teacher_id` — that name is cosmetic legacy and
// intentionally not renamed as part of this fix.
async function checkGroupOwnership(groupId: string, ownerId: string): Promise<Group | undefined> {
  return (await getClient().execute(
    'SELECT * FROM groups WHERE id = ? AND teacher_id = ?',
    [groupId, ownerId],
  )).rows[0] as unknown as Group | undefined;
}

export function createGroupsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // POST /api/groups/join — student: join a group by invite code
  router.post('/join', async (req: Request, res: Response): Promise<void> => {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Invite code is required' });
      return;
    }
    const userId = req.user!.id;
    const client = getClient();
    const normalized = code.trim().toUpperCase();
    const group = (await client.execute(
      'SELECT * FROM groups WHERE invite_code = ? AND archived_at IS NULL',
      [normalized],
    )).rows[0] as unknown as Group | undefined;
    if (!group) {
      const throttled = recordJoinFailure(userId);
      if (throttled) {
        res.status(429).json({
          error: 'Too Many Requests',
          code: 'join_rate_limited',
          message: 'Too many invalid attempts. Wait a minute before trying again.',
        });
        return;
      }
      res.status(404).json({ error: 'Not Found', message: 'Invalid or expired invite code' });
      return;
    }
    if (group.teacher_id === userId) {
      res.status(400).json({ error: 'Bad Request', message: 'The group creator cannot join their own group' });
      return;
    }
    const existing = (await client.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
      [group.id, userId],
    )).rows[0];
    if (existing) {
      clearJoinFailures(userId);
      res.status(200).json({ id: group.id, name: group.name, already_member: true });
      return;
    }
    const memberCount = (await client.execute(
      'SELECT COUNT(*) as n FROM group_members WHERE group_id = ?',
      [group.id],
    )).rows[0] as { n: number };
    if (Number(memberCount.n) >= MAX_MEMBERS_PER_GROUP) {
      res.status(409).json({
        error: 'Conflict',
        code: 'cap_members_reached',
        message: `This group is full (${MAX_MEMBERS_PER_GROUP} members). Ask your teacher to make room.`,
        limit: MAX_MEMBERS_PER_GROUP,
      });
      return;
    }
    await client.execute(
      'INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), group.id, userId, Date.now()],
    );
    clearJoinFailures(userId);
    res.status(201).json({ id: group.id, name: group.name });
  });

  // GET /api/groups/my — student: list groups I'm in
  router.get('/my', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const result = await client.execute(
      `SELECT g.id, g.name, g.created_at, u.name as teacher_name, u.handle as teacher_handle
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN users u ON u.id = g.teacher_id
       WHERE gm.student_id = ? AND g.archived_at IS NULL
       ORDER BY g.created_at DESC`,
      [req.user!.id],
    );
    res.json(result.rows);
  });

  // GET /api/groups — teacher: list my groups with member count
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const includeArchived = req.query['include_archived'] === '1';
    const result = await client.execute(
      `SELECT g.id, g.name, g.invite_code, g.archived_at, g.created_at,
              COUNT(gm.id) as member_count
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.teacher_id = ?${includeArchived ? '' : ' AND g.archived_at IS NULL'}
       GROUP BY g.id
       ORDER BY g.archived_at IS NOT NULL, g.created_at DESC`,
      [req.user!.id],
    );
    res.json(result.rows);
  });

  // POST /api/groups — teacher: create group
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Group name is required' });
      return;
    }
    const client = getClient();
    const activeCount = (await client.execute(
      'SELECT COUNT(*) as n FROM groups WHERE teacher_id = ? AND archived_at IS NULL',
      [req.user!.id],
    )).rows[0] as { n: number };
    if (Number(activeCount.n) >= MAX_GROUPS_PER_TEACHER) {
      res.status(409).json({
        error: 'Conflict',
        code: 'cap_groups_reached',
        message: `Group cap reached (${MAX_GROUPS_PER_TEACHER} per teacher). Archive or delete an existing group first.`,
        limit: MAX_GROUPS_PER_TEACHER,
      });
      return;
    }
    const now = Date.now();
    const inviteCode = await mintUniqueCode();
    const group: Group = {
      id: uuidv4(),
      teacher_id: req.user!.id,
      name: name.trim(),
      invite_code: inviteCode,
      archived_at: null,
      created_at: now,
    };
    await client.execute(
      'INSERT INTO groups (id, teacher_id, name, invite_code, created_at) VALUES (?, ?, ?, ?, ?)',
      [group.id, group.teacher_id, group.name, group.invite_code, group.created_at],
    );
    res.status(201).json({ ...group, member_count: 0 });
  });

  // PATCH /api/groups/:id — teacher: rename or archive/unarchive
  router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
    const groupId = req.params['id'] as string;
    const group = await checkGroupOwnership(groupId, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const { name, archived } = req.body as { name?: string; archived?: boolean };
    const updates: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Bad Request', message: 'Name must be non-empty' });
        return;
      }
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (archived !== undefined) {
      updates.push('archived_at = ?');
      values.push(archived ? Date.now() : null);
    }
    if (updates.length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'No fields to update' });
      return;
    }
    values.push(groupId);
    const client = getClient();
    await client.execute(`UPDATE groups SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated = (await client.execute('SELECT * FROM groups WHERE id = ?', [groupId])).rows[0] as unknown as Group;
    res.json(updated);
  });

  // POST /api/groups/:id/invite-code/regenerate — teacher: rotate invite code
  router.post('/:id/invite-code/regenerate', async (req: Request, res: Response): Promise<void> => {
    const groupId = req.params['id'] as string;
    const group = await checkGroupOwnership(groupId, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const code = await mintUniqueCode();
    await getClient().execute('UPDATE groups SET invite_code = ? WHERE id = ?', [code, groupId]);
    res.json({ invite_code: code });
  });

  // GET /api/groups/:id — teacher or member: get group with members
  router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    const client = getClient();
    const group = (await client.execute(
      'SELECT * FROM groups WHERE id = ?',
      [req.params['id'] as string],
    )).rows[0] as unknown as Group | undefined;
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const isTeacher = group.teacher_id === req.user!.id;
    const isMember = !!(await client.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
      [req.params['id'] as string, req.user!.id],
    )).rows[0];
    if (!isTeacher && !isMember) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }
    const members = (await client.execute(
      `SELECT gm.id, gm.student_id, gm.joined_at,
              u.name as student_name, u.handle as student_handle
       FROM group_members gm
       JOIN users u ON u.id = gm.student_id
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`,
      [req.params['id'] as string],
    )).rows as unknown as GroupMember[];
    res.json({ ...group, members });
  });

  // POST /api/groups/:id/session/start — mint a session token bound to this
  // group. Only the group's owner (teacher) can start it. The token grants
  // read access to the group snapshot for its TTL (~2h), and only for that
  // window — enforced by verifySessionToken's exp check on every read.
  //
  // This is the *time-boxing* mechanism: without a live token, the snapshot
  // endpoint is unreachable. See SPP-1.
  router.post('/:id/session/start', async (req: Request, res: Response): Promise<void> => {
    const groupId = req.params['id'] as string;
    const group = await checkGroupOwnership(groupId, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const { token, payload } = issueSessionToken(req.user!.id, Date.now(), { groupId });
    res.status(201).json({
      token,
      session_id: payload.sid,
      group_id: groupId,
      expires_at: payload.exp,
    });
  });

  // GET /api/groups/:id/snapshot — latest code per member.
  //
  // *Time-boxed*: requires a session token (?token=...) whose payload is
  // bound to this exact group and hasn't expired. Without the token — or
  // once it's expired — the endpoint is unreachable. This replaces the
  // previous behavior where a teacher-role account could poll this endpoint
  // at any time, indefinitely, without any bounded window.
  //
  // Student `name` field is NOT returned — handle-only, per Safety &
  // Privacy SPP-2.
  router.get('/:id/snapshot', async (req: Request, res: Response): Promise<void> => {
    const groupId = req.params['id'] as string;
    const group = await checkGroupOwnership(groupId, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }

    const rawToken = typeof req.query['token'] === 'string' ? req.query['token'] : '';
    if (!rawToken) {
      res.status(401).json({ error: 'Unauthorized', message: 'session token required (?token=...)' });
      return;
    }
    const verified = verifySessionToken(rawToken, req.user!.id);
    if (!verified) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session token' });
      return;
    }
    if (verified.groupId !== groupId) {
      res.status(403).json({ error: 'Forbidden', message: 'token is not bound to this group' });
      return;
    }

    const client = getClient();
    const rows = (await client.execute(
      `SELECT gm.student_id, u.handle AS student_handle,
              p.id AS project_id, p.name AS project_name, p.updated_at, p.current_file, p.files
       FROM group_members gm
       JOIN users u ON u.id = gm.student_id
       LEFT JOIN projects p ON p.id = (
         SELECT id FROM projects WHERE user_id = gm.student_id
         ORDER BY updated_at DESC LIMIT 1
       )
       WHERE gm.group_id = ?
       ORDER BY gm.joined_at ASC`,
      [groupId],
    )).rows as unknown as Array<{
      student_id: string; student_handle: string | null;
      project_id: string | null; project_name: string | null;
      updated_at: number | null; current_file: string | null; files: string | null;
    }>;
    const members = rows.map((r) => ({
      student_id: r.student_id,
      student_handle: r.student_handle,
      project_id: r.project_id,
      project_name: r.project_name,
      updated_at: r.updated_at,
      current_file: r.current_file,
      files: r.files ? JSON.parse(r.files) : null,
    }));
    res.json({
      group_id: groupId,
      generated_at: Date.now(),
      session_expires_at: verified.exp,
      members,
    });
  });

  // DELETE /api/groups/:id — teacher: delete group
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    const groupId = req.params['id'] as string;
    const group = await checkGroupOwnership(groupId, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const client = getClient();
    await client.batch([
      { sql: 'DELETE FROM group_members WHERE group_id = ?', args: [groupId] },
      { sql: 'DELETE FROM groups WHERE id = ?', args: [groupId] },
    ]);
    res.status(204).send();
  });

  // POST /api/groups/:id/invite — teacher: invite user by handle/name
  router.post('/:id/invite', async (req: Request, res: Response): Promise<void> => {
    const group = await checkGroupOwnership(req.params['id'] as string, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Username is required' });
      return;
    }
    const client = getClient();
    const query = username.trim().replace(/^@/, '');
    const target = (await client.execute(
      'SELECT id, name, handle, role FROM users WHERE lower(handle) = lower(?) OR name = ?',
      [query, query],
    )).rows[0] as { id: string; name: string; handle: string | null; role: string } | undefined;
    if (!target) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }
    if (target.id === req.user!.id) {
      res.status(400).json({ error: 'Bad Request', message: 'Cannot add yourself' });
      return;
    }
    if (target.role !== 'student') {
      res.status(400).json({ error: 'Bad Request', message: 'Only students can be added to groups' });
      return;
    }
    const existing = (await client.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
      [req.params['id'] as string, target.id],
    )).rows[0];
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'User is already in this group' });
      return;
    }
    const memberCount = (await client.execute(
      'SELECT COUNT(*) as n FROM group_members WHERE group_id = ?',
      [req.params['id'] as string],
    )).rows[0] as { n: number };
    if (Number(memberCount.n) >= MAX_MEMBERS_PER_GROUP) {
      res.status(409).json({
        error: 'Conflict',
        code: 'cap_members_reached',
        message: `Member cap reached (${MAX_MEMBERS_PER_GROUP} per group). Remove an existing member first.`,
        limit: MAX_MEMBERS_PER_GROUP,
      });
      return;
    }
    const member: GroupMember = {
      id: uuidv4(),
      group_id: req.params['id'] as string,
      student_id: target.id as string,
      joined_at: Date.now(),
    };
    await client.execute(
      'INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)',
      [member.id, member.group_id, member.student_id, member.joined_at],
    );
    res.status(201).json({ ...member, student_name: target.name, student_handle: target.handle });
  });

  // DELETE /api/groups/:id/members/:userId — teacher: remove member
  router.delete('/:id/members/:userId', async (req: Request, res: Response): Promise<void> => {
    const group = await checkGroupOwnership(req.params['id'] as string, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const client = getClient();
    const member = (await client.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
      [req.params['id'] as string, req.params['userId'] as string],
    )).rows[0];
    if (!member) {
      res.status(404).json({ error: 'Not Found', message: 'Member not found' });
      return;
    }
    await client.execute(
      'DELETE FROM group_members WHERE group_id = ? AND student_id = ?',
      [req.params['id'] as string, req.params['userId'] as string],
    );
    res.status(204).send();
  });

  return router;
}

export default createGroupsRouter;
