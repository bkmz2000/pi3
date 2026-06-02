// localStorage-backed stash for anonymous / pre-fork work. Persists across
// reloads so a logged-out user can keep tinkering with an example and not lose
// it. On sign-in, the user is offered a "claim this work as a project" path.

import type { Project } from "../state/IdeState";

const STASH_KEY = "pi3_anon_stash";

export type AnonStash = {
  // Built-in example this session was forked from, if any. Pure-edited state
  // without a backing example is also supported (set to "" / undefined).
  exampleName?: string;
  project: Project;
  lastModified: number;
  // Schema version for forward-compat
  v: 1;
};

export function readAnonStash(): AnonStash | null {
  try {
    const raw = localStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnonStash;
    if (parsed?.v !== 1 || !parsed.project) return null;
    return parsed;
  } catch {
    return null;
  }
}

export type AnonStashWriteResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unavailable" };

// QuotaExceededError is thrown when the user is over the localStorage limit
// (~5MB in most browsers). DOMException.name is the only cross-browser-stable
// way to detect this — code 22 in spec, 1014 in Firefox.
function isQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014
  );
}

export function writeAnonStash(stash: Omit<AnonStash, "v" | "lastModified">): AnonStashWriteResult {
  try {
    const full: AnonStash = { ...stash, lastModified: Date.now(), v: 1 };
    localStorage.setItem(STASH_KEY, JSON.stringify(full));
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: isQuotaError(e) ? "quota" : "unavailable" };
  }
}

export function clearAnonStash(): void {
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    /* ignore */
  }
}
