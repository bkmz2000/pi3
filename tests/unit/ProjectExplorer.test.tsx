/**
 * ProjectExplorer smoke tests: sections render from a fixture project,
 * clicking each asset type fires the right editor-launch setters.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const editorState = {
  project: {
    name: 'fixture',
    files: { 'main.py': 'print("hi")', 'utils.py': '' },
    assets: {},
    tilemaps: { level1: { width: 8, height: 8, layers: [] } as unknown as object },
    sounds: { jump: '/sounds/jump.ogg' },
    sheet: {
      width: 256,
      height: 256,
      pixels: 'AAAA',
      sprites: {
        hero: {
          animations: {
            idle: { x: 0, y: 0, frameW: 32, frameH: 32, frameCount: 1 },
          },
        },
      },
    },
  },
  currentProjectId: 'p1',
  currentFile: 'main.py',
  dirtyFiles: new Set<string>(),
  changeCurrentFile: jest.fn(),
  changeFile: jest.fn(),
  deleteFile: jest.fn(),
  renameFile: jest.fn(),
  removeAsset: jest.fn(),
  addAssetInstance: jest.fn(),
  deleteTilemap: jest.fn(),
  addSound: jest.fn(),
  removeSound: jest.fn(),
  setSheet: jest.fn(),
};

jest.mock('../../src/state/IdeState', () => ({
  useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
}));

jest.mock('../../src/state/assets', () => ({
  packAssetsByMeta: () => [],
  BUILTIN_SOUNDS: [],
}));

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector({
    theme: {
      surface: '#000', surfacePanel: '#111', panelHeader: '#222',
      panelTxt: '#fff', panelTxtMute: '#aaa', panelBorder: '#333',
      accent: '#4cf', chip: '#1a1a1a',
      fontUI: 'sans-serif', fontMono: 'monospace',
    },
  }),
}));

import ProjectExplorer from '../../src/ProjectExplorer';

const baseProps = {
  onClose: jest.fn(),
  setEditorMode: jest.fn(),
  onOpenSheetSprite: jest.fn(),
  setEditingTilemap: jest.fn(),
  onOpenUserProject: jest.fn(),
  onNewProject: jest.fn(),
  onImport: jest.fn(),
  onDeleteProject: jest.fn(),
  onExportProject: jest.fn(),
  userProjects: [
    { id: 'p1', name: 'my-game', files: {}, assets: {} },
    { id: 'p2', name: 'asteroids', files: {}, assets: {} },
  ],
  loading: false,
  loadUserProjects: jest.fn(),
};

beforeEach(() => {
  Object.values(baseProps).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
  Object.values(editorState).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
});

describe('ProjectExplorer', () => {
  test('renders the project name in the switcher header', () => {
    render(<ProjectExplorer {...baseProps} />);
    expect(screen.getByText('my-game')).toBeTruthy();
  });

  test('lists code files', () => {
    render(<ProjectExplorer {...baseProps} />);
    expect(screen.getByText('main.py')).toBeTruthy();
    expect(screen.getByText('utils.py')).toBeTruthy();
  });

  test('lists tilemap names', () => {
    render(<ProjectExplorer {...baseProps} />);
    expect(screen.getByText('level1')).toBeTruthy();
  });

  test('lists sound names', () => {
    render(<ProjectExplorer {...baseProps} />);
    expect(screen.getByText('jump')).toBeTruthy();
  });

  test('clicking a code file switches the current file', () => {
    render(<ProjectExplorer {...baseProps} />);
    fireEvent.click(screen.getByText('utils.py'));
    expect(editorState.changeCurrentFile).toHaveBeenCalledWith('utils.py');
  });

  test('clicking a tilemap launches the tilemap editor', () => {
    render(<ProjectExplorer {...baseProps} />);
    fireEvent.click(screen.getByText('level1'));
    expect(baseProps.setEditingTilemap).toHaveBeenCalledWith('level1');
    expect(baseProps.setEditorMode).toHaveBeenCalledWith('tilemap');
  });
});
