import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { usePresencePinger } from '../../src/state/usePresencePinger';

jest.mock('../../src/state/api', () => ({
  postLivePresence: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { postLivePresence } = require('../../src/state/api') as { postLivePresence: jest.Mock };

function fakeEditorRef(line = 5) {
  return {
    current: {
      view: {
        state: {
          selection: { main: { head: 0 } },
          doc: { lineAt: () => ({ number: line }) },
        },
      },
    },
  };
}

describe('usePresencePinger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    postLivePresence.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when logged out', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderHook(() => usePresencePinger({ projectId: 'p1', currentFile: 'main.py', editorRef: fakeEditorRef() as any, loggedIn: false }));
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('does nothing for example sessions', () => {
    renderHook(() => usePresencePinger({
      projectId: '__example_session_flappy',
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef() as any,
      loggedIn: true,
    }));
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('does nothing when projectId is null', () => {
    renderHook(() => usePresencePinger({
      projectId: null,
      currentFile: 'main.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef() as any,
      loggedIn: true,
    }));
    expect(postLivePresence).not.toHaveBeenCalled();
  });

  it('pings immediately and again on interval for a real project', () => {
    renderHook(() => usePresencePinger({
      projectId: 'proj-42',
      currentFile: 'game.py',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editorRef: fakeEditorRef(7) as any,
      loggedIn: true,
    }));
    // immediate tick
    expect(postLivePresence).toHaveBeenCalledWith('proj-42', 'game.py', 7);
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(postLivePresence).toHaveBeenCalledTimes(2);
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
    act(() => {
      jest.advanceTimersByTime(10000);
    });
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
    expect(postLivePresence).toHaveBeenCalledWith('proj-1', 'main.py', 3);
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
    // Give the microtask queue a spin so the rejection surfaces.
    await act(async () => { await Promise.resolve(); });
    expect(postLivePresence).toHaveBeenCalled();
  });
});
