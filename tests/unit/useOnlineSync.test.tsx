/**
 * useOnlineSync: syncs queued saves (a) on mount when already online and
 * (b) whenever the browser fires an "online" event. Must unsubscribe the
 * window listener on unmount. triggerSync is a storage re-export.
 */
import { renderHook, act } from '@testing-library/react';

const ideState = {
  syncQueuedSaves: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

jest.mock('../../src/state/IdeState', () => ({
  useIde: (selector: (s: unknown) => unknown) => selector(ideState),
}));

import { useOnlineSync, triggerSync } from '../../src/hooks/useOnlineSync';
// The storage mock (moduleNameMapper -> tests/unit/__mocks__/storage.ts) exposes
// controllable jest.fn()s for isOnline/onOnline/triggerSync.
import { isOnline, onOnline, triggerSync as storageTriggerSync } from '../../src/utils/storage';

beforeEach(() => {
  (ideState.syncQueuedSaves as jest.Mock).mockClear();
  (isOnline as jest.Mock).mockClear();
  (isOnline as jest.Mock).mockReturnValue(true);
  (onOnline as jest.Mock).mockClear();
  (onOnline as jest.Mock).mockReturnValue(() => {});
  (storageTriggerSync as jest.Mock).mockClear();
});

describe('useOnlineSync', () => {
  it('syncs queued saves on mount when already online', () => {
    renderHook(() => useOnlineSync());
    expect(ideState.syncQueuedSaves).toHaveBeenCalledTimes(1);
  });

  it('does not sync on mount while offline', () => {
    (isOnline as jest.Mock).mockReturnValue(false);
    renderHook(() => useOnlineSync());
    expect(ideState.syncQueuedSaves).not.toHaveBeenCalled();
  });

  it('registers an online listener and syncs when the event fires', () => {
    let handler: (() => void) | undefined;
    (onOnline as jest.Mock).mockImplementation((cb: () => void) => {
      handler = cb;
      return () => {};
    });
    renderHook(() => useOnlineSync());
    expect(handler).toBeDefined();

    act(() => { handler!(); });
    expect(ideState.syncQueuedSaves).toHaveBeenCalledTimes(2); // mount + event
  });

  it('unsubscribes the online listener on unmount', () => {
    const unsub = jest.fn();
    (onOnline as jest.Mock).mockReturnValue(unsub);
    const { unmount } = renderHook(() => useOnlineSync());
    expect(onOnline).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('re-exports triggerSync from storage (manual sync entry point)', () => {
    expect(triggerSync).toBe(storageTriggerSync);
    triggerSync();
    expect(storageTriggerSync).toHaveBeenCalledTimes(1);
  });
});