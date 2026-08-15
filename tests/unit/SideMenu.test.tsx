/**
 * Rail (SideMenu) tests: rail button -> panel switch wiring, the unsaved-work
 * guard that intercepts a destructive action while files are dirty, and the
 * import/export handlers. Panel bodies (ProjectExplorer, ExamplesPanel,
 * ProblemsPanel, LivePanel, DocsPanel) are mocked as dumb stand-ins so this
 * file stays focused on Rail's own switching/guard logic rather than each
 * panel's internals (those have their own test files).
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { Suspense } from 'react';

const theme = {
  accent: '#4cf',
  chip: '#1a1a1a',
  fontMono: 'monospace',
  fontUI: 'sans-serif',
  panelBorder: '#333',
  panelHeader: '#222',
  panelTxt: '#fff',
  panelTxtMute: '#aaa',
  radiusButton: 8,
  radiusCard: 8,
  railActiveBg: '#2a2a2a',
  railBg: '#111',
  railHoverBg: '#1f1f1f',
  railIcon: '#ccc',
  railIconActive: '#fff',
  railLogo: '#4cf',
  runBg: '#2c6',
  runTxt: '#fff',
  stopBg: '#c33',
  surfacePanel: '#151515',
  tabDirty: '#f60',
  weightHeader: 700,
  weightUI: 400,
};

const editorState = {
  project: { files: { 'main.py': 'print(1)' }, assets: {} },
  currentFile: 'main.py',
  currentProjectId: 'p1',
  dirtyFiles: new Set<string>(),
  changeCurrentProject: jest.fn(),
  markClean: jest.fn(),
  saveTilemap: jest.fn(),
};

const ideState = {
  projects: {},
  saveCurrentProject: jest.fn(async () => true),
  importProjectFromFile: jest
    .fn<(file: File) => Promise<{ id: string; files: Record<string, string>; assets: Record<string, string> }>>()
    .mockResolvedValue({ id: 'imported-1', files: {}, assets: {} }),
  userProjects: [],
  loading: false,
  loadUserProjects: jest.fn(),
  deleteUserProject: jest.fn(),
  forkExample: jest.fn(),
  downloadProject: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  activePanel: null as string | null,
  setActivePanel: jest.fn(),
  togglePanel: jest.fn(),
  showHitboxes: false,
  setShowHitboxes: jest.fn(),
  showActorInfo: false,
  setShowActorInfo: jest.fn(),
  showConsoleOnRun: false,
  setShowConsoleOnRun: jest.fn(),
  enableLinting: true,
  setEnableLinting: jest.fn(),
  enableAutocomplete: true,
  setEnableAutocomplete: jest.fn(),
  consoleOnRight: false,
  setConsoleOnRight: jest.fn(),
  saveError: null as { kind: string } | null,
};

const runnerState = {
  ready: true,
  running: false,
  run: jest.fn(),
  interrupt: jest.fn(async () => {}),
  lint: jest.fn(async () => []),
  clear: jest.fn(),
  appendOutput: jest.fn(),
  pushErrorCard: jest.fn(),
};

const userState: { user: { role?: string } | null } = { user: null };

jest.mock('../../src/state/IdeState', () => {
  const useEditorMock = (selector: (s: unknown) => unknown) => selector(editorState);
  (useEditorMock as unknown as { getState: () => typeof editorState }).getState = () => editorState;
  const useIdeMock = (selector: (s: unknown) => unknown) => selector(ideState);
  (useIdeMock as unknown as { getState: () => typeof ideState }).getState = () => ideState;
  return {
    useEditor: useEditorMock,
    useIde: useIdeMock,
    toEditorProject: (p: unknown) => p,
    isExampleSessionId: () => false,
  };
});

const setThemeMock = jest.fn();
const setFontSizeMock = jest.fn();

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({ theme, themeId: 'studio', fontSize: 14, setTheme: setThemeMock, setFontSize: setFontSizeMock }),
}));

jest.mock('../../src/state/useUser', () => ({
  useUser: () => userState,
}));

jest.mock('../../src/state/api', () => ({
  getProject: jest.fn(async () => ({ id: 'p1', files: {}, assets: {} })),
  getProjects: jest.fn(async () => []),
  createProject: jest.fn(),
  deleteProject: jest.fn(),
}));

jest.mock('../../src/runner/RunnerProvider', () => ({
  useRunner: () => runnerState,
}));

jest.mock('../../src/ProjectExplorer', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: (props: {
      onClose: () => void;
      onNewProject: () => void;
      onImport: () => void;
      onExportProject: (id: string) => void;
      onOpenUserProject: (p: { id: string; name: string; files: Record<string, string>; assets: Record<string, string> }) => void;
    }) =>
      R.createElement('div', { 'data-testid': 'project-explorer' },
        R.createElement('button', { onClick: props.onNewProject }, 'New Project'),
        R.createElement('button', { onClick: props.onImport }, 'Import'),
        R.createElement('button', { onClick: () => props.onExportProject('p1') }, 'Export'),
        R.createElement('button', {
          onClick: () => props.onOpenUserProject({ id: 'p2', name: 'other', files: {}, assets: {} }),
        }, 'Open other project'),
      ),
  };
});

jest.mock('../../src/ExamplesPanel', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'examples-panel' }),
  };
});

jest.mock('../../src/ProblemsPanel', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'problems-panel' }),
  };
});

jest.mock('../../src/components/session/LivePanel', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'live-panel' }),
  };
});

jest.mock('../../src/components/DocsPanel', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'docs-panel' }),
  };
});

import Rail from '../../src/SideMenu';

function renderRail() {
  return render(
    <Suspense fallback={null}>
      <Rail />
    </Suspense>,
  );
}

function clearMocks(obj: Record<string, unknown>) {
  Object.values(obj).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
}

beforeEach(() => {
  clearMocks(editorState);
  clearMocks(ideState);
  clearMocks(runnerState);
  setThemeMock.mockClear();
  setFontSizeMock.mockClear();
  editorState.dirtyFiles = new Set<string>();
  ideState.activePanel = null;
  userState.user = null;
});

describe('Rail buttons', () => {
  test('renders all rail buttons', () => {
    renderRail();
    expect(screen.getByTitle('Projects')).toBeTruthy();
    expect(screen.getByTitle('Examples')).toBeTruthy();
    expect(screen.getByTitle('Problems')).toBeTruthy();
    expect(screen.getByTitle('Live')).toBeTruthy();
    expect(screen.getByTitle('Reference')).toBeTruthy();
    expect(screen.getByTitle('Settings')).toBeTruthy();
    expect(screen.getByTitle('Run')).toBeTruthy();
  });

  test('clicking a rail button toggles the matching panel', () => {
    renderRail();
    fireEvent.click(screen.getByTitle('Projects'));
    expect(ideState.togglePanel).toHaveBeenCalledWith('projects');

    fireEvent.click(screen.getByTitle('Examples'));
    expect(ideState.togglePanel).toHaveBeenCalledWith('examples');

    fireEvent.click(screen.getByTitle('Settings'));
    expect(ideState.togglePanel).toHaveBeenCalledWith('settings');
  });

  test('no floating panel renders when activePanel is null', () => {
    renderRail();
    expect(screen.queryByRole('region')).toBeNull();
  });

  test('renders the matching panel body when a panel is active', () => {
    ideState.activePanel = 'projects';
    renderRail();
    expect(screen.getByTestId('project-explorer')).toBeInTheDocument();
  });

  test('run button triggers the runner', async () => {
    renderRail();
    await act(async () => {
      fireEvent.click(screen.getByTitle('Run'));
    });
    expect(runnerState.run).toHaveBeenCalledWith(editorState.project.files, editorState.project.assets, 'main.py');
  });

  test('teacher link only renders for a teacher user', () => {
    const { rerender } = renderRail();
    expect(screen.queryByTitle('Teacher')).toBeNull();

    userState.user = { role: 'teacher' };
    rerender(<Suspense fallback={null}><Rail /></Suspense>);
    expect(screen.getByTitle('Teacher')).toBeTruthy();
  });
});

describe('unsaved-work guard', () => {
  beforeEach(() => {
    ideState.activePanel = 'projects';
    editorState.dirtyFiles = new Set(['main.py']);
  });

  test('blocks a guarded action and shows the unsaved-changes dialog', () => {
    renderRail();
    fireEvent.click(screen.getByText('New Project'));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(editorState.changeCurrentProject).not.toHaveBeenCalled();
  });

  test('discard changes runs the pending action without saving', async () => {
    renderRail();
    fireEvent.click(screen.getByText('New Project'));
    await act(async () => {
      fireEvent.click(screen.getByText('Discard changes'));
    });
    expect(ideState.saveCurrentProject).not.toHaveBeenCalled();
    expect(editorState.markClean).toHaveBeenCalled();
    expect(editorState.changeCurrentProject).toHaveBeenCalled();
  });

  test('save and continue saves before running the pending action', async () => {
    renderRail();
    fireEvent.click(screen.getByText('New Project'));
    await act(async () => {
      fireEvent.click(screen.getByText('Save and continue'));
    });
    expect(ideState.saveCurrentProject).toHaveBeenCalled();
    expect(editorState.changeCurrentProject).toHaveBeenCalled();
  });

  test('does not guard when there are no dirty files', () => {
    editorState.dirtyFiles = new Set();
    renderRail();
    fireEvent.click(screen.getByText('New Project'));
    expect(screen.queryByText('Unsaved changes')).toBeNull();
    expect(editorState.changeCurrentProject).toHaveBeenCalled();
  });
});

describe('import/export wiring', () => {
  beforeEach(() => {
    ideState.activePanel = 'projects';
  });

  test('import dialog imports a project and closes', async () => {
    renderRail();
    fireEvent.click(screen.getByText('Import'));
    const fileInput = screen.getByDisplayValue('') as HTMLInputElement;
    const file = new File(['zip-bytes'], 'project.zip', { type: 'application/zip' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(ideState.importProjectFromFile).toHaveBeenCalledWith(file);
    expect(editorState.changeCurrentProject).toHaveBeenCalled();
    expect(screen.queryByText('project.zip')).toBeNull(); // dialog closed, no leftover file-name UI
  });

  test('export downloads the given project id', async () => {
    renderRail();
    await act(async () => {
      fireEvent.click(screen.getByText('Export'));
    });
    expect(ideState.downloadProject).toHaveBeenCalledWith('p1');
  });

  test('export failure shows an alert dialog', async () => {
    ideState.downloadProject.mockRejectedValueOnce(new Error('network error'));
    renderRail();
    await act(async () => {
      fireEvent.click(screen.getByText('Export'));
    });
    expect(screen.getByText('Failed to export project. Please try again.')).toBeTruthy();
  });
});

describe('settings panel', () => {
  beforeEach(() => {
    ideState.activePanel = 'settings';
  });

  test('renders the settings panel with current toggle state', () => {
    renderRail();
    const hitboxesToggle = screen.getByRole('switch', { name: /show hitboxes/i });
    expect(hitboxesToggle.getAttribute('aria-checked')).toBe('false');
  });

  test('toggling a setting calls its setter', () => {
    renderRail();
    fireEvent.click(screen.getByRole('switch', { name: /show hitboxes/i }));
    expect(ideState.setShowHitboxes).toHaveBeenCalledWith(true);
  });

  test('switching theme calls setTheme', () => {
    renderRail();
    fireEvent.click(screen.getByText('Midnight'));
    expect(setThemeMock).toHaveBeenCalledWith('midnight');
  });

  test('changing font size calls setFontSize', () => {
    renderRail();
    fireEvent.change(screen.getByLabelText('Font Size'), { target: { value: '18' } });
    expect(setFontSizeMock).toHaveBeenCalledWith(18);
  });
});
