// localStorage-backed stash for anonymous / pre-fork work. Persists across
// reloads so a logged-out user can keep tinkering with an example and not lose
// it. On sign-in, the user is offered a "claim this work as a project" path.

import type { Project } from "../state/IdeState";

const STASH_KEY = "pi3_anon_stash";

export type AnonStash = {
  // Built-in example this session was forked from, if any. Pure-edited state
  // without a backing example is also supported (set to "" / undefined).
  exampleName: string;
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
    if (parsed?.v !== 1 || !parsed.project || !parsed.exampleName) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAnonStash(stash: Omit<AnonStash, "v" | "lastModified">): void {
  try {
    const full: AnonStash = { ...stash, lastModified: Date.now(), v: 1 };
    localStorage.setItem(STASH_KEY, JSON.stringify(full));
  } catch {
    // Quota exceeded or storage unavailable — silent; the autosave will retry.
  }
}

export function clearAnonStash(): void {
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    /* ignore */
  }
}
