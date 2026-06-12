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
 *   - src/utils/anonStash → jest.fn() stubs
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
  };
});

jest.mock('../../src/utils/anonStash', () => ({
  writeAnonStash: jest.fn().mockReturnValue({ ok: true }),
  readAnonStash:  jest.fn().mockReturnValue(null),
  clearAnonStash: jest.fn(),
}));

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
import { saveProjectContent, ApiHttpError } from '../../src/state/api';
import { writeAnonStash } from '../../src/utils/anonStash';
import { projectStorage, isOnline } from '../../src/utils/storage';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockSaveProjectContent = saveProjectContent as jest.MockedFunction<typeof saveProjectContent>;
const mockWriteAnonStash     = writeAnonStash     as jest.MockedFunction<typeof writeAnonStash>;
const mockIsOnline           = isOnline           as jest.MockedFunction<typeof isOnline>;
const mockQueueSave          = projectStorage.queueSave as jest.MockedFunction<typeof projectStorage.queueSave>;

function setEditorState(overrides: {
  currentProjectId?: string | null;
  files?: Record<string, string>;
  currentFile?: string;
}) {
  const { currentProjectId = 'real-proj-id', files = { 'main.py': 'print(1)' }, currentFile = 'main.py' } = overrides;
  useEditor.setState({
    currentProjectId,
    project: { files, assets: {}, tilemaps: {} },
    currentFile,
    dirtyFiles: new Set(Object.keys(files)),
  });
}

// ── Reset stores + mocks between tests ───────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOnline.mockReturnValue(true);
  mockSaveProjectContent.mockResolvedValue({} as ReturnType<typeof saveProjectContent> extends Promise<infer T> ? T : never);

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

// ── saveCurrentProject — example session ─────────────────────────────────────

describe('saveCurrentProject — example session', () => {
  it('calls writeAnonStash, never calls saveProjectContent', async () => {
    setEditorState({ currentProjectId: `${EXAMPLE_SESSION_PREFIX}snake` });

    await act(async () => {
      await useIde.getState().saveCurrentProject();
    });

    expect(mockWriteAnonStash).toHaveBeenCalledTimes(1);
    expect(mockSaveProjectContent).not.toHaveBeenCalled();
  });

  it('returns true on successful anon stash', async () => {
    mockWriteAnonStash.mockReturnValue({ ok: true });
    setEditorState({ currentProjectId: `${EXAMPLE_SESSION_PREFIX}snake` });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(true);
    expect(useIde.getState().saveError).toBeNull();
  });

  it('returns false and sets saveError.kind=quota when localStorage is full', async () => {
    mockWriteAnonStash.mockReturnValue({ ok: false, reason: 'quota' });
    setEditorState({ currentProjectId: `${EXAMPLE_SESSION_PREFIX}snake` });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(false);
    expect(useIde.getState().saveError?.kind).toBe('quota');
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

  it('401 Unauthorized: sets kind=auth, calls writeAnonStash, returns true', async () => {
    mockSaveProjectContent.mockRejectedValueOnce(new ApiHttpError(401, 'Unauthorized'));
    setEditorState({ currentProjectId: 'proj-401' });

    let result!: boolean;
    await act(async () => {
      result = await useIde.getState().saveCurrentProject();
    });

    expect(result).toBe(true);
    expect(useIde.getState().saveError?.kind).toBe('auth');
    expect(mockWriteAnonStash).toHaveBeenCalledTimes(1);
    // Auth saves are soft-success so dirty set can be cleared by caller
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

// ── syncQueuedSaves ───────────────────────────────────────────────────────────

describe('syncQueuedSaves', () => {
  const mockGetQueuedSaves = projectStorage.getQueuedSaves as jest.MockedFunction<typeof projectStorage.getQueuedSaves>;
  const mockRemoveQueuedSave = projectStorage.removeQueuedSave as jest.MockedFunction<typeof projectStorage.removeQueuedSave>;

  it('does nothing when offline', async () => {
    mockIsOnline.mockReturnValue(false);

    await act(async () => {
      await useIde.getState().syncQueuedSaves();
    });

    expect(mockGetQueuedSaves).not.toHaveBeenCalled();
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
        assets: {}, tilemaps: {}, sounds: {}, sheet: undefined, currentFile: 'main.py', savedAt: 0,
      },
    };
    mockGetQueuedSaves.mockResolvedValueOnce([queued]);
    useEditor.setState({ currentProjectId: 'proj-queued' });

    await act(async () => {
      await useIde.getState().syncQueuedSaves();
    });

    expect(mockSaveProjectContent).toHaveBeenCalledTimes(1);
    expect(mockRemoveQueuedSave).toHaveBeenCalledWith(42);
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

    expect(mockRemoveQueuedSave).not.toHaveBeenCalled();
  });
});
