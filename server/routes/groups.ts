import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { getClient } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 6;

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

function requireTeacher(req: Request, res: Response): boolean {
  if (req.user!.role !== 'teacher') {
    res.status(403).json({ error: 'Forbidden', message: 'Only teachers can perform this action' });
    return false;
  }
  return true;
}

async function checkGroupOwnership(groupId: string, teacherId: string): Promise<Group | undefined> {
  return (await getClient().execute(
    'SELECT * FROM groups WHERE id = ? AND teacher_id = ?',
    [groupId, teacherId],
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
    const client = getClient();
    const normalized = code.trim().toUpperCase();
    const group = (await client.execute(
      'SELECT * FROM groups WHERE invite_code = ? AND archived_at IS NULL',
      [normalized],
    )).rows[0] as unknown as Group | undefined;
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Invalid or expired invite code' });
      return;
    }
    if (group.teacher_id === req.user!.id) {
      res.status(400).json({ error: 'Bad Request', message: 'Teachers cannot join their own group' });
      return;
    }
    const existing = (await client.execute(
      'SELECT id FROM group_members WHERE group_id = ? AND student_id = ?',
      [group.id, req.user!.id],
    )).rows[0];
    if (existing) {
      res.status(200).json({ id: group.id, name: group.name, already_member: true });
      return;
    }
    await client.execute(
      'INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)',
      [uuidv4(), group.id, req.user!.id, Date.now()],
    );
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
    if (!requireTeacher(req, res)) return;
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
    if (!requireTeacher(req, res)) return;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Group name is required' });
      return;
    }
    const client = getClient();
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
    if (!requireTeacher(req, res)) return;
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
    if (!requireTeacher(req, res)) return;
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

  // DELETE /api/groups/:id — teacher: delete group
  router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    if (!requireTeacher(req, res)) return;
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
    if (!requireTeacher(req, res)) return;
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
    if (!requireTeacher(req, res)) return;
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
