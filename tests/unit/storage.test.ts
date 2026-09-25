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

  it('coalesces repeated offline saves to the newest complete project snapshot', async () => {
    await storage.queueSave(makeContent('proj-dup', { files: { 'main.py': 'v1' } }));
    await storage.queueSave(makeContent('proj-dup', { files: { 'main.py': 'v2' } }));

    const queued = await storage.getQueuedSaves();
    expect(queued).toHaveLength(1);
    expect(queued[0].content.files['main.py']).toBe('v2');
  });

  it('rebases a newer queued snapshot from the same tab after prior sync', async () => {
    storage = new ProjectStorage('tab-a');
    const first = makeContent('proj-race', { files: { 'main.py': 'sent snapshot' }, version: 7 });
    await storage.queueSave(first);
    const [queuedFirst] = await storage.getQueuedSaves();
    const newer = makeContent('proj-race', { files: { 'main.py': 'newer local edits' }, version: 7 });
    await storage.cacheProjectContent('proj-race', newer);

    // Model a same-tab edit queued while the first snapshot is in flight.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE', 4);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('saveQueue', 'readwrite');
    tx.objectStore('saveQueue').add({ content: newer, queuedAt: Date.now(), attempts: 0, writerId: 'tab-a' });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    await storage.completeQueuedSave(queuedFirst, 8);

    const remaining = await storage.getQueuedSaves();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].content.files['main.py']).toBe('newer local edits');
    expect(remaining[0].content.version).toBe(8);
    await expect(storage.getCachedProjectContent('proj-race')).resolves.toMatchObject({
      files: { 'main.py': 'newer local edits' }, version: 8,
    });
  });

  it('does not inherit another tab cache revision or rebase its queued snapshot', async () => {
    storage = new ProjectStorage('tab-a');
    const otherTab = new ProjectStorage('tab-b');
    const first = makeContent('proj-cross-tab', { files: { 'main.py': 'tab A' }, version: 7 });
    const second = makeContent('proj-cross-tab', { files: { 'main.py': 'tab B' }, version: 7 });
    await otherTab.cacheProjectContent('proj-cross-tab', { ...second, version: 8 });
    await storage.queueSave(first);
    await otherTab.queueSave(second);

    const rows = await storage.getQueuedSaves();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.content.version)).toEqual([7, 7]);
    await storage.completeQueuedSave(rows[0], 8);

    const remaining = await storage.getQueuedSaves();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].writerId).toBe('tab-b');
    expect(remaining[0].content.version).toBe(7);
    await expect(storage.getCachedProjectContent('proj-cross-tab')).resolves.toMatchObject({
      files: { 'main.py': 'tab B' }, version: 8, writerId: 'tab-b',
    });
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

// ── Anonymous drafts ─────────────────────────────────────────────────────────

describe('anonymous drafts', () => {
  const makeDraft = (id: string, lastModified: number) => ({
    id,
    project: {
      name: id,
      files: { 'main.py': `print('${id}')` },
      assets: { 'sprite.png': 'data:image/png;base64,abc' },
      tilemaps: {},
      sounds: {},
    },
    lastModified,
  });

  it('rejects a draft write when its transaction aborts after the request succeeds', async () => {
    const originalPut = IDBObjectStore.prototype.put;
    const abortingPut = jest.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      const request = key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
      if (this.name === 'anonymousDrafts') {
        request.addEventListener('success', () => this.transaction.abort(), { once: true });
      }
      return request;
    });
    try {
      await expect(storage.saveAnonymousDraft({
        id: '__anon_draft_aborted',
        project: { files: { 'main.py': 'print(1)' }, assets: {}, tilemaps: {}, sounds: {} },
        lastModified: 1,
      })).rejects.toBeDefined();
    } finally {
      abortingPut.mockRestore();
    }
    await expect(storage.getAnonymousDraft('__anon_draft_aborted')).resolves.toBeNull();
  });

  it('preserves a legacy projects store when upgrading the database', async () => {
    globalThis.indexedDB = new IDBFactory();
    const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE', 1);
      request.onupgradeneeded = () => {
        const projects = request.result.createObjectStore('projects', { keyPath: 'id' });
        projects.createIndex('name', 'name', { unique: false });
        projects.createIndex('updatedAt', 'updatedAt', { unique: false });
        projects.createIndex('isExample', 'isExample', { unique: false });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const tx = legacyDb.transaction(['projects'], 'readwrite');
    const legacyProject = {
      id: 'legacy-project',
      name: 'Old browser project',
      files: { 'main.py': 'print(42)' },
      assets: { 'sprite.png': 'data:image/png;base64,abc' },
      tilemaps: { level: { layers: [] } },
      sounds: { 'beep.wav': 'data:audio/wav;base64,abc' },
      sheet: { pixels: 'AAEC', width: 1, height: 1, sprites: {} },
      animations: { idle: [{ frame: 0 }] },
      currentFile: 'main.py',
      updatedAt: '2025-03-04T05:06:07.000Z',
    };
    const legacyStore = tx.objectStore('projects');
    legacyStore.put(legacyProject);
    legacyStore.put({ id: 'legacy-metadata', name: 'Offline project list row', updated_at: '2025-03-05T00:00:00.000Z' });
    for (let i = 0; i < 500; i += 1) {
      legacyStore.put({ id: `legacy-meta-${i}`, name: `Cached project ${i}`, updated_at: '2025-03-05T00:00:00.000Z' });
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    legacyDb.close();

    const upgradedStorage = new ProjectStorage();
    await upgradedStorage.listAnonymousDrafts(); // Opens version 4 and performs the upgrade.
    const upgradedDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    expect(upgradedDb.objectStoreNames.contains('projects')).toBe(true);
    const readTx = upgradedDb.transaction('projects', 'readonly');
    const recordRequest = readTx.objectStore('projects').get('legacy-project');
    const rowsRequest = readTx.objectStore('projects').getAll();
    const [record, legacyRows] = await Promise.all([
      new Promise((resolve, reject) => {
        recordRequest.onsuccess = () => resolve(recordRequest.result);
        recordRequest.onerror = () => reject(recordRequest.error);
      }),
      new Promise<unknown[]>((resolve, reject) => {
        rowsRequest.onsuccess = () => resolve(rowsRequest.result);
        rowsRequest.onerror = () => reject(rowsRequest.error);
      }),
    ]);
    expect(record).toEqual(legacyProject);
    expect(legacyRows).toHaveLength(502);
    upgradedDb.close();

    const migratedMetadata = await upgradedStorage.getCachedProjectMeta();
    expect(migratedMetadata).toHaveLength(501);
    expect(migratedMetadata).toContainEqual(expect.objectContaining({ id: 'legacy-metadata', name: 'Offline project list row' }));
    const migrated = await upgradedStorage.getAnonymousDraft('__anon_draft_legacy_legacy-project');
    expect(migrated).toEqual({
      id: '__anon_draft_legacy_legacy-project',
      project: {
        name: 'Old browser project',
        files: { 'main.py': 'print(42)' },
        assets: { 'sprite.png': 'data:image/png;base64,abc' },
        tilemaps: { level: { layers: [] } },
        sounds: { 'beep.wav': 'data:audio/wav;base64,abc' },
        sheet: { pixels: 'AAEC', width: 1, height: 1, sprites: {} },
        animations: { idle: [{ frame: 0 }] },
        currentFile: 'main.py',
      },
      lastModified: Date.parse('2025-03-04T05:06:07.000Z'),
    });
  });

  it('preserves the actually released v3 cache and queue stores during the v4 upgrade', async () => {
    globalThis.indexedDB = new IDBFactory();
    const v3Db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('projectMeta', { keyPath: 'id' });
        db.createObjectStore('projectContent', { keyPath: 'id' });
        const queue = db.createObjectStore('saveQueue', { keyPath: 'id', autoIncrement: true });
        queue.createIndex('projectId', 'projectId', { unique: false });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const meta = { id: 'meta-v3', name: 'Cached metadata', updated_at: '2025-03-06T00:00:00.000Z' };
    const content = makeContent('content-v3', { files: { 'main.py': 'print("v3 cache")' } });
    const queuedContent = makeContent('queued-v3', { files: { 'main.py': 'print("queued")' } });
    const tx = v3Db.transaction(['projectMeta', 'projectContent', 'saveQueue'], 'readwrite');
    tx.objectStore('projectMeta').put(meta);
    tx.objectStore('projectContent').put(content);
    tx.objectStore('saveQueue').add({ content: queuedContent, queuedAt: 10, attempts: 1 });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v3Db.close();

    const upgradedStorage = new ProjectStorage();
    await upgradedStorage.listAnonymousDrafts();
    expect(await upgradedStorage.getCachedProjectMeta()).toEqual([meta]);
    expect(await upgradedStorage.getCachedProjectContent(content.id)).toEqual(content);
    expect(await upgradedStorage.getQueuedSaves()).toEqual([expect.objectContaining({
      content: queuedContent,
      queuedAt: 10,
      attempts: 1,
    })]);
    expect(await upgradedStorage.listAnonymousDrafts()).toEqual([]);
  });

  it('preserves released v2 metadata-only cache rows without inventing project content', async () => {
    globalThis.indexedDB = new IDBFactory();
    const v2Db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE', 2);
      request.onupgradeneeded = () => request.result.createObjectStore('projects', { keyPath: 'id' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const metadata = {
      id: 'v2-metadata', name: 'Cached API project', description: null,
      updated_at: '2025-03-07T00:00:00.000Z', user_id: 'student-1', is_public: 0,
    };
    const tx = v2Db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(metadata);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    v2Db.close();

    const upgradedStorage = new ProjectStorage();
    await upgradedStorage.listAnonymousDrafts();
    expect(await upgradedStorage.getCachedProjectMeta()).toEqual([metadata]);
    expect(await upgradedStorage.getCachedProjectContent(metadata.id)).toBeNull();
    expect(await upgradedStorage.getAnonymousDraft('__anon_draft_legacy_v2-metadata')).toBeNull();
  });

  it('copies a retained legacy store even when the destination draft store exists, without overwriting it', async () => {
    // Deliberate coexistence fixture for collision/idempotence behavior; released v3
    // itself had no `projects` store, as verified in the separate v3-layout test.
    globalThis.indexedDB = new IDBFactory();
    const legacyDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('projectMeta', { keyPath: 'id' });
        db.createObjectStore('projectContent', { keyPath: 'id' });
        db.createObjectStore('saveQueue', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('anonymousDrafts', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const legacy = { id: 'collision', name: 'Legacy', files: { 'main.py': 'legacy' }, assets: {}, tilemaps: {}, sounds: {}, currentFile: 'main.py' };
    const existing = makeDraft('__anon_draft_legacy_collision', 999);
    const tx = legacyDb.transaction(['projects', 'anonymousDrafts'], 'readwrite');
    tx.objectStore('projects').put(legacy);
    tx.objectStore('anonymousDrafts').put(existing);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    legacyDb.close();

    const upgradedStorage = new ProjectStorage();
    await upgradedStorage.listAnonymousDrafts();
    expect(await upgradedStorage.getAnonymousDraft(existing.id)).toEqual(existing);
    expect((await upgradedStorage.getCachedProjectContent('collision'))?.files).toEqual(legacy.files);
    expect(await upgradedStorage.getAnonymousDraft('__anon_draft_legacy_collision')).toEqual(existing);
  });

  it('keeps separate projects and returns newest first', async () => {
    const older = makeDraft('__anon_draft_a', 10);
    const newer = makeDraft('__anon_draft_b', 20);
    await storage.saveAnonymousDraft(older);
    await storage.saveAnonymousDraft(newer);

    expect(await storage.getAnonymousDraft(older.id)).toEqual(older);
    expect(await storage.listAnonymousDrafts()).toEqual([newer, older]);
  });

  it('updates one draft without replacing the others and supports removal', async () => {
    await storage.saveAnonymousDraft(makeDraft('__anon_draft_a', 10));
    await storage.saveAnonymousDraft(makeDraft('__anon_draft_b', 20));
    const updated = makeDraft('__anon_draft_a', 30);
    await storage.saveAnonymousDraft(updated);
    await storage.deleteAnonymousDraft(updated.id);

    expect(await storage.getAnonymousDraft(updated.id)).toBeNull();
    expect(await storage.listAnonymousDrafts()).toHaveLength(1);
    expect((await storage.listAnonymousDrafts())[0].id).toBe('__anon_draft_b');
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

  it('does not let an older verified save replace a newer cached snapshot', async () => {
    const id = 'proj-cache-race';
    const base = { assets: {}, tilemaps: {}, sounds: {}, sheet: undefined as undefined, currentFile: 'main.py' };
    const saveAToken = await storage.cacheProjectContent(id, { ...base, files: { 'main.py': 'save A' }, version: 7 });
    await storage.cacheProjectContent(id, { ...base, files: { 'main.py': 'newer save B' }, version: 7 });

    await expect(storage.cacheProjectContentIfCurrent(id, saveAToken, { ...base, files: { 'main.py': 'save A' }, version: 8 })).resolves.toBe(false);
    expect((await storage.getCachedProjectContent(id))?.files['main.py']).toBe('newer save B');
  });

  it('advances the revision when the verified save still matches the cached snapshot', async () => {
    const id = 'proj-cache-advance';
    const base = { assets: {}, tilemaps: {}, sounds: {}, sheet: undefined as undefined, currentFile: 'main.py' };
    const token = await storage.cacheProjectContent(id, { ...base, files: { 'main.py': 'same snapshot' }, version: 7 });

    await expect(storage.cacheProjectContentIfCurrent(id, token, { ...base, files: { 'main.py': 'same snapshot' }, version: 8 })).resolves.toBe(true);
    expect(await storage.getCachedProjectContent(id)).toMatchObject({ files: { 'main.py': 'same snapshot' }, version: 8 });
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

  it('fails a blocked v3-to-v4 upgrade promptly and succeeds after the old tab closes', async () => {
    globalThis.indexedDB = new IDBFactory();
    const oldTab = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('WebIDE', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('projectMeta', { keyPath: 'id' });
        db.createObjectStore('projectContent', { keyPath: 'id' });
        const queue = db.createObjectStore('saveQueue', { keyPath: 'id', autoIncrement: true });
        queue.createIndex('projectId', 'projectId', { unique: false });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    // fake-indexeddb does not reliably dispatch `blocked` for an outstanding
    // upgrade in Jest. Deliver that event explicitly, then retry against the
    // real v3 database after the old tab closes.
    const pending = { onblocked: null as ((event: Event) => void) | null };
    const open = jest.spyOn(indexedDB, 'open').mockReturnValueOnce(pending as unknown as IDBOpenDBRequest);
    const upgradedStorage = new ProjectStorage();
    queueMicrotask(() => pending.onblocked?.(new Event('blocked')));
    try {
      await expect(upgradedStorage.listAnonymousDrafts()).rejects.toThrow(/blocked by another open pi3 tab/i);
    } finally {
      open.mockRestore();
      oldTab.close();
    }
    await expect(upgradedStorage.listAnonymousDrafts()).resolves.toEqual([]);
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
