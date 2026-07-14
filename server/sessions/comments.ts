// Emoji-only comments inside an ephemeral session. Fixed whitelist,
// no free-text path — structural, not filter-based, prevention.
//
// Storage is in-memory and per-process. Sessions expire after ~2h anyway
// (see tokens.ts), and comments have no value beyond the session.
// A server restart wipes them, which is acceptable given the design.

export const ALLOWED_EMOJI: readonly string[] = Object.freeze([
  '👍',
  '👎',
  '⁉️',
  '🥶',
  '☠️',
  '🔥',
  '🐢',
  '1️⃣',
]);

const ALLOWED_SET = new Set(ALLOWED_EMOJI);

export type SessionComment = {
  id: string;
  author_id: string;
  emoji: string;
  target?: string;
  created_at: number;
};

const store = new Map<string, SessionComment[]>();

export function isAllowedEmoji(s: unknown): s is string {
  return typeof s === 'string' && ALLOWED_SET.has(s);
}

export function addComment(sessionId: string, authorId: string, emoji: string, target?: string): SessionComment {
  const comment: SessionComment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    author_id: authorId,
    emoji,
    target,
    created_at: Date.now(),
  };
  const list = store.get(sessionId) ?? [];
  list.push(comment);
  store.set(sessionId, list);
  return comment;
}

export function listComments(sessionId: string): SessionComment[] {
  return [...(store.get(sessionId) ?? [])];
}

export function _resetForTests(): void {
  store.clear();
}
