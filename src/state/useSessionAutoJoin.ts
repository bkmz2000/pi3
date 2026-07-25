import { useEffect, useRef } from 'react';
import { useLiveSession } from './useLiveSession';
import { takePendingSessionToken } from './pendingSession';

/**
 * Joins the session a shared link pointed at, once, as soon as the app is
 * usable. The token was lifted out of the URL at boot (see pendingSession.ts) —
 * it may have waited there through a landing-page visit and a sign-in.
 *
 * Lives outside the live panel on purpose: a join link must work whether or not
 * the user ever opens that panel.
 */
export function useSessionAutoJoin(enabled: boolean) {
  const join = useLiveSession((s) => s.join);
  const claimed = useRef(false);

  useEffect(() => {
    if (!enabled || claimed.current) return;
    const token = takePendingSessionToken();
    if (!token) return;
    claimed.current = true;
    join(token).catch(() => { /* invalid or expired link — ignore */ });
  }, [enabled, join]);
}
