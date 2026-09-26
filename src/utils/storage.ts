import {
  downloadProjectZip,
  StoredProject as ZipStoredProject,
} from "./zip";
import type { TilemapData, Project } from "../state/projectTypes";
import { decodeSheet, type SheetWire } from "../state/sheetCodec";

const DB_NAME = "WebIDE";
const DB_VERSION = 4;
const META_STORE = "projectMeta";
const CONTENT_STORE = "projectContent";
const SAVE_QUEUE_STORE = "saveQueue";
const ANON_DRAFT_STORE = "anonymousDrafts";

export interface AnonymousDraft {
  id: string;
  project: Project;
  exampleName?: string;
  lastModified: number;
}

export interface ProjectContent {
  id: string;
  files: Record<string, string>;
  assets: Record<string, string>;
  tilemaps: Record<string, TilemapData>;
  sounds: Record<string, string>;
  // Stored in the sparse-chunk wire shape so IndexedDB rows stay compact
  // and queued saves can re-POST without re-encoding.
  sheet: SheetWire | undefined;
  currentFile: string | undefined;
  /** Last server revision observed when this local copy was loaded/saved. */
  version?: number;
  /** Tab-local provenance; never use another tab's cached revision as a baseline. */
  writerId?: string;
  /** Opaque write token used to conditionally advance a verified cache snapshot. */
  cacheToken?: string;
  savedAt: number;
}

export interface QueuedSave {
  id: number;
  content: ProjectContent;
  queuedAt: number;
  attempts: number;
  /** Identifies snapshots that can be causally rebased after this tab's verified write. */
  writerId?: string;
}

function createWriterId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function txPromise<T>(tx: IDBTransaction, op: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let result: T;
    let requestSucceeded = false;
    let settled = false;
    const fail = (error: DOMException | null) => {
      if (settled) return;
      settled = true;
      reject(error ?? new Error("IndexedDB transaction failed"));
    };
    op.onsuccess = () => {
      result = op.result;
      requestSucceeded = true;
    };
    op.onerror = () => fail(op.error);
    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      if (requestSucceeded) resolve(result);
      else reject(new Error("IndexedDB transaction completed without a result"));
    };
    tx.onabort = () => fail(tx.error);
    tx.onerror = () => fail(tx.error);
  });
}

export class ProjectStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly writerId = createWriterId()) {
    // Initialization errors are surfaced by the first operation; avoid an
    // unhandled rejection when the constructor's eager open is blocked.
    void this.init().catch(() => undefined);
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    const opening: Promise<void> = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      let settled = false;
      const reset = () => {
        if (this.initPromise === opening) this.initPromise = null;
      };

      request.onerror = () => {
        if (settled) return;
        settled = true;
        reset();
        reject(request.error ?? new Error("Could not open browser storage"));
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reset();
        reject(new Error("Browser storage upgrade is blocked by another open pi3 tab. Close or reload other pi3 tabs, then retry the save."));
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
          this.initPromise = null;
        };
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Keep legacy stores intact and copy their contents forward below.
        // Deleting or clearing a student-work store during an upgrade is forbidden.
        const legacyProjects = db.objectStoreNames.contains("projects")
          ? (event.target as IDBOpenDBRequest).transaction?.objectStore("projects")
          : undefined;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(CONTENT_STORE)) {
          db.createObjectStore(CONTENT_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SAVE_QUEUE_STORE)) {
          const qStore = db.createObjectStore(SAVE_QUEUE_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          qStore.createIndex("projectId", "projectId", { unique: false });
        }
        if (!db.objectStoreNames.contains(ANON_DRAFT_STORE)) {
          db.createObjectStore(ANON_DRAFT_STORE, { keyPath: "id" });
        }
        if (legacyProjects) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          const metaStore = transaction?.objectStore(META_STORE);
          const draftStore = transaction?.objectStore(ANON_DRAFT_STORE);
          const request = legacyProjects.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const legacy = cursor.value as Record<string, unknown>;
            if (typeof legacy.id === "string" || typeof legacy.id === "number") {
              const hasProjectContent = ["files", "assets", "tilemaps", "sounds", "sheet"]
                .some((key) => legacy[key] !== undefined);
              if (!hasProjectContent) {
                // Metadata-only rows stay metadata; never synthesize empty student work.
                const existing = metaStore?.get(legacy.id);
                if (existing && metaStore) {
                  existing.onsuccess = () => {
                    if (existing.result === undefined) metaStore.put(legacy);
                  };
                }
              } else {
                const updated = legacy.updatedAt ?? legacy.updated_at;
                const parsedTime = typeof updated === "number" ? updated : Date.parse(String(updated ?? ""));
                const projectFields = { ...legacy };
                delete projectFields.id;
                delete projectFields.createdAt;
                delete projectFields.updatedAt;
                delete projectFields.updated_at;
                delete projectFields.created_at;
                delete projectFields.current_file;
                delete projectFields.isExample;
                delete projectFields.user_id;
                delete projectFields.role;
                delete projectFields.version;
                delete projectFields.description;
                delete projectFields.is_public;
                const project = {
                  ...projectFields,
                  files: (legacy.files && typeof legacy.files === "object" ? legacy.files : {}) as Record<string, string>,
                  assets: (legacy.assets && typeof legacy.assets === "object" ? legacy.assets : {}) as Record<string, string>,
                  tilemaps: (legacy.tilemaps && typeof legacy.tilemaps === "object" ? legacy.tilemaps : {}) as Record<string, TilemapData>,
                  sounds: (legacy.sounds && typeof legacy.sounds === "object" ? legacy.sounds : {}) as Record<string, string>,
                  sheet: legacy.sheet as Project["sheet"],
                  currentFile: typeof legacy.currentFile === "string"
                    ? legacy.currentFile
                    : typeof legacy.current_file === "string" ? legacy.current_file : undefined,
                } as unknown as Project;
                const draftId = `__anon_draft_legacy_${legacy.id}`;
                const existingDraft = draftStore?.get(draftId);
                if (existingDraft && draftStore) {
                  existingDraft.onsuccess = () => {
                    // A prior/current draft wins; keep legacy source untouched.
                    if (existingDraft.result === undefined) {
                      draftStore.put({
                        id: draftId,
                        project,
                        lastModified: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
                      } satisfies AnonymousDraft);
                    }
                  };
                }
                const contentStore = transaction?.objectStore(CONTENT_STORE);
                const existingContent = contentStore?.get(String(legacy.id));
                if (existingContent && contentStore) {
                  existingContent.onsuccess = () => {
                    if (existingContent.result === undefined) {
                      contentStore.put({
                        ...project,
                        id: String(legacy.id),
                        version: typeof legacy.version === "number" ? legacy.version : undefined,
                        savedAt: Number.isFinite(parsedTime) ? parsedTime : Date.now(),
                      });
                    }
                  };
                }
              }
            }
            cursor.continue();
          };
        }
      };
    });
    this.initPromise = opening;

    return opening;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }

  // ── Project metadata cache ────────────────────────────────────────────────

  /** Cache API project list metadata for offline fallback */
  async cacheProjectMeta(projects: Record<string, unknown>[]): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    store.clear();
    for (const p of projects) store.put(p);
    await txPromise(tx, store.getAll());
  }

  async getCachedProjectMeta(): Promise<Record<string, unknown>[]> {
    const db = await this.ensureDb();
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const results = await txPromise(tx, store.getAll()) as Record<string, unknown>[];
    results.sort(
      (a, b) =>
        new Date((b.updated_at || b.updatedAt) as string).getTime() -
        new Date((a.updated_at || a.updatedAt) as string).getTime(),
    );
    return results;
  }

  // ── Full project content cache (offline editing) ──────────────────────────

  /** Cache full project content locally for offline access */
  async cacheProjectContent(id: string, content: Omit<ProjectContent, "id" | "savedAt" | "cacheToken">): Promise<string> {
    const db = await this.ensureDb();
    const tx = db.transaction(CONTENT_STORE, "readwrite");
    const store = tx.objectStore(CONTENT_STORE);
    const cacheToken = createWriterId();
    const entry = { ...content, id, writerId: this.writerId, cacheToken, savedAt: Date.now() };
    await txPromise(tx, store.put(entry));
    return cacheToken;
  }

  /** Advance a verified save's revision only if no newer local snapshot replaced it. */
  async cacheProjectContentIfCurrent(
    id: string,
    expectedCacheToken: string,
    content: Omit<ProjectContent, "id" | "savedAt" | "cacheToken">,
  ): Promise<boolean> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CONTENT_STORE, "readwrite");
      const store = tx.objectStore(CONTENT_STORE);
      const request = store.get(id);
      let updated = false;
      let settled = false;
      const fail = (error: DOMException | Error | null) => {
        if (settled) return;
        settled = true;
        reject(error ?? new Error("Could not conditionally update the project cache"));
      };
      request.onsuccess = () => {
        if (request.result?.cacheToken !== expectedCacheToken) return;
        const cacheToken = createWriterId();
        try {
          store.put({ ...content, id, writerId: this.writerId, cacheToken, savedAt: Date.now() });
          updated = true;
        } catch (error) {
          try { tx.abort(); } catch { /* transaction may already be inactive */ }
          fail(error instanceof Error ? error : new Error("Could not update the project cache"));
        }
      };
      request.onerror = () => fail(request.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(updated);
      };
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    });
  }

  /** Get cached full project content. Returns null if not in cache. */
  async getCachedProjectContent(id: string): Promise<ProjectContent | null> {
    const db = await this.ensureDb();
    const tx = db.transaction(CONTENT_STORE, "readonly");
    const store = tx.objectStore(CONTENT_STORE);
    return ((await txPromise(tx, store.get(id))) ?? null) as ProjectContent | null;
  }

  // ── Anonymous drafts ─────────────────────────────────────────────────────

  async saveAnonymousDraft(draft: AnonymousDraft): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction(ANON_DRAFT_STORE, "readwrite");
    await txPromise(tx, tx.objectStore(ANON_DRAFT_STORE).put(draft));
  }

  /** Persist a migration copy only if its deterministic destination is absent. */
  async saveAnonymousDraftIfAbsent(draft: AnonymousDraft): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ANON_DRAFT_STORE, "readwrite");
      const store = tx.objectStore(ANON_DRAFT_STORE);
      const existing = store.get(draft.id);
      let settled = false;
      const fail = (error: DOMException | Error | null) => {
        if (settled) return;
        settled = true;
        reject(error ?? new Error("Anonymous draft migration transaction failed"));
      };
      existing.onsuccess = () => {
        if (existing.result !== undefined) return;
        try {
          store.add(draft);
        } catch (error) {
          try { tx.abort(); } catch { /* transaction may already be inactive */ }
          fail(error instanceof Error ? error : new Error("Could not save migrated anonymous draft"));
        }
      };
      existing.onerror = () => fail(existing.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onabort = () => fail(tx.error);
      tx.onerror = () => fail(tx.error);
    });
  }

  async getAnonymousDraft(id: string): Promise<AnonymousDraft | null> {
    const db = await this.ensureDb();
    const tx = db.transaction(ANON_DRAFT_STORE, "readonly");
    return ((await txPromise(tx, tx.objectStore(ANON_DRAFT_STORE).get(id))) ?? null) as AnonymousDraft | null;
  }

  async listAnonymousDrafts(): Promise<AnonymousDraft[]> {
    const db = await this.ensureDb();
    const tx = db.transaction(ANON_DRAFT_STORE, "readonly");
    const drafts = await txPromise(tx, tx.objectStore(ANON_DRAFT_STORE).getAll()) as AnonymousDraft[];
    return drafts.sort((a, b) => b.lastModified - a.lastModified);
  }

  async deleteAnonymousDraft(id: string): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction(ANON_DRAFT_STORE, "readwrite");
    await txPromise(tx, tx.objectStore(ANON_DRAFT_STORE).delete(id));
  }

  // ── Offline save queue ────────────────────────────────────────────────────

  /**
   * Queue the latest complete snapshot for this tab. Same-tab snapshots may
   * supersede one another; other tabs' independent work must remain queued.
   */
  async queueSave(content: ProjectContent): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_QUEUE_STORE, "readwrite");
      const queueStore = tx.objectStore(SAVE_QUEUE_STORE);
      let rows: QueuedSave[] | undefined;
      let queueReadDone = false;
      let settled = false;
      const fail = (error: DOMException | Error | null) => {
        if (settled) return;
        settled = true;
        reject(error ?? new Error("Could not persist queued save"));
      };
      const enqueue = () => {
        if (!queueReadDone) return;
        try {
          // The editor's captured revision is the only valid baseline for this
          // snapshot. A cache revision written by another tab is not evidence
          // that this content includes that tab's changes.
          for (const row of rows ?? []) {
            if (row.content.id === content.id && row.writerId === this.writerId) queueStore.delete(row.id);
          }
          queueStore.add({ content: { ...content }, queuedAt: Date.now(), attempts: 0, writerId: this.writerId });
        } catch (error) {
          try { tx.abort(); } catch { /* transaction may already be inactive */ }
          fail(error instanceof Error ? error : new Error("Could not persist queued save"));
        }
      };
      const queueRequest = queueStore.getAll();
      queueRequest.onsuccess = () => {
        rows = queueRequest.result as QueuedSave[];
        queueReadDone = true;
        enqueue();
      };
      queueRequest.onerror = () => fail(queueRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onabort = () => fail(tx.error);
      tx.onerror = () => fail(tx.error);
    });
  }

  /** Get all queued saves that need syncing */
  async getQueuedSaves(): Promise<QueuedSave[]> {
    const db = await this.ensureDb();
    const tx = db.transaction(SAVE_QUEUE_STORE, "readonly");
    const store = tx.objectStore(SAVE_QUEUE_STORE);
    return (await txPromise(tx, store.getAll())) as QueuedSave[];
  }

  /**
   * Commit a verified queue write without clobbering another tab's snapshot.
   * Only causally related rows from the same writer may be removed/rebased, and
   * the cache revision advances only when its writer matches this queue row.
   */
  async completeQueuedSave(queued: QueuedSave, verifiedVersion: number): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SAVE_QUEUE_STORE, CONTENT_STORE], "readwrite");
      const queueStore = tx.objectStore(SAVE_QUEUE_STORE);
      const contentStore = tx.objectStore(CONTENT_STORE);
      const rowsRequest = queueStore.getAll();
      const cacheRequest = contentStore.get(queued.content.id);
      let rows: QueuedSave[] | undefined;
      let cached: ProjectContent | undefined;
      let rowsReady = false;
      let cacheReady = false;
      let settled = false;
      const fail = (error: DOMException | Error | null) => {
        if (settled) return;
        settled = true;
        reject(error ?? new Error("Could not finalize queued save"));
      };
      const finalize = () => {
        if (!rowsReady || !cacheReady) return;
        try {
          for (const row of rows ?? []) {
            if (row.content.id !== queued.content.id) continue;
            const sameWriter = Boolean(queued.writerId) && row.writerId === queued.writerId;
            if (row.id === queued.id || (sameWriter && row.id < queued.id)) {
              queueStore.delete(row.id);
            } else if (sameWriter && row.id > queued.id) {
              queueStore.put({ ...row, content: { ...row.content, version: verifiedVersion } });
            }
          }
          const cacheMatches = (content: QueuedSave['content']) => cached && JSON.stringify([
            cached.files, cached.assets, cached.tilemaps, cached.sounds, cached.sheet, cached.currentFile,
          ]) === JSON.stringify([
            content.files, content.assets, content.tilemaps, content.sounds, content.sheet, content.currentFile,
          ]);
          const newerQueuedCopy = (rows ?? []).some((row) => row.id > queued.id
            && row.writerId === queued.writerId && cacheMatches(row.content));
          // Only promote cache revisions for verified content or for a newer
          // queued snapshot from the same tab that was rebased above. An unqueued
          // editor edit must never inherit the older snapshot's revision.
          if (cached?.writerId === queued.writerId && queued.writerId
            && (cacheMatches(queued.content) || newerQueuedCopy)) {
            contentStore.put({ ...cached, version: verifiedVersion });
          } else if (!cached) {
            contentStore.put({ ...queued.content, writerId: queued.writerId, version: verifiedVersion, savedAt: Date.now() });
          }
        } catch (error) {
          try { tx.abort(); } catch { /* transaction may already be inactive */ }
          fail(error instanceof Error ? error : new Error("Could not finalize queued save"));
        }
      };
      rowsRequest.onsuccess = () => {
        rows = rowsRequest.result as QueuedSave[];
        rowsReady = true;
        finalize();
      };
      cacheRequest.onsuccess = () => {
        cached = cacheRequest.result as ProjectContent | undefined;
        cacheReady = true;
        finalize();
      };
      rowsRequest.onerror = () => fail(rowsRequest.error);
      cacheRequest.onerror = () => fail(cacheRequest.error);
      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onabort = () => fail(tx.error);
      tx.onerror = () => fail(tx.error);
    });
  }

  /** Remove a queued save after successful sync */
  async removeQueuedSave(id: number): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction(SAVE_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SAVE_QUEUE_STORE);
    await txPromise(tx, store.delete(id));
  }

  /** Remove all queued saves for a given project ID */
  async removeQueuedSavesForProject(projectId: string): Promise<void> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SAVE_QUEUE_STORE, "readwrite");
      const store = tx.objectStore(SAVE_QUEUE_STORE);
      const req = store.getAll();
      // Delete loop runs inside onsuccess to keep all requests within the same
      // active transaction. Awaiting across an IDB callback boundary causes the
      // transaction to auto-commit before the deletes are placed.
      req.onsuccess = () => {
        for (const q of req.result as QueuedSave[]) {
          if (q.content.id === projectId) store.delete(q.id);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Zip export ────────────────────────────────────────────────────────────

  async downloadProjectZip(id: string, filename?: string): Promise<void> {
    const content = await this.getCachedProjectContent(id);
    if (!content) throw new Error(`Project ${id} not found in cache`);

    const files = Object.entries(content.files).map(([name, content]) => ({ name, content }));
    const zipProject: ZipStoredProject = {
      id,
      name: id,
      files,
      assets: content.assets,
      tilemaps: content.tilemaps as Record<string, import("./zip").TilemapData>,
      sounds: content.sounds,
      // Zip format carries the legacy flat-buffer SheetData. Decode before
      // handing off so the export stays self-contained and human-inspectable.
      sheet: decodeSheet(content.sheet) as import("./zip").SheetData | undefined,
      updatedAt: new Date().toISOString(),
      currentFile: content.currentFile,
    };
    await downloadProjectZip(zipProject, filename);
  }
}

export const projectStorage = new ProjectStorage();

// ── Online status helpers ───────────────────────────────────────────────────

let syncCallback: (() => void) | null = null;

export function onOnline(cb: () => void): () => void {
  syncCallback = cb;
  const handler = () => { if (navigator.onLine) cb(); };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

export function triggerSync(): void {
  if (syncCallback) syncCallback();
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine;
}
