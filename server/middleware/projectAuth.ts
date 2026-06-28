import { getClient } from '../db/index.js';

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

export async function getProjectAccess(projectId: string, userId: string): Promise<ProjectAccess> {
  const client = getClient();
  const result = await client.execute(ACCESS_SQL, [userId, userId, projectId]);
  const row = result.rows[0] as { role: ProjectRole | null } | undefined;
  if (!row) return { exists: false, role: null };
  return { exists: true, role: row.role };
}

export async function getProjectWithAccess<T extends object>(
  projectId: string,
  userId: string,
): Promise<(T & { role: ProjectRole | null }) | undefined> {
  const client = getClient();
  const result = await client.execute(ACCESS_WITH_DATA_SQL, [userId, userId, projectId]);
  return result.rows[0] as (T & { role: ProjectRole | null }) | undefined;
}

export function hasRole(subject: { role: ProjectRole | null }, minRole: ProjectRole): boolean {
  if (!subject.role) return false;
  return ROLE_LEVEL[subject.role] >= ROLE_LEVEL[minRole];
}
