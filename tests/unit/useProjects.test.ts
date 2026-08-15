/**
 * useProjects hook: the API-projects-page half (fetch/add/remove/load, all
 * with success + failure branches — previously 0% branch coverage) and the
 * side-panel half (open example, fork example, new project, delete project
 * with its userProjects/examples fallback).
 */
import { renderHook, act } from '@testing-library/react';

const ideState = {
  projects: { pong: { files: { 'main.py': 'print(1)' }, assets: {}, tilemaps: {} } },
  userProjects: [{ id: 'u1', name: 'my-game', files: {}, assets: {} }],
  loading: false,
  loadUserProjects: jest.fn(),
  deleteUserProject: jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  forkExample: jest.fn(),
  downloadProject: jest.fn(),
  importProjectFromFile: jest.fn(),
};

const editorState = {
  currentProjectId: undefined as string | undefined,
  changeCurrentProject: jest.fn(),
};

jest.mock('../../src/state/IdeState', () => ({
  useIde: (selector: (s: unknown) => unknown) => selector(ideState),
  useEditor: (selector: (s: unknown) => unknown) => selector(editorState),
  toEditorProject: (p: unknown) => ({ ...(p as object), __normalized: true }),
}));

jest.mock('../../src/state/api', () => ({
  getProjects: jest.fn(),
  createProject: jest.fn(),
  deleteProject: jest.fn(),
  getProject: jest.fn(),
}));

import { useProjects } from '../../src/hooks/useProjects';
import { getProjects, createProject, deleteProject, getProject } from '../../src/state/api';

function clearMocks(obj: Record<string, unknown>) {
  Object.values(obj).forEach((v) => {
    if (typeof v === 'function' && 'mockClear' in v) (v as jest.Mock).mockClear();
  });
}

beforeEach(() => {
  clearMocks(ideState);
  clearMocks(editorState);
  (getProjects as jest.Mock).mockReset();
  (createProject as jest.Mock).mockReset();
  (deleteProject as jest.Mock).mockReset();
  (getProject as jest.Mock).mockReset();
  ideState.userProjects = [{ id: 'u1', name: 'my-game', files: {}, assets: {} }];
  editorState.currentProjectId = undefined;
});

describe('fetchProjects (API projects page)', () => {
  it('success: populates apiProjects and clears loading', async () => {
    (getProjects as jest.Mock).mockResolvedValue([{ id: 'p1', name: 'a' }]);
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.fetchProjects(); });

    expect(result.current.apiProjects).toEqual([{ id: 'p1', name: 'a' }]);
    expect(result.current.apiLoading).toBe(false);
    expect(result.current.apiError).toBeNull();
  });

  it('failure: sets apiError and leaves apiProjects empty', async () => {
    (getProjects as jest.Mock).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.fetchProjects(); });

    expect(result.current.apiProjects).toEqual([]);
    expect(result.current.apiError).toBe('network down');
    expect(result.current.apiLoading).toBe(false);
  });

  it('failure with a non-Error throw falls back to a generic message', async () => {
    (getProjects as jest.Mock).mockRejectedValue('boom');
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.fetchProjects(); });

    expect(result.current.apiError).toBe('Failed to load projects');
  });
});

describe('addProject', () => {
  it('success: appends to apiProjects and returns the created project', async () => {
    (createProject as jest.Mock).mockResolvedValue({ id: 'p2', name: 'new' });
    const { result } = renderHook(() => useProjects());

    let created;
    await act(async () => { created = await result.current.addProject('new'); });

    expect(created).toEqual({ id: 'p2', name: 'new' });
    expect(result.current.apiProjects).toEqual([{ id: 'p2', name: 'new' }]);
    expect(result.current.apiError).toBeNull();
  });

  it('failure: sets apiError and rethrows', async () => {
    (createProject as jest.Mock).mockRejectedValue(new Error('name taken'));
    const { result } = renderHook(() => useProjects());

    let caught: unknown;
    await act(async () => {
      try { await result.current.addProject('dup'); } catch (e) { caught = e; }
    });

    expect((caught as Error).message).toBe('name taken');
    expect(result.current.apiError).toBe('name taken');
  });
});

describe('removeProject', () => {
  it('success: removes the project from apiProjects', async () => {
    (getProjects as jest.Mock).mockResolvedValue([{ id: 'p1', name: 'a' }, { id: 'p2', name: 'b' }]);
    (deleteProject as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useProjects());
    await act(async () => { await result.current.fetchProjects(); });

    await act(async () => { await result.current.removeProject('p1'); });

    expect(result.current.apiProjects).toEqual([{ id: 'p2', name: 'b' }]);
  });

  it('failure: sets apiError and rethrows', async () => {
    (deleteProject as jest.Mock).mockRejectedValue(new Error('forbidden'));
    const { result } = renderHook(() => useProjects());

    let caught: unknown;
    await act(async () => {
      try { await result.current.removeProject('p1'); } catch (e) { caught = e; }
    });

    expect((caught as Error).message).toBe('forbidden');
    expect(result.current.apiError).toBe('forbidden');
  });
});

describe('loadProject', () => {
  it('success: normalizes and swaps in the editor project', async () => {
    (getProject as jest.Mock).mockResolvedValue({ id: 'p1', files: { 'main.py': '' } });
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.loadProject('p1'); });

    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
      expect.objectContaining({ __normalized: true }),
      'p1',
    );
  });

  it('failure: sets apiError and rethrows', async () => {
    (getProject as jest.Mock).mockRejectedValue(new Error('not found'));
    const { result } = renderHook(() => useProjects());

    let caught: unknown;
    await act(async () => {
      try { await result.current.loadProject('missing'); } catch (e) { caught = e; }
    });

    expect((caught as Error).message).toBe('not found');
    expect(result.current.apiError).toBe('not found');
  });
});

describe('handleOpenExample', () => {
  it('with no current project: opens the example as a fresh (unsaved) session', async () => {
    editorState.currentProjectId = undefined;
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.handleOpenExample('pong'); });

    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(ideState.projects.pong, undefined);
  });

  it('with a current project open: swaps content without touching the id arg', async () => {
    editorState.currentProjectId = 'u1';
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.handleOpenExample('pong'); });

    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(ideState.projects.pong);
  });
});

describe('handleForkExample', () => {
  it('forks the example, normalizes it, and switches to the fork', async () => {
    (ideState.forkExample as jest.Mock).mockResolvedValue({ id: 'fork-1', files: {} });
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.handleForkExample('pong'); });

    expect(ideState.forkExample).toHaveBeenCalledWith('pong', ideState.projects.pong);
    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
      expect.objectContaining({ __normalized: true, id: 'fork-1' }),
      'fork-1',
    );
  });
});

describe('handleNewProject', () => {
  it('opens a blank starter project with no project id', () => {
    const { result } = renderHook(() => useProjects());

    act(() => { result.current.handleNewProject(); });

    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
      expect.objectContaining({ assets: {}, tilemaps: {} }),
      undefined,
    );
  });
});

describe('handleDeleteProject', () => {
  it('falls back to the next user project after deleting', async () => {
    ideState.userProjects = [{ id: 'u1', name: 'a', files: {}, assets: {} }, { id: 'u2', name: 'b', files: {}, assets: {} }];
    (getProject as jest.Mock).mockResolvedValue({ id: 'u2', files: {} });
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.handleDeleteProject('u1'); });

    expect(ideState.deleteUserProject).toHaveBeenCalledWith('u1');
    expect(getProject).toHaveBeenCalledWith('u1'); // userProjects[0] pre-deletion snapshot from the mock
    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(
      expect.objectContaining({ __normalized: true }),
      'u2',
    );
  });

  it('falls back to the first example when no user projects remain', async () => {
    ideState.userProjects = [];
    const { result } = renderHook(() => useProjects());

    await act(async () => { await result.current.handleDeleteProject('u1'); });

    expect(editorState.changeCurrentProject).toHaveBeenCalledWith(ideState.projects.pong);
  });
});
