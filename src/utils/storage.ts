import { Project } from "../state/IdeState";
import {
  projectToZip,
  zipToProject,
  downloadProjectZip,
  StoredProject as ZipStoredProject,
} from "./zip";

export interface StoredProject extends Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  isExample: boolean;
  currentFile?: string;
}

const DB_NAME = "WebIDE";
const DB_VERSION = 1;
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

        // Create projects store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
          store.createIndex("isExample", "isExample", { unique: false });
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

  async getAllProjects(): Promise<StoredProject[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const projects = request.result as StoredProject[];
        // Sort by updatedAt descending (newest first)
        projects.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        resolve(projects);
      };
    });
  }

  async getUserProjects(): Promise<StoredProject[]> {
    const allProjects = await this.getAllProjects();
    return allProjects.filter((project) => !project.isExample);
  }

  async getProject(id: string): Promise<StoredProject | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async saveProject(
    project: Omit<StoredProject, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<StoredProject> {
    const db = await this.ensureDb();

    const now = new Date().toISOString();
    const fullProject: StoredProject = {
      ...project,
      createdAt: project.createdAt || now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(fullProject);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(fullProject);
    });
  }

  async createProject(
    name: string,
    projectData: Project,
  ): Promise<StoredProject> {
    const id = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const storedProject: Omit<StoredProject, "createdAt" | "updatedAt"> = {
      id,
      name,
      ...projectData,
      isExample: false,
    };

    return this.saveProject(storedProject);
  }

  async updateProject(
    id: string,
    updates: Partial<Omit<StoredProject, "id" | "createdAt" | "isExample">>,
  ): Promise<StoredProject> {
    const existing = await this.getProject(id);
    if (!existing) {
      throw new Error(`Project ${id} not found`);
    }

    const updatedProject: StoredProject = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return this.saveProject(updatedProject);
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async forkExample(
    exampleName: string,
    exampleProject: Project,
    newName?: string,
  ): Promise<StoredProject> {
    const name = newName || `${exampleName}_edited`;

    return this.createProject(name, {
      files: { ...exampleProject.files },
      assets: { ...exampleProject.assets },
      currentFile: exampleProject.currentFile,
    });
  }

  async importProjectFromZip(
    zipData: ArrayBuffer,
    name?: string,
  ): Promise<StoredProject> {
    const zipProject = await zipToProject(zipData, { name });

    // Convert from zip format to our storage format
    const files: Record<string, string> = {};
    zipProject.files.forEach((file) => {
      files[file.name] = file.content;
    });

    const assets: Record<string, string> = {};

    // Wait for all assets to be converted
    await Promise.all(
      Object.entries(zipProject.assets).map(
        ([name, asset]) =>
          new Promise<void>((resolve) => {
            if (asset instanceof Blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                assets[name] = reader.result as string;
                resolve();
              };
              reader.readAsDataURL(asset);
            } else {
              // Handle other types if needed
              resolve();
            }
          }),
      ),
    );

    return this.createProject(zipProject.name, {
      files,
      assets,
      currentFile: zipProject.currentFile,
    });
  }

  async exportProjectToZip(id: string): Promise<ArrayBuffer> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error(`Project ${id} not found`);
    }

    // Convert to zip format
    const files = Object.entries(project.files).map(([name, content]) => ({
      name,
      content,
    }));

    const assets: Record<string, Blob> = {};
    await Promise.all(
      Object.entries(project.assets).map(async ([name, asset]) => {
        if (typeof asset === "string") {
          if (asset.startsWith("data:")) {
            const response = await fetch(asset);
            assets[name] = await response.blob();
          } else {
            // Assume it's a URL
            const response = await fetch(asset);
            assets[name] = await response.blob();
          }
        } else if (asset && typeof asset === "object") {
          if (
            "byteLength" in asset &&
            "byteOffset" in asset &&
            "buffer" in asset
          ) {
            // Likely a Uint8Array
            const u8Array = asset as Uint8Array;
            const buffer = u8Array.buffer.slice(
              u8Array.byteOffset,
              u8Array.byteOffset + u8Array.byteLength,
            ) as ArrayBuffer;
            assets[name] = new Blob([buffer]);
          } else if ("size" in asset && "type" in asset && "slice" in asset) {
            // Likely a Blob
            assets[name] = asset as unknown as Blob;
          }
        }
      }),
    );

    const zipProject: ZipStoredProject = {
      id: project.id,
      name: project.name,
      files,
      assets,
      updatedAt: project.updatedAt,
      currentFile: project.currentFile,
    };

    const zipBytes = await projectToZip(zipProject);
    return zipBytes.buffer.slice(
      zipBytes.byteOffset,
      zipBytes.byteOffset + zipBytes.byteLength,
    ) as ArrayBuffer;
  }

  async downloadProjectZip(id: string, filename?: string): Promise<void> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error(`Project ${id} not found`);
    }

    // Convert to zip format
    const files = Object.entries(project.files).map(([name, content]) => ({
      name,
      content,
    }));

    const assets: Record<string, Blob> = {};
    await Promise.all(
      Object.entries(project.assets).map(async ([name, asset]) => {
        if (typeof asset === "string") {
          if (asset.startsWith("data:")) {
            const response = await fetch(asset);
            assets[name] = await response.blob();
          } else {
            // Assume it's a URL
            const response = await fetch(asset);
            assets[name] = await response.blob();
          }
        } else if (asset && typeof asset === "object") {
          if (
            "byteLength" in asset &&
            "byteOffset" in asset &&
            "buffer" in asset
          ) {
            // Likely a Uint8Array
            const u8Array = asset as Uint8Array;
            const buffer = u8Array.buffer.slice(
              u8Array.byteOffset,
              u8Array.byteOffset + u8Array.byteLength,
            ) as ArrayBuffer;
            assets[name] = new Blob([buffer]);
          } else if ("size" in asset && "type" in asset && "slice" in asset) {
            // Likely a Blob
            assets[name] = asset as unknown as Blob;
          }
        }
      }),
    );

    const zipProject: ZipStoredProject = {
      id: project.id,
      name: project.name,
      files,
      assets,
      updatedAt: project.updatedAt,
      currentFile: project.currentFile,
    };

    await downloadProjectZip(zipProject, filename);
  }

  async clearAllUserProjects(): Promise<void> {
    const db = await this.ensureDb();
    const userProjects = await this.getUserProjects();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      userProjects.forEach((project) => {
        store.delete(project.id);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getProjectCount(): Promise<number> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

// Create a singleton instance
export const projectStorage = new ProjectStorage();
