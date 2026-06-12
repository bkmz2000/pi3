import {
  downloadProjectZip,
  StoredProject as ZipStoredProject,
} from "./zip";
import type { TilemapData } from "../state/IdeState";
import { decodeSheet, type SheetWire } from "../state/sheetCodec";

const DB_NAME = "WebIDE";
const DB_VERSION = 3;
const META_STORE = "projectMeta";
const CONTENT_STORE = "projectContent";
const SAVE_QUEUE_STORE = "saveQueue";

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
  savedAt: number;
}

export interface QueuedSave {
  id: number;
  content: ProjectContent;
  queuedAt: number;
  attempts: number;
}

function txPromise<T>(tx: IDBTransaction, op: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    op.onsuccess = () => resolve(op.result);
    op.onerror = () => reject(op.error);
    tx.onerror = () => reject(tx.error);
  });
}

export class ProjectStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Drop old schema if present
        if (db.objectStoreNames.contains("projects")) {
          db.deleteObjectStore("projects");
        }
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
      };
    });

    return this.initPromise;
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
  async cacheProjectContent(id: string, content: Omit<ProjectContent, "id" | "savedAt">): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction(CONTENT_STORE, "readwrite");
    const store = tx.objectStore(CONTENT_STORE);
    const entry = { ...content, id, savedAt: Date.now() };
    await txPromise(tx, store.put(entry));
  }

  /** Get cached full project content. Returns null if not in cache. */
  async getCachedProjectContent(id: string): Promise<ProjectContent | null> {
    const db = await this.ensureDb();
    const tx = db.transaction(CONTENT_STORE, "readonly");
    const store = tx.objectStore(CONTENT_STORE);
    return ((await txPromise(tx, store.get(id))) ?? null) as ProjectContent | null;
  }

  // ── Offline save queue ────────────────────────────────────────────────────

  /** Queue a save to retry when online */
  async queueSave(content: ProjectContent): Promise<void> {
    const db = await this.ensureDb();
    const tx = db.transaction(SAVE_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(SAVE_QUEUE_STORE);
    const queued: Omit<QueuedSave, "id"> = {
      content,
      queuedAt: Date.now(),
      attempts: 0,
    };
    await txPromise(tx, store.add(queued));
  }

  /** Get all queued saves that need syncing */
  async getQueuedSaves(): Promise<QueuedSave[]> {
    const db = await this.ensureDb();
    const tx = db.transaction(SAVE_QUEUE_STORE, "readonly");
    const store = tx.objectStore(SAVE_QUEUE_STORE);
    return (await txPromise(tx, store.getAll())) as QueuedSave[];
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
