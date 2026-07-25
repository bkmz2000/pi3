import { useLiveSession } from '../../src/state/useLiveSession';

jest.mock('../../src/state/api', () => ({
  startSession: jest.fn(),
  joinSession: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startSession, joinSession } = require('../../src/state/api') as {
  startSession: jest.Mock;
  joinSession: jest.Mock;
};

describe('useLiveSession', () => {
  beforeEach(() => {
    useLiveSession.setState({ token: null, sid: null, role: null, expiresAt: null, peerTabs: [], activePeer: null });
    startSession.mockReset();
    joinSession.mockReset();
  });

  it('start() mints a token and marks the caller the starter', async () => {
    startSession.mockResolvedValue({ token: 'tok-1', session_id: 'sid-1', expires_at: 999 });
    await useLiveSession.getState().start();
    const s = useLiveSession.getState();
    expect(s.token).toBe('tok-1');
    expect(s.sid).toBe('sid-1');
    expect(s.role).toBe('starter');
    expect(s.expiresAt).toBe(999);
  });

  it('join() adopts the token with the server-derived role', async () => {
    joinSession.mockResolvedValue({ session_id: 'sid-2', starter_id: 'u9', role: 'joiner', expires_at: 42 });
    await useLiveSession.getState().join('tok-2');
    const s = useLiveSession.getState();
    expect(s.token).toBe('tok-2');
    expect(s.sid).toBe('sid-2');
    expect(s.role).toBe('joiner');
  });

  it('adopt() sets a session minted elsewhere; leave() clears everything', () => {
    useLiveSession.getState().adopt('tok-3', 'sid-3', 'starter', 100);
    expect(useLiveSession.getState().sid).toBe('sid-3');
    useLiveSession.getState().leave();
    const s = useLiveSession.getState();
    expect(s.token).toBeNull();
    expect(s.sid).toBeNull();
    expect(s.role).toBeNull();
  });

  describe('peer tabs', () => {
    it('openPeer() adds a tab and focuses it', () => {
      useLiveSession.getState().openPeer({ id: 'p1', label: '@one' });
      useLiveSession.getState().openPeer({ id: 'p2', label: '@two' });
      const s = useLiveSession.getState();
      expect(s.peerTabs.map((p) => p.id)).toEqual(['p1', 'p2']);
      expect(s.activePeer).toBe('p2');
    });

    it('re-opening a peer refocuses it and refreshes the label instead of duplicating', () => {
      useLiveSession.getState().openPeer({ id: 'p1', label: '@one' });
      useLiveSession.getState().openPeer({ id: 'p2', label: '@two' });
      useLiveSession.getState().openPeer({ id: 'p1', label: '@one-renamed' });
      const s = useLiveSession.getState();
      expect(s.peerTabs).toEqual([{ id: 'p1', label: '@one-renamed' }, { id: 'p2', label: '@two' }]);
      expect(s.activePeer).toBe('p1');
    });

    it('closePeer() drops the tab and only clears focus when it was the focused one', () => {
      useLiveSession.getState().openPeer({ id: 'p1', label: '@one' });
      useLiveSession.getState().openPeer({ id: 'p2', label: '@two' });
      useLiveSession.getState().closePeer('p1'); // p2 still focused
      expect(useLiveSession.getState().activePeer).toBe('p2');
      useLiveSession.getState().closePeer('p2');
      const s = useLiveSession.getState();
      expect(s.peerTabs).toEqual([]);
      expect(s.activePeer).toBeNull();
    });

    it('focusPeer(null) returns to the file tabs without closing the peer tab', () => {
      useLiveSession.getState().openPeer({ id: 'p1', label: '@one' });
      useLiveSession.getState().focusPeer(null);
      const s = useLiveSession.getState();
      expect(s.activePeer).toBeNull();
      expect(s.peerTabs).toHaveLength(1);
    });

    it('leave() closes every peer tab — peer buffers are session-scoped', () => {
      useLiveSession.getState().adopt('tok', 'sid', 'joiner', 1);
      useLiveSession.getState().openPeer({ id: 'p1', label: '@one' });
      useLiveSession.getState().leave();
      const s = useLiveSession.getState();
      expect(s.peerTabs).toEqual([]);
      expect(s.activePeer).toBeNull();
    });
  });
});
