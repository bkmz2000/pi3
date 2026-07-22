import { create } from 'zustand';
import { startSession, joinSession } from './api';

/**
 * Current live coding session the user is part of, if any. The signed token IS
 * the membership (no server row) — we just hold it client-side and stamp it
 * onto presence pings so the session roster can find peers.
 *
 * `groupId` present ⇒ classroom (asymmetric) session; absent ⇒ symmetric peer
 * session. `role` is 'starter' for whoever minted the token, 'joiner' otherwise.
 */
export interface LiveSessionState {
  token: string | null;
  sid: string | null;
  role: 'starter' | 'joiner' | null;
  expiresAt: number | null;
  start: () => Promise<void>;
  join: (token: string) => Promise<void>;
  // Adopt a token minted elsewhere (e.g. a teacher's classroom session/start).
  adopt: (token: string, sid: string, role: 'starter' | 'joiner', expiresAt: number) => void;
  leave: () => void;
}

export const useLiveSession = create<LiveSessionState>((set) => ({
  token: null,
  sid: null,
  role: null,
  expiresAt: null,

  start: async () => {
    const r = await startSession();
    set({ token: r.token, sid: r.session_id, role: 'starter', expiresAt: r.expires_at });
  },

  join: async (token: string) => {
    const r = await joinSession(token);
    set({ token, sid: r.session_id, role: r.role, expiresAt: r.expires_at });
  },

  adopt: (token, sid, role, expiresAt) => set({ token, sid, role, expiresAt }),

  leave: () => set({ token: null, sid: null, role: null, expiresAt: null }),
}));
