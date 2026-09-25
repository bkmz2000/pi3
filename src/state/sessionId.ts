export const EXAMPLE_SESSION_PREFIX = "__example_session_";
export const ANON_DRAFT_PREFIX = "__anon_draft_";

export function createAnonymousDraftId(): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${ANON_DRAFT_PREFIX}${id}`;
}

export function isAnonymousDraftId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(ANON_DRAFT_PREFIX);
}

export function isExampleSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(EXAMPLE_SESSION_PREFIX);
}

export function exampleNameFromSessionId(id: string): string {
  return id.slice(EXAMPLE_SESSION_PREFIX.length);
}
