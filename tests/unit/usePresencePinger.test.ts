import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { usePresencePinger } from '../../src/state/usePresencePinger';
import { useLiveSession } from '../../src/state/useLiveSession';

jest.mock('../../src/state/api', () => ({
  postLivePresence: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { postLivePresence } = require('../../src/state/api') as { postLivePresence: jest.Mock };

function fakeEditorRef(line = 5, text = 'print(1)') {
  return {
    current: {
      view: {
        state: {
          selection: { main: { head: 0 } },
          doc: { lineAt: () => ({ number: line }), lines: line, toString: () => text },
        },
      },
    },
  };
}

describe('usePresencePinger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    postLivePresence.mockClear();
    useLiveSession.setState({ token: null, sid: null, role: null, expiresAt: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when logged out', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHook(() => usePresencePinger({ projectId: 'p1', currentFile: 'main.py', editorRef: fakeEditorRef() as any, loggedIn: false }));
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('does nothing for example sessions (with no live session active)', () => {
    renderHook(() => usePresencePinger({
      projectId: '__example_session_flappy',
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef() as any,
      loggedIn: true,
    }));
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('does nothing when projectId is null and no session is active', () => {
    renderHook(() => usePresencePinger({
      projectId: null,
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef() as any,
      loggedIn: true,
    }));
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('pings immediately with content + null session, then again on interval', () => {
    renderHook(() => usePresencePinger({
      projectId: 'proj-42',
      currentFile: 'game.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(7, 'x = 1') as any,
      loggedIn: true,
    }));
    expect(postLivePresence).toHaveBeenCalledWith('proj-42', 'game.py', 7, expect.objectContaining({
      content: 'x = 1',
      sessionId: null,
    }));
    // One ping per second — the roster has to read as live.
    act(() => { jest.advanceTimersByTime(1000); });
    expect(postLivePresence).toHaveBeenCalledTimes(2);
  });

  it('omits content on the second ping when the buffer is unchanged (skip-unchanged)', () => {
    renderHook(() => usePresencePinger({
      projectId: 'proj-42',
      currentFile: 'game.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(7, 'stable') as any,
      loggedIn: true,
    }));
    // First ping carries content.
    expect(postLivePresence.mock.calls[0][3]).toHaveProperty('content', 'stable');
    act(() => { jest.advanceTimersByTime(1000); });
    // Second ping (unchanged) omits content entirely.
    expect(postLivePresence.mock.calls[1][3]).not.toHaveProperty('content');
  });

  it('stamps the active session id and pings even without a real project', () => {
    useLiveSession.setState({ token: 'tok', sid: 'sess-xyz', role: 'starter', expiresAt: Date.now() + 1000 });
    renderHook(() => usePresencePinger({
      projectId: null,
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(2, 'code') as any,
      loggedIn: true,
    }));
    expect(postLivePresence).toHaveBeenCalledWith('session:sess-xyz', 'main.py', 2, expect.objectContaining({
      sessionId: 'sess-xyz',
    }));
  });

  it('cleans up the interval on unmount', () => {
    const { unmount } = renderHook(() => usePresencePinger({
      projectId: 'proj-9',
      currentFile: 'a.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef() as any,
      loggedIn: true,
    }));
    postLivePresence.mockClear();
    unmount();
    act(() => { jest.advanceTimersByTime(10000); });
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('clears the session stamp when the user leaves a session', () => {
    useLiveSession.setState({ token: 'tok', sid: 'sess-leave', role: 'joiner', expiresAt: Date.now() + 1000 });
    renderHook(() => usePresencePinger({
      projectId: null,
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(4, 'code') as any,
      loggedIn: true,
    }));
    postLivePresence.mockClear();
    act(() => { useLiveSession.getState().leave(); });
    // The synthetic row is never pinged again, so leaving has to null the
    // stamp explicitly or the leaver ghosts on their peers' roster.
    expect(postLivePresence).toHaveBeenCalledWith('session:sess-leave', 'main.py', 4, { sessionId: null });
  });

  it('does not clear the stamp on unmount while still in the session', () => {
    useLiveSession.setState({ token: 'tok', sid: 'sess-stay', role: 'joiner', expiresAt: Date.now() + 1000 });
    const { unmount } = renderHook(() => usePresencePinger({
      projectId: null,
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(2, 'code') as any,
      loggedIn: true,
    }));
    postLivePresence.mockClear();
    unmount();
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('falls back to "main.py" when currentFile is empty', () => {
    renderHook(() => usePresencePinger({
      projectId: 'proj-1',
      currentFile: '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(3) as any,
      loggedIn: true,
    }));
    expect(postLivePresence).toHaveBeenCalledWith('proj-1', 'main.py', 3, expect.anything());
  });

  it('swallows postLivePresence rejections', async () => {
    postLivePresence.mockRejectedValueOnce(new Error('offline'));
    renderHook(() => usePresencePinger({
      projectId: 'proj-1',
      currentFile: 'x.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef() as any,
      loggedIn: true,
    }));
    await act(async () => { await Promise.resolve(); });
    expect(postLivePresence).toHaveBeenCalled();
  });
});
