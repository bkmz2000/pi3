/**
 * FileBar tests: tab click switches the active file, close button deletes a
 * file behind a confirm() guard, dirty-dot rendering, rename-on-double-click,
 * the "+" new-file flow, and peer (live-session) read-only tabs. AuthSection
 * and useTeacherShare are mocked as dumb stand-ins — they have their own
 * auth/sharing concerns unrelated to the tab bar itself.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

const theme = {
  filebarBg: '#0d0d0d',
  fontUI: 'sans-serif',
  panelBorder: '#333',
  panelTxt: '#fff',
  panelTxtMute: '#aaa',
  radiusTab: 6,
  railActiveBg: '#2a2a2a',
  surface: '#151515',
  tabActiveBg: '#222',
  tabActiveTxt: '#fff',
  tabDirty: '#f60',
  tabInactiveBg: '#181818',
  tabInactiveHover: '#1f1f1f',
  tabInactiveTxt: '#999',
  weightUI: 400,
};

const editorState = {
  project: {
    files: { 'main.py': 'print(1)', 'utils.py': 'pass' },
  },
  currentProjectId: 'p1' as string | undefined,
  currentFile: 'main.py',
  changeCurrentFile: jest.fn(),
  deleteFile: jest.fn(),
  changeFile: jest.fn(),
  dirtyFiles: new Set<string>(),
};

const liveSessionState = {
  peerTabs: [] as { id: string; label: string }[],
  activePeer: null as string | null,
  focusPeer: jest.fn(),
  closePeer: jest.fn(),
};

const teacherShareState: {
  data: { shared: boolean; teachers: { id: string; name: string }[]; help_request?: { status: string } } | null;
  loading: boolean;
  share: jest.Mock<(email: string) => Promise<void>>;
  unshare: jest.Mock<(id: string) => Promise<void>>;
  toggleHelp: jest.Mock<() => Promise<void>>;
} = {
  data: null,
  loading: false,
  share: jest.fn<(email: string) => Promise<void>>().mockResolvedValue(undefined),
  unshare: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  toggleHelp: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

const userState: { user: { role?: string } | null } = { user: null };

jest.mock('../../src/state/IdeState', () => ({
  useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
}));

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector({ theme }),
}));

jest.mock('../../src/state/useUser', () => ({
  useUser: () => userState,
}));

jest.mock('../../src/state/useLiveSession', () => ({
  useLiveSession: (selector: (s: unknown) => unknown) => selector(liveSessionState),
}));

jest.mock('../../src/state/useTeacherShare', () => ({
  useTeacherShare: () => teacherShareState,
}));

jest.mock('../../src/components/user', () => {
  const R = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    AuthSection: () => R.createElement('div', { 'data-testid': 'auth-section' }),
  };
});

import FileBar from '../../src/FileBar';

function clearMocks(obj: Record<string, unknown>) {
  Object.values(obj).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
}

beforeEach(() => {
  clearMocks(editorState);
  clearMocks(liveSessionState);
  clearMocks(teacherShareState);
  editorState.project = { files: { 'main.py': 'print(1)', 'utils.py': 'pass' } };
  editorState.currentProjectId = 'p1';
  editorState.currentFile = 'main.py';
  editorState.dirtyFiles = new Set<string>();
  liveSessionState.peerTabs = [];
  liveSessionState.activePeer = null;
  teacherShareState.data = null;
  userState.user = null;
});

describe('file tabs', () => {
  test('renders a tab for every project file', () => {
    render(<FileBar />);
    expect(screen.getByText('main.py')).toBeTruthy();
    expect(screen.getByText('utils.py')).toBeTruthy();
  });

  test('shows a dirty dot only for dirty files', () => {
    editorState.dirtyFiles = new Set(['utils.py']);
    const { container } = render(<FileBar />);
    // The dirty dot is a plain span sibling of the file name; assert via title
    // attribute wrapper count matches only the dirty file's tab.
    const utilsTab = screen.getByTitle('utils.py');
    const mainTab = screen.getByTitle('main.py');
    expect(utilsTab.querySelectorAll('span').length).toBeGreaterThan(mainTab.querySelectorAll('span').length);
    expect(container).toBeTruthy();
  });

  test('clicking a tab switches the current file and clears peer focus', () => {
    render(<FileBar />);
    fireEvent.click(screen.getByText('utils.py'));
    expect(editorState.changeCurrentFile).toHaveBeenCalledWith('utils.py');
    expect(liveSessionState.focusPeer).toHaveBeenCalledWith(null);
  });

  test('close button on the active tab deletes the file after confirm', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FileBar />);
    fireEvent.click(screen.getByLabelText('Close main.py'));
    expect(editorState.deleteFile).toHaveBeenCalledWith('main.py');
  });

  test('close button does nothing when confirm is cancelled', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<FileBar />);
    fireEvent.click(screen.getByLabelText('Close main.py'));
    expect(editorState.deleteFile).not.toHaveBeenCalled();
  });

  test('only the active tab shows a close button', () => {
    render(<FileBar />);
    expect(screen.getByLabelText('Close main.py')).toBeTruthy();
    expect(screen.queryByLabelText('Close utils.py')).toBeNull();
  });

  test('double-click renames a tab', () => {
    render(<FileBar />);
    fireEvent.doubleClick(screen.getByText('utils.py'));
    const input = screen.getByDisplayValue('utils.py');
    fireEvent.change(input, { target: { value: 'helpers.py' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(editorState.deleteFile).toHaveBeenCalledWith('utils.py');
    expect(editorState.changeFile).toHaveBeenCalledWith('helpers.py', 'pass');
  });

  test('renaming the active file also updates currentFile', () => {
    render(<FileBar />);
    fireEvent.doubleClick(screen.getByText('main.py'));
    const input = screen.getByDisplayValue('main.py');
    fireEvent.change(input, { target: { value: 'app.py' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(editorState.changeCurrentFile).toHaveBeenCalledWith('app.py');
  });
});

describe('new file tab', () => {
  test('clicking + then typing a name creates a file', () => {
    render(<FileBar />);
    fireEvent.click(screen.getByTitle('New file'));
    const input = screen.getByPlaceholderText('untitled.py');
    fireEvent.change(input, { target: { value: 'game.py' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(editorState.changeFile).toHaveBeenCalledWith('game.py', '');
    expect(editorState.changeCurrentFile).toHaveBeenCalledWith('game.py');
  });

  test('an empty name does not create a file', () => {
    render(<FileBar />);
    fireEvent.click(screen.getByTitle('New file'));
    const input = screen.getByPlaceholderText('untitled.py');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(editorState.changeFile).not.toHaveBeenCalled();
  });
});

describe('peer tabs', () => {
  test('renders a read-only tab for each peer and wires select/close', () => {
    liveSessionState.peerTabs = [{ id: 'peer-1', label: 'Alice' }];
    render(<FileBar />);

    const peerTab = screen.getByTitle("Alice — live code (read-only)");
    expect(peerTab).toBeTruthy();

    fireEvent.click(peerTab);
    expect(liveSessionState.focusPeer).toHaveBeenCalledWith('peer-1');

    fireEvent.click(screen.getByLabelText("Close Alice's live code"));
    expect(liveSessionState.closePeer).toHaveBeenCalledWith('peer-1');
  });

  test('no peer tabs render when peerTabs is empty', () => {
    render(<FileBar />);
    expect(screen.queryByText('Alice')).toBeNull();
  });
});

describe('project share actions', () => {
  test('renders nothing for a non-student user', () => {
    userState.user = { role: 'teacher' };
    teacherShareState.data = { shared: false, teachers: [] };
    render(<FileBar />);
    expect(screen.queryByText('Share with teacher')).toBeNull();
  });

  test('student can open the share input and share a project', async () => {
    userState.user = { role: 'student' };
    teacherShareState.data = { shared: false, teachers: [] };
    render(<FileBar />);

    fireEvent.click(screen.getByText('Share with teacher'));
    const input = screen.getByPlaceholderText('Teacher username');
    fireEvent.change(input, { target: { value: 'teacher@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Share'));
    });

    expect(teacherShareState.share).toHaveBeenCalledWith('teacher@example.com');
  });

  test('shared project shows the unshare/help controls', () => {
    userState.user = { role: 'student' };
    teacherShareState.data = { shared: true, teachers: [{ id: 't1', name: 'Ms. Lee' }] };
    render(<FileBar />);

    expect(screen.getByText('Shared')).toBeTruthy();
    fireEvent.click(screen.getByTitle('I need help'));
    expect(teacherShareState.toggleHelp).toHaveBeenCalled();
  });
});
