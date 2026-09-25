/**
 * T2 — save orchestration (src/state/IdeState.ts)
 *
 * Tests the decision layer around saving:
 *   - isExampleSessionId / exampleNameFromSessionId pure logic
 *   - saveCurrentProject: happy path, offline queuing, API error kinds,
 *     example-session guard, isSaving transitions
 *   - syncQueuedSaves: dequeues on success, retains row on failure
 *
 * Dependencies mocked at module boundary:
 *   - src/state/api       → jest.fn() stubs
 *   - src/utils/zip       → jest.fn() stubs
 *   - src/utils/storage   → mock via moduleNameMapper (tests/unit/__mocks__/storage.ts)
 */

// ── Module mocks (hoisted by Jest before imports) ─────────────────────────────

jest.mock('../../src/state/api', () => {
  class ApiHttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'ApiHttpError';
      this.status = status;
    }
  }
  return {
    ApiHttpError,
    getProjects:        jest.fn().mockResolvedValue([]),
    createProject:      jest.fn(),
    updateProject:      jest.fn(),
    deleteProject:      jest.fn(),
    saveProjectContent: jest.fn().mockResolvedValue({}),
    getProject:          jest.fn(),
  };
});

jest.mock('../../src/utils/zip', () => ({
  importProjectFromFile: jest.fn(),
  downloadProjectZip:    jest.fn().mockResolvedValue(undefined),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { act } from '@testing-library/react';
import {
  useEditor, useIde,
  isExampleSessionId, exampleNameFromSessionId,
  EXAMPLE_SESSION_PREFIX,
} from '../../src/state/IdeState';
import { saveProjectContent, getProject, ApiHttpError } from '../../src/state/api';
import { projectStorage, isOnline } from '../../src/utils/storage';
import { downloadProjectZip } from '../../src/utils/zip';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockSaveProjectContent = saveProjectContent as jest.MockedFunction<typeof saveProjectContent>;
const mockGetProject = getProject as jest.MockedFunction<typeof getProject>;
const mockIsOnline           = isOnline           as jest.MockedFunction<typeof isOnline>;
const mockQueueSave          = projectStorage.queueSave as jest.MockedFunction<typeof projectStorage.queueSave>;
const mockSaveAnonymousDraft = projectStorage.saveAnonymousDraft as jest.MockedFunction<typeof projectStorage.saveAnonymousDraft>;
const mockSaveAnonymousDraftIfAbsent = projectStorage.saveAnonymousDraftIfAbsent as jest.MockedFunction<typeof projectStorage.saveAnonymousDraftIfAbsent>;
const mockDownloadProjectZip = downloadProjectZip as jest.MockedFunction<typeof downloadProjectZip>;

function setEditorState(overrides: {
  currentProjectId?: string | null;
  files?: Record<string, string>;
  currentFile?: string;
}) {
  const { currentProjectId = 'real-proj-id', files = { 'main.py': 'print(1)' }, currentFile = 'main.py' } = overrides;
  useEditor.setState({
    currentProjectId,
    currentProjectVersion: 7,
    project: { files, assets: {}, tilemaps: {}, sounds: {} },
    currentFile,
    dirtyFiles: new Set(Object.keys(files)),
  });
}

// ── Reset stores + mocks between tests ───────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Sticky conflict recovery no longer consumes a second mocked API rejection;
  // reset one-shot queues so one test cannot alter the next project's outcome.
  mockSaveProjectContent.mockReset();
  mockGetProject.mockReset();
  (projectStorage.getQueuedSaves as jest.Mock).mockReset().mockResolvedValue([]);
  mockIsOnline.mockReturnValue(true);
  mockSaveAnonymousDraft.mockResolvedValue(undefined);
  mockSaveAnonymousDraftIfAbsent.mockResolvedValue(undefined);
  mockSaveProjectContent.mockResolvedValue({ version: 8 } as ReturnType<typeof saveProjectContent> extends Promise<infer T> ? T : never);

  mockGetProject.mockImplementation(async (id) => {
    const call = mockSaveProjectContent.mock.calls.at(-1);
    const data = call?.[1] ?? {};
    return { id, version: 8, files: data.files ?? {}, assets: data.assets ?? {}, tilemaps: data.tilemaps ?? {}, sounds: data.sounds ?? {}, sheet: data.sheet, current_file: data.currentFile ?? 'main.py' } as never;
  });
  useEditor.setState({
    currentProjectId: null,
    project: { files: { 'main.py': '' }, assets: {}, tilemaps: {} },
    currentFile: 'main.py',
    dirtyFiles: new Set(),
  });
  useIde.setState({ saveError: null, isSaving: false });
});

// ── isExampleSessionId (pure) ─────────────────────────────────────────────────

describe('isExampleSessionId', () => {
  it('returns true for a well-formed example session id', () => {
    expect(isExampleSessionId(`${EXAMPLE_SESSION_PREFIX}hello world`)).toBe(true);
  });

  it('returns false for a normal project id', () => {
    expect(isExampleSessionId('abc-123')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isExampleSessionId(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isExampleSessionId(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isExampleSessionId('')).toBe(false);
  });

  it('returns false for a string that starts with a prefix substring', () => {
    expect(isExampleSessionId('__example_')).toBe(false);
  });
});

// ── exampleNameFromSessionId (pure) ──────────────────────────────────────────

describe('exampleNameFromSessionId', () => {
  it('strips the prefix and returns the example name', () => {
    expect(exampleNameFromSessionId(`${EXAMPLE_SESSION_PREFIX}snake`)).toBe('snake');
  });

  it('works for multi-word names', () => {
    expect(exampleNameFromSessionId(`${EXAMPLE_SESSION_PREFIX}hello world`)).toBe('hello world');
  });

  it('returns empty string for prefix-only input', () => {
    expect(exampleNameFromSessionId(EXAMPLE_SESSION_PREFIX)).toBe('');
  });
});

// ── saveCurrentProject — no project id ───────────────────────────────────────

describe('saveCurrentProject — no project id', () => {
  it('returns false immediately when currentProjectId is null', async () => {
    useEditor.setState({ currentProjectId: null });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(false);
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });
});

describe('downloadProject — anonymous draft', () => {
  it('exports the current in-memory project without requiring a project id', async () => {
    useEditor.setState({
      currentProjectId: null,
      project: {
        name: 'My homework',
        files: { 'main.py': 'print("latest edit")' },
        assets: { 'hero.png': 'data:image/png;base64,AA==' },
        tilemaps: {},
        sounds: {},
      },
      currentFile: 'main.py',
    });

    await act(async () => {
      await useIde.getState().downloadProject();
    });

    expect(mockDownloadProjectZip).toHaveBeenCalledWith(expect.objectContaining({
      id: 'untitled',
      name: 'My homework',
      files: [{ name: 'main.py', content: 'print("latest edit")' }],
      assets: { 'hero.png': 'data:image/png;base64,AA==' },
      currentFile: 'main.py',
    }));
    expect(projectStorage.downloadProjectZip).not.toHaveBeenCalled();
  });
});

// ── saveCurrentProject — example session ─────────────────────────────────────

describe('saveCurrentProject — example session', () => {
  it('persists the example draft in IndexedDB, never calls saveProjectContent', async () => {
    setEditorState({ currentProjectId: `${EXAMPLE_SESSION_PREFIX}snake` });

    await act(async () => {
      await useIde.getState().saveCurrentProject();
    });

    expect(mockSaveAnonymousDraft).toHaveBeenCalledWith(expect.objectContaining({
      id: `${EXAMPLE_SESSION_PREFIX}snake`,
    }));
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });

  it('returns false and sets saveError.kind=quota when device storage is full', async () => {
    mockSaveAnonymousDraft.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    setEditorState({ currentProjectId: `${EXAMPLE_SESSION_PREFIX}snake` });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('quota');
  });
});

// ── saveCurrentProject — anonymous draft ──────────────────────────────────────

describe('saveCurrentProject — anonymous draft', () => {
  it('persists each local draft to IndexedDB without calling the API', async () => {
    setEditorState({ currentProjectId: '__anon_draft_unique-1', files: { 'main.py': 'print("draft")' } });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(true);
    expect(mockSaveAnonymousDraft).toHaveBeenCalledWith(expect.objectContaining({
      id: '__anon_draft_unique-1',
      project: expect.objectContaining({ files: { 'main.py': 'print("draft")' } }),
    }));
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });
});

// ── saveCurrentProject — real project, online ─────────────────────────────────

describe('saveCurrentProject — real project, online', () => {
  it('calls saveProjectContent with the current file content', async () => {
    setEditorState({ currentProjectId: 'proj-123', files: { 'main.py': 'print("hi")' } });

    await act(async () => {
      await useIde.getState().saveCurrentProject();
    });

    expect(mockSaveProjectContent).toHaveBeenCalledTimes(1);
    const [id, data] = mockSaveProjectContent.mock.calls[0]!;
    expect(id).toBe('proj-123');
    expect(data.files?.['main.py']).toBe('print("hi")');
    expect(mockSaveProjectContent).toHaveBeenCalledWith('proj-123', expect.any(Object), 7);
  });

  it('returns true and clears saveError on success', async () => {
    setEditorState({ currentProjectId: 'proj-ok' });
    useIde.setState({ saveError: { kind: 'network', message: 'old error' } });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(true);
    expect(useIde.getState().saveError).toBeNull();
  });

  it('isSaving is true during the call and false afterward', async () => {
    let duringCall = false;
    mockSaveProjectContent.mockImplementationOnce(async () => {
      duringCall = useIde.getState().isSaving;
      return {} as never;
    });
    setEditorState({ currentProjectId: 'proj-timing' });

    await act(async () => {
      await useIde.getState().saveCurrentProject();
    });

    expect(duringCall).toBe(true);
    expect(useIde.getState().isSaving).toBe(false);
  });

  it('isSaving is false even if saveProjectContent throws', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new Error('network'));
    setEditorState({ currentProjectId: 'proj-throw' });

    await act(async () => {
      await useIde.getState().saveCurrentProject();
    });

    expect(useIde.getState().isSaving).toBe(false);
  });
});

// ── saveCurrentProject — offline ──────────────────────────────────────────────

describe('saveCurrentProject — offline', () => {
  it('queues the save and returns true (soft-success) when offline', async () => {
    mockIsOnline.mockReturnValue(false);
    setEditorState({ currentProjectId: 'proj-offline' });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(mockQueueSave).toHaveBeenCalledTimes(1);
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
    expect(result).toBe(true);
    expect(useIde.getState().saveError?.kind).toBe('network');
  });

  it('the queued payload carries the correct project id', async () => {
    mockIsOnline.mockReturnValue(false);
    setEditorState({ currentProjectId: 'offline-proj-99' });

    await act(async () => {
      await useIde.getState().saveCurrentProject();
    });

    const [queuedContent] = mockQueueSave.mock.calls[0]!;
    expect(queuedContent.id).toBe('offline-proj-99');
  });
});

// ── saveCurrentProject — API error paths ─────────────────────────────────────

describe('saveCurrentProject — API errors', () => {
  it('network error: queues save, sets kind=network, returns true (soft-success)', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new Error('fetch failed'));
    setEditorState({ currentProjectId: 'proj-net-err' });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(mockQueueSave).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(useIde.getState().saveError?.kind).toBe('network');
  });

  it('401 Unauthorized: sets kind=auth, saves a recovery draft, returns false', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new ApiHttpError(401, 'Unauthorized'));
    setEditorState({ currentProjectId: 'proj-401' });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('auth');
    expect(mockSaveAnonymousDraft).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^__anon_draft_recovered_proj-401_auth_/),
    }));
    expect(useEditor.getState().dirtyFiles.size).toBeGreaterThan(0);
  });

  it('413 Payload Too Large: sets kind=payload, returns false (keep dirty)', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new ApiHttpError(413, 'Payload Too Large'));
    setEditorState({ currentProjectId: 'proj-413' });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('payload');
    expect(useIde.getState().saveError?.message).toMatch(/too large/i);
    // Payload errors must NOT be queued — they will just keep failing
    expect(mockQueueSave).not.toHaveBeenCalled();
  });

  it('400 Bad Request: sets kind=payload, returns false, does not queue', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new ApiHttpError(400, 'Bad Request'));
    setEditorState({ currentProjectId: 'proj-400' });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('payload');
    expect(mockQueueSave).not.toHaveBeenCalled();
  });
});

describe('save durability', () => {
  it('recovers a 409 conflict locally and keeps the project dirty', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new ApiHttpError(409, 'Project was modified in another tab'));
    setEditorState({ currentProjectId: 'proj-conflict' });
    const result = await useIde.getState().saveCurrentProject();
    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('conflict');
    expect(mockSaveAnonymousDraft).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^__anon_draft_recovered_proj-conflict_/) }));
    expect(useEditor.getState().dirtyFiles.size).toBeGreaterThan(0);
  });

  it('can save immediately after a fork when its API revision is installed', async () => {
    setEditorState({ currentProjectId: 'forked-project', files: { 'main.py': 'forked content' } });
    useEditor.getState().setCurrentProjectVersion(12);
    await expect(useIde.getState().saveCurrentProject()).resolves.toBe(true);
    expect(mockSaveProjectContent).toHaveBeenCalledWith('forked-project', expect.any(Object), 12);
  });

  it('does not claim success when read-back content does not match', async () => {
    setEditorState({ currentProjectId: 'proj-verify' });
    mockGetProject.mockResolvedValueOnce({ id: 'proj-verify', version: 8, files: { 'main.py': 'wrong' }, assets: {}, tilemaps: {}, sounds: {}, current_file: 'main.py' } as never);
    const result = await useIde.getState().saveCurrentProject();
    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('verification');
    expect(useEditor.getState().dirtyFiles.size).toBeGreaterThan(0);
  });

  it('keeps dirty state when the local cache cannot persist (quota/storage failure)', async () => {
    setEditorState({ currentProjectId: 'proj-quota' });
    projectStorage.cacheProjectContent.mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    const result = await useIde.getState().saveCurrentProject();
    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('quota');
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
    expect(useEditor.getState().dirtyFiles.size).toBeGreaterThan(0);
  });

  it('keeps newer edits dirty and conditionally advances only the saved cache snapshot', async () => {
    setEditorState({ currentProjectId: 'proj-race' });
    let finish!: () => void;
    (projectStorage.cacheProjectContent as jest.Mock)
      .mockResolvedValueOnce('snapshot-a')
      .mockResolvedValueOnce('snapshot-b');
    mockSaveProjectContent.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ version: 8 } as never); }));
    const saving = useIde.getState().saveCurrentProject();
    useEditor.getState().changeFile('main.py', 'newer edit');
    await Promise.resolve();
    await Promise.resolve();
    // Model a later local snapshot replacing the cache while save A is in flight.
    await projectStorage.cacheProjectContent('proj-race', { files: { 'main.py': 'newer edit' }, assets: {}, tilemaps: {}, sounds: {}, sheet: undefined, currentFile: 'main.py', version: 7 });
    finish();
    expect(await saving).toBe(true);
    expect(projectStorage.cacheProjectContentIfCurrent).toHaveBeenCalledWith('proj-race', 'snapshot-a', expect.objectContaining({ files: { 'main.py': 'print(1)' }, version: 8 }));
    expect(useEditor.getState().dirtyFiles.has('main.py')).toBe(true);
  });

  it('queues the snapshot revision, not a newer revision installed during local persistence', async () => {
    setEditorState({ currentProjectId: 'proj-version-race' });
    mockIsOnline.mockReturnValue(false);
    let finishCache!: () => void;
    (projectStorage.cacheProjectContent as jest.Mock).mockImplementationOnce(
      () => new Promise<string>((resolve) => { finishCache = () => resolve('snapshot-a'); }),
    );
    const saving = useIde.getState().saveCurrentProject();
    useEditor.getState().setCurrentProjectVersion(8);
    finishCache();
    expect(await saving).toBe(true);
    expect(mockQueueSave).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }));
  });

  it('retains the captured revision on a network failure even if the editor advanced', async () => {
    setEditorState({ currentProjectId: 'proj-network-version-race' });
    let finishCache!: () => void;
    (projectStorage.cacheProjectContent as jest.Mock).mockImplementationOnce(
      () => new Promise<string>((resolve) => { finishCache = () => resolve('snapshot-a'); }),
    );
    mockSaveProjectContent.mockRejectedValueOnce(new Error('network'));
    const saving = useIde.getState().saveCurrentProject();
    useEditor.getState().setCurrentProjectVersion(8);
    finishCache();
    expect(await saving).toBe(true);
    expect(mockQueueSave).toHaveBeenCalledWith(expect.objectContaining({ version: 7 }));
  });

  it('keeps newer edits dirty when an earlier request fails and is queued', async () => {
    setEditorState({ currentProjectId: 'proj-network-race' });
    mockSaveProjectContent.mockRejectedValueOnce(new Error('network'));
    const saving = useIde.getState().saveCurrentProject();
    useEditor.getState().changeFile('main.py', 'newer edit');
    expect(await saving).toBe(true);
    expect(useEditor.getState().dirtyFiles.has('main.py')).toBe(true);
    expect(mockQueueSave).toHaveBeenCalledWith(expect.objectContaining({ files: { 'main.py': 'print(1)' } }));
  });

  it('creates a distinct local revision for each explicit conflict recovery', async () => {
    setEditorState({ currentProjectId: 'proj-repeat-conflict' });
    mockSaveProjectContent
      .mockRejectedValueOnce(new ApiHttpError(409, 'Conflict'))
      .mockRejectedValueOnce(new ApiHttpError(409, 'Conflict'));
    await useIde.getState().saveCurrentProject();
    await useIde.getState().saveCurrentProject();
    const ids = mockSaveAnonymousDraft.mock.calls.map(([draft]) => draft.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('persists edits made after a 409 without retrying the cloud overwrite', async () => {
    setEditorState({ currentProjectId: 'proj-conflict-edits' });
    mockSaveProjectContent.mockRejectedValueOnce(new ApiHttpError(409, 'Conflict'));
    expect(await useIde.getState().saveCurrentProject()).toBe(false);
    useEditor.getState().changeFile('main.py', 'print("newer edit")');
    expect(await useIde.getState().saveCurrentProject()).toBe(true);
    expect(mockSaveProjectContent).toHaveBeenCalledTimes(1);
    expect(mockSaveAnonymousDraft).toHaveBeenCalledTimes(2);
    expect(mockSaveAnonymousDraft.mock.calls[1][0].project.files['main.py']).toBe('print("newer edit")');
    expect(mockSaveAnonymousDraft.mock.calls[1][0].id).not.toBe(mockSaveAnonymousDraft.mock.calls[0][0].id);
    expect(useIde.getState().saveError?.kind).toBe('conflict');
    expect(useEditor.getState().dirtyFiles.size).toBe(0);
  });

  it('creates distinct auth recovery drafts instead of replacing another tab’s copy', async () => {
    setEditorState({ currentProjectId: 'proj-repeat-auth' });
    mockSaveProjectContent
      .mockRejectedValueOnce(new ApiHttpError(401, 'Unauthorized'))
      .mockRejectedValueOnce(new ApiHttpError(403, 'Forbidden'));
    await useIde.getState().saveCurrentProject();
    await useIde.getState().saveCurrentProject();
    const ids = mockSaveAnonymousDraft.mock.calls.map(([draft]) => draft.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^__anon_draft_recovered_proj-repeat-auth_auth_/);
    expect(ids[1]).not.toBe(ids[0]);
  });
});

// ── syncQueuedSaves ───────────────────────────────────────────────────────────

describe('syncQueuedSaves', () => {
  const mockGetQueuedSaves = projectStorage.getQueuedSaves as jest.MockedFunction<typeof projectStorage.getQueuedSaves>;
  const mockCompleteQueuedSave = projectStorage.completeQueuedSave as jest.MockedFunction<typeof projectStorage.completeQueuedSave>;

  it('does nothing when offline', async () => {
    mockIsOnline.mockReturnValue(false);

    await act(async () => {
      await useIde.getState().syncQueuedSaves();
    });

    expect(mockGetQueuedSaves).toHaveBeenCalledTimes(1);
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });

  it('counts a pending offline row on mount without attempting a write', async () => {
    mockIsOnline.mockReturnValue(false);
    mockGetQueuedSaves.mockResolvedValueOnce([{
      id: 3, queuedAt: Date.now(), attempts: 0, writerId: 'tab',
      content: { id: 'offline', files: { 'main.py': 'local' }, assets: {}, tilemaps: {}, sounds: {}, currentFile: 'main.py', version: 7, savedAt: 0 },
    }]);
    await useIde.getState().syncQueuedSaves();
    expect(useEditor.getState().queuedSaveCount).toBe(1);
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });

  it('lets a route loader await an in-flight replay before fetching server content', async () => {
    let releaseWrite: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { releaseWrite = resolve; });
    mockGetQueuedSaves.mockResolvedValueOnce([{
      id: 64, queuedAt: Date.now(), attempts: 0, writerId: 'tab',
      content: { id: 'proj-loading', files: { 'main.py': 'offline' }, assets: {}, tilemaps: {}, sounds: {}, currentFile: 'main.py', version: 7, savedAt: 0 },
    }]);
    mockSaveProjectContent.mockImplementationOnce(async () => {
      await pending;
      return { version: 8 } as Awaited<ReturnType<typeof saveProjectContent>>;
    });
    const first = useIde.getState().syncQueuedSaves();
    const waitingLoader = useIde.getState().syncQueuedSaves();
    let loaderUnblocked = false;
    void waitingLoader.then(() => { loaderUnblocked = true; });
    await Promise.resolve();
    expect(loaderUnblocked).toBe(false);
    releaseWrite?.();
    await Promise.all([first, waitingLoader]);
    expect(loaderUnblocked).toBe(true);
    expect(mockGetProject).toHaveBeenCalledWith('proj-loading');
  });

  it('does nothing when queue is empty', async () => {
    mockGetQueuedSaves.mockResolvedValueOnce([]);

    await act(async () => {
      await useIde.getState().syncQueuedSaves();
    });

    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });

  it('flushes a queued save and removes the row on success', async () => {
    const queued = {
      id: 42,
      queuedAt: Date.now(),
      attempts: 1,
      content: {
        id: 'proj-queued', files: { 'main.py': 'saved!' },
        assets: {}, tilemaps: {}, sounds: {}, sheet: undefined, currentFile: 'main.py', version: 7, savedAt: 0,
      },
    };
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);
    useEditor.setState({ currentProjectId: 'proj-queued', currentProjectVersion: 7 });

    await act(async () => {
      await useIde.getState().syncQueuedSaves();
    });

    expect(mockSaveProjectContent).toHaveBeenCalledTimes(1);
    expect(mockCompleteQueuedSave).toHaveBeenCalledWith(queued, 8);
    expect(useEditor.getState().currentProjectVersion).toBe(8);
  });

  it('replaces a clean stale editor with the verified offline snapshot before promoting its revision', async () => {
    const queued = {
      id: 62, queuedAt: Date.now(), attempts: 0, writerId: 'tab',
      content: { id: 'proj-reconnect', files: { 'main.py': 'offline edits' }, assets: {}, tilemaps: {}, sounds: {}, currentFile: 'main.py', version: 7, savedAt: 0 },
    };
    useEditor.setState({
      currentProjectId: 'proj-reconnect', currentProjectVersion: 7,
      project: { files: { 'main.py': 'stale server' }, assets: {}, tilemaps: {}, sounds: {} },
      currentFile: 'main.py', dirtyFiles: new Set(),
    });
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);
    await useIde.getState().syncQueuedSaves();
    expect(projectStorage.completeQueuedSave).toHaveBeenCalledWith(queued, 8);
    expect(useEditor.getState().project.files['main.py']).toBe('offline edits');
    expect(useEditor.getState().currentProjectVersion).toBe(8);
    expect(useEditor.getState().dirtyFiles.size).toBe(0);
  });

  it('preserves newer dirty editor edits as a draft without giving them the queued revision', async () => {
    const queued = {
      id: 63, queuedAt: Date.now(), attempts: 0, writerId: 'tab',
      content: { id: 'proj-dirty-reconnect', files: { 'main.py': 'offline edits' }, assets: {}, tilemaps: {}, sounds: {}, currentFile: 'main.py', version: 7, savedAt: 0 },
    };
    useEditor.setState({
      currentProjectId: 'proj-dirty-reconnect', currentProjectVersion: 7,
      project: { files: { 'main.py': 'even newer edit' }, assets: {}, tilemaps: {}, sounds: {} },
      currentFile: 'main.py', dirtyFiles: new Set(['main.py']),
    });
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);
    await useIde.getState().syncQueuedSaves();
    expect(mockSaveAnonymousDraft).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({ files: { 'main.py': 'even newer edit' } }),
    }));
    expect(useEditor.getState().project.files['main.py']).toBe('even newer edit');
    expect(useEditor.getState().currentProjectVersion).toBeNull();
    expect(useIde.getState().saveError?.kind).toBe('verification');

    // An edit *after* replay must survive a route reload too: the server GET
    // can replace the cache, but cannot delete this independently stored draft.
    useEditor.getState().changeFile('main.py', 'latest edit after replay');
    expect(await useIde.getState().saveCurrentProject()).toBe(true);
    expect(mockSaveProjectContent).toHaveBeenCalledTimes(1);
    expect(mockSaveAnonymousDraft).toHaveBeenCalledWith(expect.objectContaining({
      project: expect.objectContaining({ files: { 'main.py': 'latest edit after replay' } }),
    }));
    const drafts = mockSaveAnonymousDraft.mock.calls.map(([draft]) => draft);
    expect(new Set(drafts.map((draft) => draft.id)).size).toBe(drafts.length);
    useEditor.getState().changeCurrentProject({
      files: { 'main.py': 'offline edits' }, assets: {}, tilemaps: {}, sounds: {},
    }, 'proj-dirty-reconnect', 8);
    expect(drafts.at(-1)?.project.files['main.py']).toBe('latest edit after replay');
  });

  it('keeps an unknown-revision edit dirty if its recovery draft cannot persist', async () => {
    setEditorState({ currentProjectId: 'unknown-revision' });
    useEditor.getState().setCurrentProjectVersion(null);
    mockSaveAnonymousDraft.mockRejectedValueOnce(new Error('quota'));
    expect(await useIde.getState().saveCurrentProject()).toBe(false);
    expect(useEditor.getState().dirtyFiles.size).toBeGreaterThan(0);
    expect(useIde.getState().saveError?.kind).toBe('quota');
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });

  it('preserves ambiguous legacy duplicate snapshots as separate recovery drafts', async () => {
    const content = (text: string) => ({
      id: 'proj-multi-queued', files: { 'main.py': text }, assets: {}, tilemaps: {},
      sounds: {}, sheet: undefined, currentFile: 'main.py', version: 7, savedAt: 0,
    });
    mockGetQueuedSaves.mockResolvedValueOnce([
      { id: 40, queuedAt: 10, attempts: 0, content: content('first offline edit') },
      { id: 41, queuedAt: 20, attempts: 0, content: content('latest offline edit') },
    ]);
    useEditor.setState({ currentProjectId: 'proj-multi-queued', currentProjectVersion: 7 });

    await useIde.getState().syncQueuedSaves();

    expect(mockSaveProjectContent).not.toHaveBeenCalled();
    expect(mockSaveAnonymousDraftIfAbsent).toHaveBeenCalledTimes(2);
    expect(mockSaveAnonymousDraftIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      id: '__anon_draft_recovered_proj-multi-queued_queue_40',
      project: expect.objectContaining({ files: { 'main.py': 'first offline edit' } }),
    }));
    expect(mockSaveAnonymousDraftIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      id: '__anon_draft_recovered_proj-multi-queued_queue_41',
      project: expect.objectContaining({ files: { 'main.py': 'latest offline edit' } }),
    }));
    expect(projectStorage.removeQueuedSave).toHaveBeenCalledTimes(2);
  });

  it('converts a versionless queued save to a durable recovery draft before removing it', async () => {
    const queued = {
      id: 52, queuedAt: 20, attempts: 0, writerId: 'old-tab',
      content: {
        id: 'proj-v3-offline', files: { 'main.py': 'offline source' }, assets: { 'art.png': 'base64' },
        tilemaps: {}, sounds: {}, sheet: undefined, currentFile: 'main.py', savedAt: 0,
      },
    };
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);

    await useIde.getState().syncQueuedSaves();

    expect(mockSaveProjectContent).not.toHaveBeenCalled();
    expect(mockSaveAnonymousDraftIfAbsent).toHaveBeenCalledWith(expect.objectContaining({
      id: '__anon_draft_recovered_proj-v3-offline_queue_52',
      project: expect.objectContaining({
        files: { 'main.py': 'offline source' }, assets: { 'art.png': 'base64' },
      }),
    }));
    expect(projectStorage.removeQueuedSave).toHaveBeenCalledWith(52);
    expect(useIde.getState().saveError?.kind).toBe('verification');
  });

  it('retains queued work when server read-back verification mismatches', async () => {
    const queued = { id: 8, queuedAt: Date.now(), attempts: 0, content: { id: 'proj-mismatch', files: { 'main.py': 'wanted' }, assets: {}, tilemaps: {}, sounds: {}, sheet: undefined, currentFile: 'main.py', version: 7, savedAt: 0 } };
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);
    mockGetProject.mockResolvedValueOnce({ id: 'proj-mismatch', version: 8, files: { 'main.py': 'different' }, assets: {}, tilemaps: {}, sounds: {}, current_file: 'main.py' } as never);
    await useIde.getState().syncQueuedSaves();
    expect(mockCompleteQueuedSave).not.toHaveBeenCalled();
  });

  it('retains the row when the API call fails (flush-failure contract)', async () => {
    const queued = {
      id: 7,
      queuedAt: Date.now(),
      attempts: 0,
      content: {
        id: 'proj-fail', files: {}, assets: {}, tilemaps: {}, sounds: {},
        sheet: undefined, currentFile: 'main.py', savedAt: 0,
      },
    };
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);
    mockSaveProjectContent.mockRejectedValueOnce(new Error('network'));

    await act(async () => {
      await useIde.getState().syncQueuedSaves();
    });

    expect(mockCompleteQueuedSave).not.toHaveBeenCalled();
  });
});
