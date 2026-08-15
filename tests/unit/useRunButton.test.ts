/**
 * useRunButton: the run-button click handler — save-if-dirty, lint gate
 * (blocking errors abort, any error severity batches into one error_card,
 * warnings-only or clean code proceeds to run), and the running->interrupt
 * toggle. Previously untested (0% branch coverage).
 */
import { renderHook, act } from '@testing-library/react';
import type { LintDiagnostic } from '../../src/runner/WorkerInterface';

const editorState = {
  project: { files: { 'main.py': 'print(1)' }, assets: {} },
  currentFile: 'main.py',
  dirtyFiles: new Set<string>(),
  markClean: jest.fn(),
};

const ideState = {
  saveCurrentProject: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  enableLinting: true,
};

const runnerState = {
  running: false,
  run: jest.fn(),
  interrupt: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  lint: jest.fn<(code: string, filename: string) => Promise<LintDiagnostic[]>>().mockResolvedValue([]),
  clear: jest.fn(),
  _appendOutput: jest.fn(),
  pushErrorCard: jest.fn(),
};

jest.mock('../../src/state/IdeState', () => ({
  useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
  useIde: (selector: (s: unknown) => unknown) => selector(ideState),
}));

jest.mock('../../src/runner/RunnerProvider', () => ({
  useRunner: () => runnerState,
}));

import { useRunButton } from '../../src/hooks/useRunButton';

function clearMocks(obj: Record<string, unknown>) {
  Object.values(obj).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
}

beforeEach(() => {
  clearMocks(editorState);
  clearMocks(ideState);
  clearMocks(runnerState);
  ideState.saveCurrentProject.mockResolvedValue(true);
  runnerState.lint.mockResolvedValue([]);
  runnerState.running = false;
  ideState.enableLinting = true;
  editorState.dirtyFiles = new Set<string>();
});

describe('running -> interrupt toggle', () => {
  it('calls interrupt and does not start a run when already running', async () => {
    runnerState.running = true;
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(runnerState.interrupt).toHaveBeenCalled();
    expect(runnerState.run).not.toHaveBeenCalled();
  });
});

describe('save-if-dirty', () => {
  it('saves and marks clean before running when files are dirty', async () => {
    editorState.dirtyFiles = new Set(['main.py']);
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(ideState.saveCurrentProject).toHaveBeenCalled();
    expect(editorState.markClean).toHaveBeenCalled();
    expect(runnerState.run).toHaveBeenCalledWith(editorState.project.files, editorState.project.assets, 'main.py');
  });

  it('does not mark clean when the save fails, but still proceeds to run', async () => {
    editorState.dirtyFiles = new Set(['main.py']);
    ideState.saveCurrentProject.mockResolvedValue(false);
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(editorState.markClean).not.toHaveBeenCalled();
    expect(runnerState.run).toHaveBeenCalled();
  });

  it('skips saving entirely when there are no dirty files', async () => {
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();
    expect(runnerState.run).toHaveBeenCalled();
  });
});

describe('linting disabled', () => {
  it('skips lint entirely and runs directly', async () => {
    ideState.enableLinting = false;
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(runnerState.lint).not.toHaveBeenCalled();
    expect(runnerState.run).toHaveBeenCalled();
  });
});

describe('linting enabled', () => {
  it('no diagnostics: prints noErrors and runs', async () => {
    runnerState.lint.mockResolvedValue([]);
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(runnerState._appendOutput).toHaveBeenCalledWith('stdout', 'No errors found. Starting...');
    expect(runnerState.run).toHaveBeenCalled();
  });

  it('warnings only: prints the warning count and still runs', async () => {
    runnerState.lint.mockResolvedValue([
      { code: 'W1', severity: 'warning', row: 0, column: 0 } as unknown as LintDiagnostic,
    ]);
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(runnerState._appendOutput).toHaveBeenCalledWith('stdout', '1 warning(s). Starting anyway...');
    expect(runnerState.run).toHaveBeenCalled();
  });

  it('a blocking error prints foundErrors and aborts the run', async () => {
    runnerState.lint.mockResolvedValue([
      { code: 'E1', severity: 'error', isBlocking: true, row: 0, column: 0 } as unknown as LintDiagnostic,
    ]);
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(runnerState._appendOutput).toHaveBeenCalledWith('stderr', 'Found 1 error(s) — fix them before running');
    expect(runnerState.run).not.toHaveBeenCalled();
  });

  it('a non-blocking error batches into one error card and aborts the run', async () => {
    runnerState.lint.mockResolvedValue([
      { code: 'E2', severity: 'error', isBlocking: false, row: 2, column: 0 } as unknown as LintDiagnostic,
    ]);
    const { result } = renderHook(() => useRunButton());

    await act(async () => { await result.current.handleRunToggle(); });

    expect(runnerState.pushErrorCard).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'grammar', isBlocking: false }),
    );
    expect(runnerState.run).not.toHaveBeenCalled();
  });
});
