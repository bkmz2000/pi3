import { create } from "zustand";

import { useEditor } from "./editorStore";
import { Examples } from "./exampleProjects";
import type { Project } from "./projectTypes";
import { projectStorage, isOnline } from "../utils/storage";
import { importProjectFromFile as importZipFile, downloadProjectZip } from "../utils/zip";
import { getProjects, createProject as apiCreateProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, saveProjectContent, Project as ApiProject, ApiHttpError } from "./api";
import { toEditorProject } from "./projectNormalization";
import { encodeSheet } from "./sheetCodec";
import { writeAnonStash } from "../utils/anonStash";
import { EXAMPLE_SESSION_PREFIX, isExampleSessionId, exampleNameFromSessionId } from "./sessionId";

export type PanelId = "projects" | "settings" | "docs" | "examples" | null;

export type {
  TilemapLayer,
  TilemapArea,
  TilemapData,
  SheetAnimationStrip,
  SheetSpriteEntry,
  SheetSprites,
  SheetData,
  Project,
} from "./projectTypes";

// Re-export so existing `import { X } from './IdeState'` calls keep working.
export {
  useEditor,
  EXAMPLE_SESSION_PREFIX,
  isExampleSessionId,
  exampleNameFromSessionId,
  toEditorProject,
};

export type SaveErrorKind = 'auth' | 'network' | 'quota' | 'payload';
export type SaveError = { kind: SaveErrorKind; message: string };

type IdeState = {
  activePanel: PanelId;
  projects: Record<string, Project>;
  userProjects: ApiProject[];
  loading: boolean;
  showHitboxes: boolean;
  showActorInfo: boolean;
  showConsoleOnRun: boolean;
  enableLinting: boolean;
  enableAutocomplete: boolean;
  consoleOnRight: boolean;
  loadingProjectContent: boolean;
  saveError: SaveError | null;
  fromCache: boolean;
  isSaving: boolean;

  setActivePanel: (panel: PanelId) => void;
  togglePanel: (panel: Exclude<PanelId, null>) => void;
  closePanels: () => void;
  loadUserProjects: () => Promise<void>;
  createNewProject: (name: string) => Promise<ApiProject>;
  deleteUserProject: (id: string) => Promise<void>;
  renameUserProject: (id: string, newName: string) => Promise<void>;
  forkExample: (exampleName: string, exampleProject: Project, newName?: string) => Promise<ApiProject>;
  saveCurrentProject: () => Promise<boolean>;
  syncQueuedSaves: () => Promise<void>;
  downloadProject: (id: string) => Promise<void>;
  downloadAsHtml: () => Promise<void>;
  importProjectFromFile: (file: File) => Promise<ApiProject>;
  setSaveError: (error: SaveError | null) => void;
  setShowHitboxes: (show: boolean) => void;
  setShowActorInfo: (show: boolean) => void;
  setShowConsoleOnRun: (show: boolean) => void;
  setEnableLinting: (enable: boolean) => void;
  setEnableAutocomplete: (enable: boolean) => void;
  setConsoleOnRight: (v: boolean) => void;
};

export const useIde = create<IdeState>((set, get) => ({
  activePanel: null,
  projects: Examples,
  userProjects: [],
  loading: false,
  showHitboxes: localStorage.getItem("pi3_showHitboxes") === "true",
  showActorInfo: localStorage.getItem("pi3_showActorInfo") === "true",
  showConsoleOnRun: localStorage.getItem("pi3_showConsoleOnRun") === "true",
  enableLinting: localStorage.getItem("pi3_enableLinting") === "true",
  enableAutocomplete: localStorage.getItem("pi3_enableAutocomplete") !== "false",
  consoleOnRight: localStorage.getItem("pi3_consoleOnRight") === "true",
  loadingProjectContent: false,
  saveError: null,
  fromCache: false,
  isSaving: false,

  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) =>
    set((s) => ({ activePanel: panel === s.activePanel ? null : panel })),
  closePanels: () => set({ activePanel: null }),
  setShowHitboxes: (show: boolean) => {
    localStorage.setItem("pi3_showHitboxes", String(show));
    set({ showHitboxes: show });
  },
  setShowActorInfo: (show: boolean) => {
    localStorage.setItem("pi3_showActorInfo", String(show));
    set({ showActorInfo: show });
  },
  setShowConsoleOnRun: (show: boolean) => {
    localStorage.setItem("pi3_showConsoleOnRun", String(show));
    set({ showConsoleOnRun: show });
  },
  setEnableLinting: (enable: boolean) => {
    localStorage.setItem("pi3_enableLinting", String(enable));
    set({ enableLinting: enable });
  },
  setEnableAutocomplete: (enable: boolean) => {
    localStorage.setItem("pi3_enableAutocomplete", String(enable));
    set({ enableAutocomplete: enable });
  },
  setConsoleOnRight: (v: boolean) => {
    localStorage.setItem("pi3_consoleOnRight", String(v));
    set({ consoleOnRight: v });
  },

  loadUserProjects: async () => {
    set({ loading: true });
    try {
      const userProjects = await getProjects();
      set({ userProjects, loading: false, fromCache: false });
      // Cache metadata in IndexedDB for offline fallback
      projectStorage.cacheProjectMeta(userProjects as unknown as Record<string, unknown>[]).catch(() => {});
    } catch (error) {
      console.error("Failed to load user projects, trying cache:", error);
      // Fall back to IndexedDB cache
      try {
        const cached = await projectStorage.getCachedProjectMeta();
        set({ userProjects: cached as unknown as ApiProject[], loading: false, fromCache: true });
      } catch {
        set({ loading: false, fromCache: false });
      }
    }
  },

  createNewProject: async (name: string) => {
    const newProject = await apiCreateProject({
      name,
      files: { "main.py": '# New project\nprint("Hello World!")' },
      assets: {},
      tilemaps: {},
    });

    const { userProjects } = get();
    set({ userProjects: [newProject, ...userProjects] });

    return newProject;
  },

  deleteUserProject: async (id: string) => {
    await apiDeleteProject(id);
    const { userProjects } = get();
    set({ userProjects: userProjects.filter((p) => p.id !== id) });
  },

  renameUserProject: async (id: string, newName: string) => {
    const updatedProject = await apiUpdateProject(id, { name: newName });
    const { userProjects } = get();
    set({
      userProjects: userProjects.map((p) =>
        p.id === id ? { ...p, ...updatedProject } : p
      ),
    });
  },

  forkExample: async (exampleName, exampleProject, newName) => {
    const forkedProject = await apiCreateProject({
      name: newName || `${exampleName}_edited`,
      files: exampleProject.files,
      assets: exampleProject.assets,
      tilemaps: exampleProject.tilemaps,
      sounds: exampleProject.sounds,
      currentFile: exampleProject.currentFile,
    });

    const { userProjects } = get();
    set({ userProjects: [forkedProject, ...userProjects] });
    return forkedProject;
  },

  saveCurrentProject: async () => {
    const { currentProjectId, project, currentFile } = useEditor.getState();
    if (!currentProjectId) return false;

    set({ isSaving: true });
    try {
      // Example-session: persist to the anonymous stash. No API call, no
      // auth dependency. The user gets a chance to fork-and-claim on sign-in.
      if (isExampleSessionId(currentProjectId)) {
        const result = writeAnonStash({
          exampleName: exampleNameFromSessionId(currentProjectId),
          project,
        });
        if (!result.ok) {
          // Storage full or blocked — let the user know their tinkering is no
          // longer being persisted, so they can sign in (to save server-side)
          // or clear space before they lose work.
          const message = result.reason === "quota"
            ? "Local storage full — sign in to save your work"
            : "Local storage unavailable — sign in to save your work";
          set({ saveError: { kind: "quota", message } });
          return false;
        }
        set({ saveError: null });
        return true;
      }

      // Always cache full content locally (offline resilience).
      // Sheet is sparse-chunk-encoded for the wire and IndexedDB; empty regions
      // are skipped, shrinking typical 512x512 sheets by 10-30x before gzip.
      const content = {
        files: project.files,
        assets: project.assets,
        tilemaps: project.tilemaps,
        sounds: project.sounds ?? {},
        sheet: project.sheet ? encodeSheet(project.sheet) : undefined,
        currentFile,
      };
      projectStorage.cacheProjectContent(currentProjectId, content).catch(() => {});

      // If offline, queue the save for later sync
      if (!isOnline()) {
        await projectStorage.queueSave({ id: currentProjectId, ...content, savedAt: Date.now() });
        set({ saveError: { kind: "network", message: "Offline — saved locally, will sync when online" } });
        return true;
      }

      try {
        await saveProjectContent(currentProjectId, content);

        // Update the local cache
        const { userProjects } = get();
        set({
          userProjects: userProjects.map((p) => {
            if (p.id !== currentProjectId) return p;
            const updated: Record<string, unknown> = {
              ...p,
              files: project.files,
              assets: project.assets,
              tilemaps: project.tilemaps,
              updated_at: Date.now(),
            };
            if (project.sounds) updated.sounds = project.sounds;
            if (project.sheet) updated.sheet = project.sheet;
            return updated as unknown as ApiProject;
          }),
          saveError: null,
        });
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save project";
        const status = error instanceof ApiHttpError ? error.status : 0;
        // Any 4xx that isn't 401 is a permanent client-side problem (payload too
        // large, validation failure, etc.) — retrying or queueing for later sync
        // will just keep failing, so surface it and stop the auto-save loop.
        const kind: SaveErrorKind =
          status === 401 ? "auth"
          : status >= 400 && status < 500 ? "payload"
          : "network";
        const message = kind === "payload" && status === 413
          ? "Project too large to save — try removing large assets"
          : errorMessage;
        if (kind === "network") {
          await projectStorage.queueSave({ id: currentProjectId, ...content, savedAt: Date.now() });
        }
        if (kind === "auth") {
          // Not logged in — persist locally so work is never lost.
          // IndexedDB cache was written above; also write to anonymous stash.
          writeAnonStash({
            exampleName: currentProjectId,
            project,
          });
        }
        set({ saveError: { kind, message } });
        // Network/auth: local cache has the data, treat as soft-success so the
        // dirty set clears. Payload errors must keep files dirty so the user
        // can retry after shrinking the project.
        return kind !== "payload";
      }
    } finally {
      set({ isSaving: false });
    }
  },

  syncQueuedSaves: async () => {
    if (!isOnline()) return;
    const queued = await projectStorage.getQueuedSaves();
    if (queued.length === 0) return;

    for (const q of queued) {
      try {
        await saveProjectContent(q.content.id, {
          files: q.content.files,
          assets: q.content.assets,
          tilemaps: q.content.tilemaps,
          sounds: q.content.sounds,
          sheet: q.content.sheet,
          currentFile: q.content.currentFile,
        });
        await projectStorage.removeQueuedSave(q.id);
      } catch (err) {
        // If still failing (e.g. offline), stop trying
        if (!isOnline() || (err instanceof Error && err.message === "Unauthorized")) break;
        console.warn("Failed to sync queued save, will retry:", err);
        break;
      }
    }

    // Refresh userProjects after sync
    const { currentProjectId } = useEditor.getState();
    if (currentProjectId && !isExampleSessionId(currentProjectId)) {
      try {
        const refreshed = await getProjects();
        set({ userProjects: refreshed });
        projectStorage.cacheProjectMeta(refreshed as unknown as Record<string, unknown>[]).catch(() => {});
      } catch { /* refresh failed, keep current state */ }
    }
  },

  setSaveError: (error) => set({ saveError: error }),

  downloadProject: async (id: string) => {
    if (isExampleSessionId(id)) {
      const { project } = useEditor.getState();
      const ide = get();
      const exampleKey = id.slice(EXAMPLE_SESSION_PREFIX.length);
      const name = ide.userProjects.find((p) => p.id === id)?.name || project.name || exampleKey;
      const files = Object.entries(project.files).map(([fname, content]) => ({ name: fname, content }));
      await downloadProjectZip({
        id,
        name,
        files,
        assets: project.assets,
        tilemaps: project.tilemaps,
        sounds: project.sounds || {},
        sheet: project.sheet,
        updatedAt: new Date().toISOString(),
        currentFile: useEditor.getState().currentFile,
      });
      return;
    }
    await projectStorage.downloadProjectZip(id);
  },

  downloadAsHtml: async () => {
    const editor = useEditor.getState();
    const { currentProjectId, project } = editor;
    const ide = get();
    const id = currentProjectId || "untitled";
    const name = currentProjectId
      ? (ide.userProjects.find((p) => p.id === currentProjectId)?.name || project.name || "project")
      : (project.name || "example");

    const { generateHtmlExport } = await import("../utils/htmlExport");
    const files = Object.entries(project.files).map(([fname, content]) => ({ name: fname, content }));
    const html = await generateHtmlExport({
      id,
      name,
      files,
      assets: project.assets,
      tilemaps: project.tilemaps,
      sounds: project.sounds || {},
      sheet: project.sheet,
      updatedAt: new Date().toISOString(),
      currentFile: editor.currentFile,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w.-]+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  importProjectFromFile: async (file: File) => {
    const importedProject = await importZipFile(file);

    const files: Record<string, string> = {};
    importedProject.files.forEach((f) => {
      files[f.name] = f.content;
    });

    const assets: Record<string, string> = {};
    await Promise.all(
      Object.entries(importedProject.assets).map(
        ([name, blob]) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              assets[name] = reader.result as string;
              resolve();
            };
            reader.readAsDataURL(blob as Blob);
          }),
      ),
    );

    const created = await apiCreateProject({
      name: importedProject.name,
      files,
      assets,
      currentFile: importedProject.currentFile,
      tilemaps: importedProject.tilemaps || {},
      sounds: importedProject.sounds || {},
      sheet: importedProject.sheet ? encodeSheet(importedProject.sheet) : undefined,
    });

    const { userProjects } = get();
    set({ userProjects: [created, ...userProjects] });
    return created;
  },
}));
