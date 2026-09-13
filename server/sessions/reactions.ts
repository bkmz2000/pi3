// Fixed, semantic line reactions for live sessions. There is deliberately no
// free-text path: a reaction is a small teaching signal tied to one file/line.

export const ALLOWED_REACTIONS = Object.freeze(['good', 'question', 'try'] as const);
export type ReactionKind = (typeof ALLOWED_REACTIONS)[number];

const allowed = new Set<string>(ALLOWED_REACTIONS);

export type SessionReaction = {
  id: string;
  author_id: string;
  reaction: ReactionKind;
  target: string;
  file: string;
  line: number;
  created_at: number;
};

const store = new Map<string, SessionReaction[]>();

export function isAllowedReaction(value: unknown): value is ReactionKind {
  return typeof value === 'string' && allowed.has(value);
}

export function addReaction(
  sessionId: string,
  authorId: string,
  reaction: ReactionKind,
  target: string,
  file: string,
  line: number,
): SessionReaction {
  const item: SessionReaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    author_id: authorId,
    reaction,
    target,
    file,
    line,
    created_at: Date.now(),
  };
  const items = store.get(sessionId) ?? [];
  items.push(item);
  store.set(sessionId, items);
  return item;
}

export function listReactions(sessionId: string): SessionReaction[] {
  return [...(store.get(sessionId) ?? [])];
}

export function _resetForTests(): void {
  store.clear();
}
