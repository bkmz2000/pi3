// T1 — offline save queue & project content cache (src/utils/storage.ts)
//
// Uses the *real* module via the @/ alias. The @/ pattern in moduleNameMapper
// is checked first, so @/utils/storage resolves to src/utils/storage.ts
// rather than the jsdom stub that catches '.*\/utils\/storage$' imports.
//
// Each test gets a fresh IDBFactory so operations never bleed across tests.

// fake-indexeddb/auto must be imported first: it installs globalThis.indexedDB
// before any storage module is loaded (the ProjectStorage constructor fires
// indexedDB.open() synchronously when the class is instantiated).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { ProjectStorage, onOnline, isOnline, triggerSync } from '@/utils/storage';
import type { ProjectContent } from '@/utils/storage';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContent(id: string, overrides: Partial<ProjectContent> = {}): ProjectContent {
  return {
    id,
    files: { 'main.py': 'print("hello")' },
    assets: {},
    tilemaps: {},
    sounds: {},
    sheet: undefined,
    currentFile: 'main.py',
    savedAt: Date.now(),
    ...overrides,
  };
}

let storage: ProjectStorage;

beforeEach(() => {
  // Fresh isolated database for every test.
  globalThis.indexedDB = new IDBFactory();
  storage = new ProjectStorage();
});

// ── Offline save queue ────────────────────────────────────────────────────────

describe('offline save queue', () => {
  it('queueSave → getQueuedSaves: content round-trips exactly', async () => {
    const content = makeContent('proj-1');
    await storage.queueSave(content);

    const queued = await storage.getQueuedSaves();
    expect(queued).toHaveLength(1);
    expect(queued[0].content).toEqual(content);
    expect(queued[0].attempts).toBe(0);
  });

  it('queuing the same project twice creates two independent rows (not deduped)', async () => {
    await storage.queueSave(makeContent('proj-dup', { files: { 'main.py': 'v1' } }));
    await storage.queueSave(makeContent('proj-dup', { files: { 'main.py': 'v2' } }));

    const queued = await storage.getQueuedSaves();
    expect(queued).toHaveLength(2);
    expect(queued[0].content.files['main.py']).toBe('v1');
    expect(queued[1].content.files['main.py']).toBe('v2');
  });

  it('preserves base64 asset payload byte-exact through the IDB round-trip', async () => {
    // Corrupted base64 = silent art loss; verify the bytes come back identical.
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ==';
    const content = makeContent('proj-asset');
    content.assets = { 'sprite.png': `data:image/png;base64,${base64}` };

    await storage.queueSave(content);
    const [{ content: roundTripped }] = await storage.getQueuedSaves();

    expect(roundTripped.assets['sprite.png']).toBe(`data:image/png;base64,${base64}`);
  });

  it('preserves sparse-chunk SheetWire payload byte-exact', async () => {
    const sheet = {
      width: 64, height: 64, chunkSize: 32,
      chunks: [{ x: 0, y: 0, data: 'AAECBA==' }],
      sprites: {},
    };
    const content = makeContent('proj-sheet', { sheet });

    await storage.queueSave(content);
    const [{ content: roundTripped }] = await storage.getQueuedSaves();

    expect(roundTripped.sheet).toEqual(sheet);
  });
});

// ── removeQueuedSave ──────────────────────────────────────────────────────────

describe('removeQueuedSave', () => {
  it('removes the target row and leaves others intact', async () => {
    await storage.queueSave(makeContent('proj-A'));
    await storage.queueSave(makeContent('proj-B'));

    const before = await storage.getQueuedSaves();
    expect(before).toHaveLength(2);

    await storage.removeQueuedSave(before[0].id);

    const after = await storage.getQueuedSaves();
    expect(after).toHaveLength(1);
    expect(after[0].content.id).toBe('proj-B');
  });

  it('queue is empty after removing the only row (flush-success contract)', async () => {
    await storage.queueSave(makeContent('proj-solo'));
    const [{ id }] = await storage.getQueuedSaves();

    await storage.removeQueuedSave(id);

    expect(await storage.getQueuedSaves()).toHaveLength(0);
  });
});

// ── removeQueuedSavesForProject ───────────────────────────────────────────────

describe('removeQueuedSavesForProject', () => {
  it('removes all rows for the target project, leaves others', async () => {
    await storage.queueSave(makeContent('proj-X'));
    await storage.queueSave(makeContent('proj-X'));
    await storage.queueSave(makeContent('proj-Y'));

    await storage.removeQueuedSavesForProject('proj-X');

    const remaining = await storage.getQueuedSaves();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content.id).toBe('proj-Y');
  });

  it('is a no-op when no rows match', async () => {
    await storage.queueSave(makeContent('proj-Z'));
    await storage.removeQueuedSavesForProject('no-such-project');
    expect(await storage.getQueuedSaves()).toHaveLength(1);
  });
});

// ── Project content cache ─────────────────────────────────────────────────────

describe('project content cache', () => {
  it('cacheProjectContent → getCachedProjectContent: full round-trip', async () => {
    const id = 'proj-cache-1';
    const content = {
      files: { 'main.py': 'print(42)', 'utils.py': 'def help(): pass' },
      assets: { 'bg.png': 'data:image/png;base64,abc' },
      tilemaps: {},
      sounds: {},
      sheet: undefined,
      currentFile: 'main.py',
    };

    await storage.cacheProjectContent(id, content);
    const result = await storage.getCachedProjectContent(id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
    expect(result!.files).toEqual(content.files);
    expect(result!.assets).toEqual(content.assets);
    expect(result!.currentFile).toBe('main.py');
    expect(typeof result!.savedAt).toBe('number');
  });

  it('re-caching the same id overwrites (upsert semantics via put)', async () => {
    const id = 'proj-upsert';
    const base = { assets: {}, tilemaps: {}, sounds: {}, sheet: undefined as undefined, currentFile: 'main.py' };

    await storage.cacheProjectContent(id, { ...base, files: { 'main.py': 'v1' } });
    await storage.cacheProjectContent(id, { ...base, files: { 'main.py': 'v2' } });

    const result = await storage.getCachedProjectContent(id);
    expect(result!.files['main.py']).toBe('v2');
  });

  it('getCachedProjectContent returns null for an unknown id', async () => {
    expect(await storage.getCachedProjectContent('no-such-project')).toBeNull();
  });
});

// ── Project metadata cache ────────────────────────────────────────────────────

describe('project metadata cache', () => {
  it('cacheProjectMeta → getCachedProjectMeta: returns all items sorted newest-first', async () => {
    const projects = [
      { id: 'older', name: 'Older', updated_at: '2024-01-01T00:00:00Z' },
      { id: 'newer', name: 'Newer', updated_at: '2024-06-01T00:00:00Z' },
    ];

    await storage.cacheProjectMeta(projects);
    const result = await storage.getCachedProjectMeta();

    expect(result).toHaveLength(2);
    expect((result[0] as { id: string }).id).toBe('newer');
    expect((result[1] as { id: string }).id).toBe('older');
  });

  it('getCachedProjectMeta returns [] when cache is empty', async () => {
    expect(await storage.getCachedProjectMeta()).toEqual([]);
  });

  it('re-caching replaces previous list entirely (no duplicates)', async () => {
    await storage.cacheProjectMeta([{ id: 'a', name: 'A', updated_at: '2024-01-01T00:00:00Z' }]);
    await storage.cacheProjectMeta([{ id: 'b', name: 'B', updated_at: '2024-01-02T00:00:00Z' }]);

    const result = await storage.getCachedProjectMeta();
    expect(result).toHaveLength(1);
    expect((result[0] as { id: string }).id).toBe('b');
  });
});

// ── DB schema ─────────────────────────────────────────────────────────────────

describe('DB schema / init', () => {
  it('fresh DB creates all three object stores', async () => {
    // Access the private db via the internal helper
    const db = await (storage as unknown as { ensureDb(): Promise<IDBDatabase> }).ensureDb();
    expect(db.objectStoreNames.contains('projectMeta')).toBe(true);
    expect(db.objectStoreNames.contains('projectContent')).toBe(true);
    expect(db.objectStoreNames.contains('saveQueue')).toBe(true);
  });

  it('saveQueue store has a projectId index', async () => {
    const db = await (storage as unknown as { ensureDb(): Promise<IDBDatabase> }).ensureDb();
    const tx = db.transaction('saveQueue', 'readonly');
    expect(tx.objectStore('saveQueue').indexNames.contains('projectId')).toBe(true);
  });

  it('init() is idempotent — calling ensureDb twice returns same db', async () => {
    const s = storage as unknown as { ensureDb(): Promise<IDBDatabase> };
    const db1 = await s.ensureDb();
    const db2 = await s.ensureDb();
    expect(db1).toBe(db2);
  });
});

// ── isOnline / onOnline / triggerSync ─────────────────────────────────────────

describe('isOnline', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    expect(isOnline()).toBe(true);
  });

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    expect(isOnline()).toBe(false);
  });
});

describe('onOnline / triggerSync', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((fn) => fn());
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
  });

  it('fires callback when window dispatches online event and navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const cb = jest.fn();
    cleanups.push(onOnline(cb));

    window.dispatchEvent(new Event('online'));

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not fire callback when navigator.onLine is false at event time', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const cb = jest.fn();
    cleanups.push(onOnline(cb));

    window.dispatchEvent(new Event('online'));

    expect(cb).not.toHaveBeenCalled();
  });

  it('cleanup removes the event listener', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const cb = jest.fn();
    const cleanup = onOnline(cb);
    cleanup(); // unregister before event

    window.dispatchEvent(new Event('online'));

    expect(cb).not.toHaveBeenCalled();
  });

  it('triggerSync calls the most recently registered callback', () => {
    const cb = jest.fn();
    cleanups.push(onOnline(cb));

    triggerSync();

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
