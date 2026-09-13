import { create } from 'zustand';
import { startSession, joinSession } from './api';

/** A peer whose live buffer is open as a read-only tab in the editor. */
export interface PeerTab {
  id: string;
  label: string;
}

/**
 * Current live coding session the user is part of, if any. A signed token is
 * held client-side and stamped onto presence pings. Link rooms are stateless;
 * classroom tokens are additionally checked against a revocable server row.
 *
 * `groupId` present ⇒ classroom (asymmetric) session; absent ⇒ symmetric peer
 * session. `role` is 'starter' for whoever minted the token, 'joiner' otherwise.
 *
 * Peer tabs live here too: they are session state, so leaving closes them.
 */
export interface LiveSessionState {
  token: string | null;
  sid: string | null;
  role: 'starter' | 'joiner' | null;
  expiresAt: number | null;
  kind: 'room' | 'classroom' | null;
  groupId: string | null;
  label: string | null;
  peerTabs: PeerTab[];
  activePeer: string | null;
  start: () => Promise<void>;
  join: (token: string) => Promise<void>;
  // Adopt a token minted elsewhere (e.g. a teacher's classroom session/start).
  adopt: (
    token: string,
    sid: string,
    role: 'starter' | 'joiner',
    expiresAt: number,
    meta?: { kind?: 'room' | 'classroom'; groupId?: string; label?: string },
  ) => void;
  leave: () => void;
  openPeer: (peer: PeerTab) => void;
  closePeer: (id: string) => void;
  focusPeer: (id: string | null) => void;
}

export const useLiveSession = create<LiveSessionState>((set) => ({
  token: null,
  sid: null,
  role: null,
  expiresAt: null,
  kind: null,
  groupId: null,
  label: null,
  peerTabs: [],
  activePeer: null,

  start: async () => {
    const r = await startSession();
    set({
      token: r.token, sid: r.session_id, role: 'starter', expiresAt: r.expires_at,
      kind: 'room', groupId: null, label: null,
    });
  },

  join: async (token: string) => {
    const r = await joinSession(token);
    set({
      token, sid: r.session_id, role: r.role, expiresAt: r.expires_at,
      kind: r.group_id ? 'classroom' : 'room', groupId: r.group_id ?? null, label: null,
    });
  },

  adopt: (token, sid, role, expiresAt, meta) => set({
    token, sid, role, expiresAt,
    kind: meta?.kind ?? 'room',
    groupId: meta?.groupId ?? null,
    label: meta?.label ?? null,
  }),

  leave: () => set({
    token: null, sid: null, role: null, expiresAt: null,
    kind: null, groupId: null, label: null, peerTabs: [], activePeer: null,
  }),

  // Opening an already-open peer just focuses its tab (and refreshes the label,
  // which follows the roster's display name).
  openPeer: (peer) => set((s) => ({
    peerTabs: s.peerTabs.some((p) => p.id === peer.id)
      ? s.peerTabs.map((p) => (p.id === peer.id ? peer : p))
      : [...s.peerTabs, peer],
    activePeer: peer.id,
  })),

  closePeer: (id) => set((s) => ({
    peerTabs: s.peerTabs.filter((p) => p.id !== id),
    activePeer: s.activePeer === id ? null : s.activePeer,
  })),

  focusPeer: (id) => set({ activePeer: id }),
}));
