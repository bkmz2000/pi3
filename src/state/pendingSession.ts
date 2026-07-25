// A `#session=<token>` join link can land on any route — including the public
// landing page, where the session UI is not mounted, and where the visitor may
// still have to sign in first. Neither survives with the fragment intact: the
// navigation into the IDE drops it. So the token is lifted out of the URL once
// at boot and parked in sessionStorage until the session overlay can claim it.

const STORAGE_KEY = 'pi3.pendingSessionToken';

/**
 * Build a shareable join link — the counterpart of the capture below. The token
 * rides the fragment (never the query) so it stays out of server logs and
 * Referer headers, and the link points at /ide rather than the origin root:
 * under the public profile the root is the landing page, which does not run
 * the IDE.
 */
export function joinLink(token: string): string {
  return `${window.location.origin}/ide#session=${encodeURIComponent(token)}`;
}

/** Read `#session=<token>` from the current URL, strip it, and park it. */
export function capturePendingSessionToken(): void {
  const m = window.location.hash.match(/session=([^&]+)/);
  if (!m) return;
  // Clear the token from the URL immediately so it isn't left in history.
  history.replaceState(null, '', window.location.pathname + window.location.search);
  let token: string;
  try {
    token = decodeURIComponent(m[1]);
  } catch {
    return; // malformed link
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* storage blocked (private mode / embedded) — the link just won't auto-join */
  }
}

/** Claim the parked token, if any. Consuming it prevents a re-join loop. */
export function takePendingSessionToken(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token) sessionStorage.removeItem(STORAGE_KEY);
    return token;
  } catch {
    return null;
  }
}
