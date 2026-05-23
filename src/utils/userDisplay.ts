// Display helpers for user identity. The `@handle` form is the public
// identifier; `name` is the editable display fallback for users without
// a handle (e.g. during staged rollout when the column is freshly added).

export function formatHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  return `@${handle}`;
}

export function userLabel(name: string, handle: string | null | undefined): string {
  return handle ? `@${handle}` : name;
}
