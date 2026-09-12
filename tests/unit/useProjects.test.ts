/**
 * useProjects is a compatibility facade over the one canonical Zustand
 * collection. These tests ensure the library and editor panel cannot drift
 * into separate private project lists again.
 */
import { renderHook, act } from '@testing-library/react';

const ideState = {
  projects: { pong: { name: 'pong', files: { 'main.py': 'print(1)' }, currentFile: 'main.py', assets: {}, tilemaps: {}, sounds: {} } },
  userProjects: [{ id: 'u1', name: 'my-game', files: {}, assets: {} }],
  loading: false,
  projectError: null as string | null,
  loadUserProjects: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  createNewProject: jest.fn(),
  deleteUserProject: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  renameUserProject: jest.fn(),
  forkExample: jest.fn(),
  downloadProject: jest.fn(),
  importProjectFromFile: jest.fn(),
};

const editorState = {
  changeCurrentProject: jest.fn(),
};

jest.mock('../../src/state/IdeState', () => {
  const useIdeMock = (selector: (s: unknown) => unknown) => selector(ideState);
  (useIdeMock as unknown as { getState: () => typeof ideState }).getState = () => ideState;
  return {
    useIde: useIdeMock,
    useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
    toEditorProject: (p: unknown) => ({ ...(p as object), __normalized: true }),
  };
});

jest.mock('../../src/state/api', () => ({
  getProject: jest.fn(),
}));

import { useProjects } from '../../src/hooks/useProjects';
import { getProject } from '../../src/state/api';

beforeEach(() => {
  jest.clearAllMocks();
  ideState.userProjects = [{ id: 'u1', name: 'my-game', files: {}, assets: {} }];
  ideState.loading = false;
  ideState.projectError = null;
  ideState.loadUserProjects.mockResolvedValue(undefined);
  ideState.deleteUserProject.mockImplementation(async (id) => {
    ideState.userProjects = ideState.userProjects.filter((project) => project.id !== id);
  });
});

it('exposes the canonical project list and loading/error state', () => {
  const { result } = renderHook(() => useProjects());
  expect(result.current.apiProjects).toBe(ideState.userProjects);
  expect(result.current.apiLoading).toBe(false);
  expect(result.current.apiError).toBeNull();
});

it('refreshes through the canonical store action', async () => {
  const { result } = renderHook(() => useProjects());
  await act(async () => { await result.current.fetchProjects(); });
  expect(ideState.loadUserProjects).toHaveBeenCalledTimes(1);
});

it('creates a starter project through the canonical store action', async () => {
  ideState.createNewProject.mockResolvedValue({ id: 'p2', name: 'new' });
  const { result } = renderHook(() => useProjects());
  let created: unknown;
  await act(async () => { created = await result.current.addProject('new', 'desc'); });
  expect(ideState.createNewProject).toHaveBeenCalledWith('new', 'desc');
  expect(created).toEqual({ id: 'p2', name: 'new' });
});

it('deletes through the canonical store action', async () => {
  const { result } = renderHook(() => useProjects());
  await act(async () => { await result.current.removeProject('u1'); });
  expect(ideState.deleteUserProject).toHaveBeenCalledWith('u1');
  expect(ideState.userProjects).toEqual([]);
});

it('normalizes a project before opening it', async () => {
  (getProject as jest.Mock).mockResolvedValue({ id: 'p1', files: { 'main.py': '' } });
  const { result } = renderHook(() => useProjects());
  await act(async () => { await result.current.loadProject('p1'); });
  expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
    expect.objectContaining({ __normalized: true }),
    'p1',
  );
});

it('opens an example as a fresh draft without retaining the old project id', () => {
  const { result } = renderHook(() => useProjects());
  act(() => { result.current.handleOpenExample('pong'); });
  expect(editorState.changeCurrentProject).toHaveBeenCalledWith(ideState.projects.pong);
});

it('forks and opens the complete normalized example', async () => {
  ideState.forkExample.mockResolvedValue({ id: 'fork-1', files: {} });
  const { result } = renderHook(() => useProjects());
  await act(async () => { await result.current.handleForkExample('pong'); });
  expect(ideState.forkExample).toHaveBeenCalledWith('pong', ideState.projects.pong);
  expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
    expect.objectContaining({ __normalized: true, id: 'fork-1' }),
    'fork-1',
  );
});

it('opens a named local starter with main.py selected', () => {
  const { result } = renderHook(() => useProjects());
  act(() => { result.current.handleNewProject(); });
  expect(editorState.changeCurrentProject).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Untitled',
    currentFile: 'main.py',
    files: expect.objectContaining({ 'main.py': expect.any(String) }),
  }));
});

it('selects from post-delete state instead of reopening the deleted project', async () => {
  ideState.userProjects = [
    { id: 'u1', name: 'a', files: {}, assets: {} },
    { id: 'u2', name: 'b', files: {}, assets: {} },
  ];
  (getProject as jest.Mock).mockResolvedValue({ id: 'u2', files: {} });
  const { result } = renderHook(() => useProjects());

  await act(async () => { await result.current.handleDeleteProject('u1'); });

  expect(getProject).toHaveBeenCalledWith('u2');
  expect(getProject).not.toHaveBeenCalledWith('u1');
  expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
    expect.objectContaining({ __normalized: true }),
    'u2',
  );
});

it('falls back to an example when the last saved project is deleted', async () => {
  const { result } = renderHook(() => useProjects());
  await act(async () => { await result.current.handleDeleteProject('u1'); });
  expect(editorState.changeCurrentProject).toHaveBeenCalledWith(ideState.projects.pong);
});
