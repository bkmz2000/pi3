export const EXAMPLE_SESSION_PREFIX = "__example_session_";

export function isExampleSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(EXAMPLE_SESSION_PREFIX);
}

export function exampleNameFromSessionId(id: string): string {
  return id.slice(EXAMPLE_SESSION_PREFIX.length);
}
