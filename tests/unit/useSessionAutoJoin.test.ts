import { renderHook } from '@testing-library/react';
import { useSessionAutoJoin } from '../../src/state/useSessionAutoJoin';
import { capturePendingSessionToken, takePendingSessionToken } from '../../src/state/pendingSession';
import { useLiveSession } from '../../src/state/useLiveSession';

jest.mock('../../src/state/api', () => ({
  startSession: jest.fn(),
  joinSession: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { joinSession } = require('../../src/state/api') as { joinSession: jest.Mock };

function parkToken(token: string) {
  history.replaceState(null, '', `/ide#session=${token}`);
  capturePendingSessionToken();
}

describe('useSessionAutoJoin', () => {
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState(null, '', '/ide');
    joinSession.mockReset();
    joinSession.mockResolvedValue({ session_id: 'sid', starter_id: 'u1', role: 'joiner', expires_at: 1 });
    useLiveSession.setState({ token: null, sid: null, role: null, expiresAt: null, peerTabs: [], activePeer: null });
  });

  it('joins the parked session once enabled', async () => {
    parkToken('tok-abc');
    renderHook(() => useSessionAutoJoin(true));
    expect(joinSession).toHaveBeenCalledWith('tok-abc');
  });

  it('claims the token only once across re-renders', () => {
    parkToken('tok-abc');
    const { rerender } = renderHook(() => useSessionAutoJoin(true));
    rerender();
    rerender();
    expect(joinSession).toHaveBeenCalledTimes(1);
  });

  it('leaves the token parked while disabled (e.g. still signing in)', () => {
    parkToken('tok-later');
    renderHook(() => useSessionAutoJoin(false));
    expect(joinSession).not.toHaveBeenCalled();
    expect(takePendingSessionToken()).toBe('tok-later');
  });

  it('does nothing when no link was followed', () => {
    renderHook(() => useSessionAutoJoin(true));
    expect(joinSession).not.toHaveBeenCalled();
  });

  it('swallows an invalid or expired link', async () => {
    joinSession.mockRejectedValueOnce(new Error('expired'));
    parkToken('tok-dead');
    renderHook(() => useSessionAutoJoin(true));
    await Promise.resolve();
    expect(useLiveSession.getState().sid).toBeNull();
  });
});
