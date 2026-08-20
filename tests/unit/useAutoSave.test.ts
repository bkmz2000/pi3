/**
 * useAutoSave: the two autosave paths — a 60s periodic fallback interval
 * (snapshot dirty set, save, markClean(snapshot) only on success) and a 3s
 * debounced save after edits on real (non-example) projects. Payload-class
 * save errors (413/validation) sticky-skip both paths so we don't retry on
 * every keystroke.
 *
 * Isolation trick: the periodic interval reads the dirty set via
 * useEditor.getState() at fire time (dirtyFiles is NOT an effect dep), while
 * the debounce effect depends on dirtyFiles identity. So tests start with an
 * empty dirty set (debounce no-ops), then mutate the store object directly to
 * arm only the interval path; debounce tests instead flip dirtyFiles identity
 * through a rerender.
 */
import { renderHook, act } from '@testing-library/react';

const editorState = {
  currentProjectId: undefined as string | undefined,
  dirtyFiles: new Set<string>(),
  markClean: jest.fn(),
};
const ideState = {
  saveCurrentProject: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  saveError: null as { kind: string; message: string } | null,
};

const useEditorMock = (selector: (s: unknown) => unknown) => selector(editorState);
(useEditorMock as unknown as { getState: () => typeof editorState }).getState = () => editorState;

jest.mock('../../src/state/IdeState', () => ({
  useEditor: useEditorMock,
  useIde: (selector: (s: unknown) => unknown) => selector(ideState),
  isExampleSessionId: (id: string | null | undefined) =>
    typeof id === 'string' && id.startsWith('__example_session_'),
}));

import { useAutoSave } from '../../src/hooks/useAutoSave';

function clearMocks(obj: Record<string, unknown>) {
  Object.values(obj).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  clearMocks(editorState);
  clearMocks(ideState);
  editorState.currentProjectId = 'p1';
  editorState.dirtyFiles = new Set();
  ideState.saveError = null;
  ideState.saveCurrentProject.mockResolvedValue(true);
});
afterEach(() => {
  jest.useRealTimers();
});

describe('periodic fallback interval (60s)', () => {
  it('saves and marks clean with the snapshot when files become dirty', async () => {
    renderHook(() => useAutoSave());
    // A file becomes dirty with no re-render — the interval sees it via getState().
    editorState.dirtyFiles = new Set(['main.py']);

    await act(async () => { jest.advanceTimersByTime(60000); });

    expect(ideState.saveCurrentProject).toHaveBeenCalledTimes(1);
    expect(editorState.markClean).toHaveBeenCalledWith(new Set(['main.py']));
  });

  it('does not save when there are no dirty files at fire time', async () => {
    renderHook(() => useAutoSave());

    await act(async () => { jest.advanceTimersByTime(60000); });

    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();
  });

  it('does not mark clean when the save fails (files stay dirty)', async () => {
    ideState.saveCurrentProject.mockResolvedValue(false);
    renderHook(() => useAutoSave());
    editorState.dirtyFiles = new Set(['main.py']);

    await act(async () => { jest.advanceTimersByTime(60000); });

    expect(ideState.saveCurrentProject).toHaveBeenCalledTimes(1);
    expect(editorState.markClean).not.toHaveBeenCalled();
  });

  it('skips the interval when there is no current project', async () => {
    editorState.currentProjectId = undefined;
    renderHook(() => useAutoSave());
    editorState.dirtyFiles = new Set(['main.py']);

    await act(async () => { jest.advanceTimersByTime(60000); });

    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();
  });

  it('sticky-skips while a payload-class save error is set', async () => {
    ideState.saveError = { kind: 'payload', message: '413 too big' };
    renderHook(() => useAutoSave());
    editorState.dirtyFiles = new Set(['main.py']);

    await act(async () => { jest.advanceTimersByTime(60000); });

    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();
  });

  it('snapshots the dirty set at callback time (concurrent edits excluded)', async () => {
    renderHook(() => useAutoSave());
    // A second file becomes dirty before the interval fires: the snapshot is
    // taken from getState() inside the callback, so it includes both files.
    editorState.dirtyFiles = new Set(['main.py', 'extra.py']);

    await act(async () => { jest.advanceTimersByTime(60000); });

    expect(editorState.markClean).toHaveBeenCalledWith(new Set(['main.py', 'extra.py']));
  });
});

describe('debounced save (3s after change)', () => {
  it('saves once after the debounce window', async () => {
    const { rerender } = renderHook(() => useAutoSave());
    // Effect re-runs when dirtyFiles identity changes (a real edit).
    editorState.dirtyFiles = new Set(['main.py']);
    rerender();

    await act(async () => { jest.advanceTimersByTime(2999); });
    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(ideState.saveCurrentProject).toHaveBeenCalledTimes(1);
    expect(editorState.markClean).toHaveBeenCalledWith(new Set(['main.py']));
  });

  it('does not debounce while the project is an example session (interval still runs)', async () => {
    editorState.currentProjectId = '__example_session_flappy';
    const { rerender } = renderHook(() => useAutoSave());
    editorState.dirtyFiles = new Set(['main.py']);
    rerender();

    // Past the 3s debounce window: the debounced save must NOT have fired.
    await act(async () => { jest.advanceTimersByTime(3000); });
    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();

    // But the 60s periodic fallback still fires for example sessions.
    await act(async () => { jest.advanceTimersByTime(57000); });
    expect(ideState.saveCurrentProject).toHaveBeenCalledTimes(1);
  });

  it('resets the debounce on every change (typing burst saves once)', async () => {
    const { rerender } = renderHook(() => useAutoSave());
    for (let i = 0; i < 3; i++) {
      editorState.dirtyFiles = new Set(['main.py']);
      rerender();
      await act(async () => { jest.advanceTimersByTime(1000); });
    }
    // Three edits, three debounce resets, but only 3s total -> zero saves yet.
    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();

    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(ideState.saveCurrentProject).toHaveBeenCalledTimes(1);
  });
});

describe('cleanup', () => {
  it('clears both timers on unmount (no save fires afterwards)', async () => {
    const { unmount } = renderHook(() => useAutoSave());
    editorState.dirtyFiles = new Set(['main.py']);
    unmount();

    await act(async () => { jest.advanceTimersByTime(120000); });

    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();
  });
});
