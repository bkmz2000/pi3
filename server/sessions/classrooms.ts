import { getClient } from '../db/index.js';
import type { VerifiedSession } from './tokens.js';

/** Link rooms are valid until token expiry. Group-bound tokens are additionally
 * revocable: the persisted classroom window must still match sid + group. */
export async function isSessionActive(session: VerifiedSession): Promise<boolean> {
  if (!session.groupId) return true;
  const row = (await getClient().execute(
    `SELECT 1 FROM live_group_sessions
     WHERE group_id = ? AND sid = ? AND expires_at > ?`,
    [session.groupId, session.sid, Date.now()],
  )).rows[0];
  return !!row;
}
