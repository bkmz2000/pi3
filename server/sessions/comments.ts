// Emoji-only comments inside an ephemeral session, per Safety & Privacy
// Design Principle #4: in-session communication is structural, not filtered —
// a fixed whitelist, no free-text path.
//
// Storage is in-memory and per-process. Sessions expire after ~2h anyway
// (see sessions/tokens.ts), and comments have no value beyond the session.
// A server restart wipes them, which is acceptable given the design.

export const ALLOWED_EMOJI: readonly string[] = Object.freeze([
  '👍',   // thumbs up — I get it / this is right
  '👎',   // thumbs down — I don't get it / this is wrong
  '⁉️',   // interrobang — what does this even do?
  '🥶',   // cold face — this is frozen / stuck
  '☠️',   // skull — this crashes
  '🔥',   // fire — cool / hot code
  '🐢',   // turtle — this is slow
  '1️⃣',   // one-with-keycap — try step 1 first
]);

const ALLOWED_SET = new Set(ALLOWED_EMOJI);

export type SessionComment = {
  id: string;
  author_id: string;
  emoji: string;
  target?: string;   // optional line reference or file/line, opaque to server
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

// Test-only: wipe all in-memory comments. Not exported through any HTTP route.
export function _resetForTests(): void {
  store.clear();
}
