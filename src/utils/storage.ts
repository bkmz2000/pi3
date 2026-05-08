import { Project } from "../state/IdeState";
import {
  projectToZip,
  zipToProject,
  downloadProjectZip,
  StoredProject as ZipStoredProject,
} from "./zip";

const DB_NAME = "WebIDE";
const DB_VERSION = 2;
const STORE_NAME = "projects";

class ProjectStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        } else {
          // Clear old schema on version upgrade
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            transaction.objectStore(STORE_NAME).clear();
          }
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDb(): Promise<IDBDatabase> {
    await this.init();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  /** Cache API project list for offline fallback */
  async cacheProjects(projects: Record<string, unknown>[]): Promise<void> {
    const db = await this.ensureDb();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    for (const project of projects) {
      store.put(project);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getUserProjects(): Promise<Record<string, unknown>[]> {
    const db = await this.ensureDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result as Record<string, unknown>[];
        results.sort(
          (a, b) =>
            new Date((b.updated_at || b.updatedAt) as string).getTime() -
            new Date((a.updated_at || a.updatedAt) as string).getTime(),
        );
        resolve(results);
      };
    });
  }

  async downloadProjectZip(id: string, filename?: string): Promise<void> {
    const db = await this.ensureDb();
    const project = await new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as Record<string, unknown> || null);
    });

    if (!project) {
      throw new Error(`Project ${id} not found in cache`);
    }

    const files = Object.entries((project?.files || {}) as Record<string, string>).map(([name, content]) => ({
      name,
      content,
    }));

    const assets = (project?.assets || {}) as Record<string, string>;
    const name = (project?.name || "project") as string;
    const currentFile = (project?.current_file || Object.keys(files)[0]) as string | undefined;

    const zipProject: ZipStoredProject = {
      id,
      name,
      files,
      assets,
      updatedAt: new Date().toISOString(),
      currentFile,
    };

    await downloadProjectZip(zipProject, filename);
  }
}

export const projectStorage = new ProjectStorage();
