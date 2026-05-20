import { getDb } from '../db/index.js';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export const ROLE_LEVEL: Record<ProjectRole, number> = { owner: 3, editor: 2, viewer: 1 };

export interface ProjectAccess {
  exists: boolean;
  role: ProjectRole | null;
}

const ACCESS_SQL = `
  SELECT CASE WHEN p.user_id = ? THEN 'owner'
              WHEN ps.role IS NOT NULL THEN ps.role
              ELSE NULL END as role
  FROM projects p
  LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
  WHERE p.id = ?
`;

const ACCESS_WITH_DATA_SQL = `
  SELECT p.*,
         CASE WHEN p.user_id = ? THEN 'owner'
              WHEN ps.role IS NOT NULL THEN ps.role
              ELSE NULL END as role
  FROM projects p
  LEFT JOIN project_shares ps ON p.id = ps.project_id AND ps.user_id = ?
  WHERE p.id = ?
`;

export function getProjectAccess(projectId: string, userId: string): ProjectAccess {
  const db = getDb();
  const row = db.prepare(ACCESS_SQL).get(userId, userId, projectId) as { role: ProjectRole | null } | undefined;
  if (!row) return { exists: false, role: null };
  return { exists: true, role: row.role };
}

export function getProjectWithAccess<T extends object>(projectId: string, userId: string): (T & { role: ProjectRole | null }) | undefined {
  const db = getDb();
  return db.prepare(ACCESS_WITH_DATA_SQL).get(userId, userId, projectId) as (T & { role: ProjectRole | null }) | undefined;
}

export function hasRole(subject: { role: ProjectRole | null }, minRole: ProjectRole): boolean {
  if (!subject.role) return false;
  return ROLE_LEVEL[subject.role] >= ROLE_LEVEL[minRole];
}
