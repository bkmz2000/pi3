import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

interface Group {
  id: string;
  teacher_id: string;
  name: string;
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

function checkGroupOwnership(groupId: string, teacherId: string): Group | undefined {
  return getDb().prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(groupId, teacherId) as Group | undefined;
}

export function createGroupsRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // GET /api/groups/my — student: list groups I'm in
  router.get('/my', (req: Request, res: Response): void => {
    const db = getDb();
    const groups = db.prepare(`
      SELECT g.id, g.name, g.created_at, u.name as teacher_name
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      JOIN users u ON u.id = g.teacher_id
      WHERE gm.student_id = ?
      ORDER BY g.created_at DESC
    `).all(req.user!.id);
    res.json(groups);
  });

  // GET /api/groups — teacher: list my groups with member count
  router.get('/', (req: Request, res: Response): void => {
    if (!requireTeacher(req, res)) return;
    const db = getDb();
    const groups = db.prepare(`
      SELECT g.id, g.name, g.created_at,
             COUNT(gm.id) as member_count
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      WHERE g.teacher_id = ?
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `).all(req.user!.id);
    res.json(groups);
  });

  // POST /api/groups — teacher: create group
  router.post('/', (req: Request, res: Response): void => {
    if (!requireTeacher(req, res)) return;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Bad Request', message: 'Group name is required' });
      return;
    }
    const db = getDb();
    const now = Date.now();
    const group: Group = {
      id: uuidv4(),
      teacher_id: req.user!.id,
      name: name.trim(),
      created_at: now,
    };
    db.prepare('INSERT INTO groups (id, teacher_id, name, created_at) VALUES (?, ?, ?, ?)')
      .run(group.id, group.teacher_id, group.name, group.created_at);
    res.status(201).json({ ...group, member_count: 0 });
  });

  // GET /api/groups/:id — teacher or member: get group with members
  router.get('/:id', (req: Request, res: Response): void => {
    const db = getDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params['id'] as string) as Group | undefined;
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const isTeacher = group.teacher_id === req.user!.id;
    const isMember = !!db.prepare('SELECT id FROM group_members WHERE group_id = ? AND student_id = ?').get(req.params['id'] as string, req.user!.id);
    if (!isTeacher && !isMember) {
      res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
      return;
    }
    const members = db.prepare(`
      SELECT gm.id, gm.student_id, gm.joined_at, u.name as student_name
      FROM group_members gm
      JOIN users u ON u.id = gm.student_id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC
    `).all(req.params['id'] as string) as GroupMember[];
    res.json({ ...group, members });
  });

  // DELETE /api/groups/:id — teacher: delete group
  router.delete('/:id', (req: Request, res: Response): void => {
    if (!requireTeacher(req, res)) return;
    const groupId = req.params['id'] as string;
    const group = checkGroupOwnership(groupId, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const db = getDb();
    db.transaction(() => {
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
      db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
    })();
    res.status(204).send();
  });

  // POST /api/groups/:id/invite — teacher: invite user by email/name
  router.post('/:id/invite', (req: Request, res: Response): void => {
    if (!requireTeacher(req, res)) return;
    const group = checkGroupOwnership(req.params['id'] as string, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Username is required' });
      return;
    }
    const db = getDb();
    const target = db.prepare('SELECT id, name, role FROM users WHERE name = ?').get(username.trim()) as { id: string; name: string; role: string } | undefined;
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
    const existing = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND student_id = ?').get(req.params['id'] as string, target.id);
    if (existing) {
      res.status(409).json({ error: 'Conflict', message: 'User is already in this group' });
      return;
    }
    const member: GroupMember = {
      id: uuidv4(),
      group_id: req.params['id'] as string,
      student_id: target.id,
      joined_at: Date.now(),
    };
    db.prepare('INSERT INTO group_members (id, group_id, student_id, joined_at) VALUES (?, ?, ?, ?)')
      .run(member.id, member.group_id, member.student_id, member.joined_at);
    res.status(201).json({ ...member, student_name: target.name });
  });

  // DELETE /api/groups/:id/members/:userId — teacher: remove member
  router.delete('/:id/members/:userId', (req: Request, res: Response): void => {
    if (!requireTeacher(req, res)) return;
    const group = checkGroupOwnership(req.params['id'] as string, req.user!.id);
    if (!group) {
      res.status(404).json({ error: 'Not Found', message: 'Group not found' });
      return;
    }
    const db = getDb();
    const member = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND student_id = ?')
      .get(req.params['id'] as string, req.params['userId'] as string);
    if (!member) {
      res.status(404).json({ error: 'Not Found', message: 'Member not found' });
      return;
    }
    db.prepare('DELETE FROM group_members WHERE group_id = ? AND student_id = ?')
      .run(req.params['id'] as string, req.params['userId'] as string);
    res.status(204).send();
  });

  return router;
}

export default createGroupsRouter;
