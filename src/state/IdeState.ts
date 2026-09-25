import { create } from "zustand";

import { useEditor } from "./editorStore";
import { Examples } from "./exampleProjects";
import type { Project } from "./projectTypes";
import { projectStorage, isOnline, triggerSync } from "../utils/storage";
import type { QueuedSave } from "../utils/storage";
import { importProjectFromFile as importZipFile, downloadProjectZip } from "../utils/zip";
import { getProjects, getProject, createProject as apiCreateProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, saveProjectContent, Project as ApiProject, ApiHttpError } from "./api";
import { toEditorProject } from "./projectNormalization";
import { decodeSheet, encodeSheet } from "./sheetCodec";
import { ANON_DRAFT_PREFIX, EXAMPLE_SESSION_PREFIX, isExampleSessionId, isAnonymousDraftId, exampleNameFromSessionId } from "./sessionId";

export type PanelId = "projects" | "settings" | "docs" | "examples" | "problems" | "live" | null;

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

export type SaveErrorKind = 'auth' | 'network' | 'quota' | 'payload' | 'conflict' | 'verification';
export type SaveError = { kind: SaveErrorKind; message: string; projectId?: string };

function createRecoveryDraftId(projectId: string, reason: "auth" | "conflict"): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${ANON_DRAFT_PREFIX}recovered_${projectId}_${reason}_${suffix}`;
}

async function recoverQueuedSave(q: QueuedSave): Promise<void> {
  await projectStorage.saveAnonymousDraftIfAbsent({
    id: `${ANON_DRAFT_PREFIX}recovered_${q.content.id}_queue_${q.id}`,
    project: {
      name: `Recovered offline edits #${q.id}`,
      files: q.content.files,
      assets: q.content.assets,
      tilemaps: q.content.tilemaps,
      sounds: q.content.sounds,
      sheet: q.content.sheet ? decodeSheet(q.content.sheet) : undefined,
      currentFile: q.content.currentFile,
    },
    lastModified: q.queuedAt || Date.now(),
  });
}

async function refreshQueuedSaveCount(): Promise<void> {
  try {
    const queued = await projectStorage.getQueuedSaves();
    useEditor.getState().setQueuedSaveCount(queued.length);
  } catch {
    // A read failure must not make a successful local queue write fail.
  }
}

let queuedSyncInProgress = false;
let queuedSyncRequested = false;
let queuedSyncCompletion: Promise<void> | null = null;
let resolveQueuedSync: (() => void) | null = null;

function editorMatchesQueuedSave(editor: ReturnType<typeof useEditor.getState>, content: QueuedSave['content']): boolean {
  return JSON.stringify({
    files: editor.project.files,
    assets: editor.project.assets ?? {},
    tilemaps: editor.project.tilemaps ?? {},
    sounds: editor.project.sounds ?? {},
    sheet: editor.project.sheet ? encodeSheet(editor.project.sheet) : undefined,
    currentFile: editor.currentFile,
  }) === JSON.stringify({
    files: content.files,
    assets: content.assets ?? {},
    tilemaps: content.tilemaps ?? {},
    sounds: content.sounds ?? {},
    sheet: content.sheet,
    currentFile: content.currentFile,
  });
}

function unchangedDirtyKeys(keys: Set<string>, before: Project, beforeCurrentFile: string, after: Project, afterCurrentFile: string): string[] {
  return [...keys].filter((key) => {
    if (key === "*currentFile*") return beforeCurrentFile === afterCurrentFile;
    if (key === "*files*") return JSON.stringify(before.files) === JSON.stringify(after.files);
    if (key === "*assets*") return JSON.stringify(before.assets) === JSON.stringify(after.assets);
    if (key === "*tilemaps*") return JSON.stringify(before.tilemaps) === JSON.stringify(after.tilemaps);
    if (key === "*sounds*") return JSON.stringify(before.sounds) === JSON.stringify(after.sounds);
    if (key === "*sheet*") return JSON.stringify(before.sheet) === JSON.stringify(after.sheet);
    return before.files[key] === after.files[key];
  });
}

type IdeState = {
  activePanel: PanelId;
  projects: Record<string, Project>;
  userProjects: ApiProject[];
  loading: boolean;
  projectError: string | null;
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
  createNewProject: (name: string, description?: string) => Promise<ApiProject>;
  deleteUserProject: (id: string) => Promise<void>;
  renameUserProject: (id: string, newName: string) => Promise<void>;
  forkExample: (exampleName: string, exampleProject: Project, newName?: string) => Promise<ApiProject>;
  saveCurrentProject: () => Promise<boolean>;
  syncQueuedSaves: () => Promise<void>;
  downloadProject: (id?: string) => Promise<void>;
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
  projectError: null,
  showHitboxes: localStorage.getItem("pi3_showHitboxes") === "true",
  showActorInfo: localStorage.getItem("pi3_showActorInfo") === "true",
  showConsoleOnRun: localStorage.getItem("pi3_showConsoleOnRun") === "true",
  // Default ON: fresh students should get lint hints immediately. Only an
  // explicit opt-out (set via the settings toggle) flips it off.
  enableLinting: localStorage.getItem("pi3_enableLinting") !== "false",
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
    set({ loading: true, projectError: null });
    try {
      const userProjects = await getProjects();
      set({ userProjects, loading: false, fromCache: false, projectError: null });
      // Cache metadata in IndexedDB for offline fallback
      projectStorage.cacheProjectMeta(userProjects as unknown as Record<string, unknown>[]).catch(() => {});
    } catch (error) {
      console.error("Failed to load user projects, trying cache:", error);
      // Fall back to IndexedDB cache
      try {
        const cached = await projectStorage.getCachedProjectMeta();
        set({
          userProjects: cached as unknown as ApiProject[],
          loading: false,
          fromCache: true,
          projectError: error instanceof Error ? error.message : "Failed to load projects",
        });
      } catch {
        set({
          loading: false,
          fromCache: false,
          projectError: error instanceof Error ? error.message : "Failed to load projects",
        });
      }
    }
  },

  createNewProject: async (name: string, description?: string) => {
    set({ loading: true, projectError: null });
    try {
      const newProject = await apiCreateProject({
        name,
        description,
        files: { "main.py": '# New project\nprint("Hello World!")' },
        assets: {},
        tilemaps: {},
        sounds: {},
        currentFile: "main.py",
      });

      const { userProjects } = get();
      set({ userProjects: [newProject, ...userProjects], loading: false });
      return newProject;
    } catch (error) {
      set({
        loading: false,
        projectError: error instanceof Error ? error.message : "Failed to create project",
      });
      throw error;
    }
  },

  deleteUserProject: async (id: string) => {
    set({ projectError: null });
    try {
      await apiDeleteProject(id);
      const { userProjects } = get();
      set({ userProjects: userProjects.filter((p) => p.id !== id) });
    } catch (error) {
      set({ projectError: error instanceof Error ? error.message : "Failed to delete project" });
      throw error;
    }
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
      sheet: exampleProject.sheet ? encodeSheet(exampleProject.sheet) : undefined,
      currentFile: exampleProject.currentFile,
    });

    const { userProjects } = get();
    set({ userProjects: [forkedProject, ...userProjects] });
    return forkedProject;
  },

  saveCurrentProject: async () => {
    const { currentProjectId, project, currentFile, currentProjectVersion, dirtyFiles: initialDirty } = useEditor.getState();
    if (!currentProjectId) return false;
    const snapshotDirty = new Set(initialDirty);
    const markSnapshotClean = () => {
      const latest = useEditor.getState();
      if (latest.currentProjectId === currentProjectId) {
        latest.markClean(unchangedDirtyKeys(snapshotDirty, project, currentFile, latest.project, latest.currentFile));
      }
    };

    set({ isSaving: true });
    try {
      // Example-session: persist to the anonymous stash. No API call, no
      // auth dependency. The user gets a chance to fork-and-claim on sign-in.
      if (isExampleSessionId(currentProjectId)) {
        try {
          await projectStorage.saveAnonymousDraft({
            id: currentProjectId,
            exampleName: exampleNameFromSessionId(currentProjectId),
            project,
            lastModified: Date.now(),
          });
          markSnapshotClean();
          set({ saveError: null });
          return true;
        } catch (error) {
          const message = error instanceof DOMException && error.name === "QuotaExceededError"
            ? "Device storage full — export your project or sign in to save it"
            : "Device storage unavailable — export your project or sign in to save it";
          set({ saveError: { kind: "quota", message } });
          return false;
        }
      }

      if (isAnonymousDraftId(currentProjectId)) {
        try {
          await projectStorage.saveAnonymousDraft({
            id: currentProjectId,
            project,
            lastModified: Date.now(),
          });
          markSnapshotClean();
          set({ saveError: null });
          return true;
        } catch (error) {
          const message = error instanceof DOMException && error.name === "QuotaExceededError"
            ? "Device storage full — export your project or sign in to save it"
            : "Device storage unavailable — export your project or sign in to save it";
          set({ saveError: { kind: "quota", message } });
          return false;
        }
      }

      // A rejected optimistic write must not silently resume cloud writes, but
      // later edits still need a durable device copy. Each snapshot gets its own
      // recovery ID so an overlapping save cannot replace newer local work.
      if (get().saveError?.kind === "conflict" && get().saveError?.projectId === currentProjectId) {
        try {
          await projectStorage.saveAnonymousDraft({
            id: createRecoveryDraftId(currentProjectId, "conflict"),
            project: { ...project, currentFile },
            lastModified: Date.now(),
          });
          markSnapshotClean();
          return true;
        } catch {
          set({ saveError: { kind: "quota", message: "Could not preserve new edits after a conflict — export your project now" } });
          return false;
        }
      }

      // Persist a complete recovery copy before attempting cloud persistence.
      // Sheet is sparse-chunk-encoded on the wire and in IndexedDB.
      const content = {
        files: project.files,
        assets: project.assets,
        tilemaps: project.tilemaps,
        sounds: project.sounds ?? {},
        sheet: project.sheet ? encodeSheet(project.sheet) : undefined,
        currentFile,
      };
      let initialCacheToken: string;
      try {
        initialCacheToken = await projectStorage.cacheProjectContent(currentProjectId, {
          ...content,
          version: currentProjectVersion ?? undefined,
        });
      } catch (error) {
        const message = error instanceof DOMException && error.name === "QuotaExceededError"
          ? "Device storage full — export your project before continuing"
          : "Could not create a local recovery copy — export your project before continuing";
        set({ saveError: { kind: "quota", message } });
        return false;
      }

      if (!isOnline()) {
        try {
          await projectStorage.queueSave({ id: currentProjectId, ...content, version: currentProjectVersion ?? undefined, savedAt: Date.now() });
          if (queuedSyncInProgress) queuedSyncRequested = true;
          else if (isOnline()) triggerSync();
          await refreshQueuedSaveCount();
          markSnapshotClean();
          set({ saveError: { kind: "network", message: "Offline — saved locally, will sync when online" } });
          return true;
        } catch {
          set({ saveError: { kind: "quota", message: "Could not queue your save — export your project now" } });
          return false;
        }
      }

      let writeReturned = false;
      try {
        const expectedVersion = currentProjectVersion;
        if (expectedVersion === null) {
          set({ saveError: { kind: "verification", message: "Project revision is unknown — reload before saving to the cloud" } });
          return false;
        }
        const saved = await saveProjectContent(currentProjectId, content, expectedVersion);
        writeReturned = true;
        const verified = await getProject(currentProjectId);
        const sameContent = JSON.stringify({ files: verified.files, assets: verified.assets, tilemaps: verified.tilemaps ?? {}, sounds: verified.sounds ?? {}, sheet: verified.sheet, currentFile: verified.current_file })
          === JSON.stringify({ files: content.files, assets: content.assets, tilemaps: content.tilemaps, sounds: content.sounds, sheet: content.sheet, currentFile: content.currentFile });
        if (!Number.isFinite(saved.version) || saved.version !== verified.version || !sameContent) {
          set({ saveError: { kind: "verification", message: "Cloud save could not be verified — your local copy is safe" } });
          return false;
        }
        if (useEditor.getState().currentProjectId === currentProjectId) {
          useEditor.getState().setCurrentProjectVersion(verified.version!);
        }
        await projectStorage.cacheProjectContentIfCurrent(currentProjectId, initialCacheToken, {
          ...content,
          version: verified.version,
        });

        const { userProjects } = get();
        set({
          userProjects: userProjects.map((p) => p.id === currentProjectId ? { ...p, ...verified } : p),
          saveError: null,
        });
        markSnapshotClean();
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save project";
        const status = error instanceof ApiHttpError ? error.status : 0;
        // Any 4xx that isn't 401 is a permanent client-side problem (payload too
        // large, validation failure, etc.) — retrying or queueing for later sync
        // will just keep failing, so surface it and stop the auto-save loop.
        const kind: SaveErrorKind =
          writeReturned ? "verification"
          : status === 409 ? "conflict"
          : status === 401 || status === 403 ? "auth"
          : status >= 400 && status < 500 ? "payload"
          : "network";
        const message = kind === "payload" && status === 413
          ? "Project too large to save — try removing large assets"
          : errorMessage;
        if (kind === "auth" || kind === "conflict") {
          // Preserve a distinct recovery draft; never overwrite the remote/local
          // baseline after a rejected optimistic write.
          try {
            await projectStorage.saveAnonymousDraft({
              id: createRecoveryDraftId(currentProjectId, kind),
              project,
              lastModified: Date.now(),
            });
          } catch {
            set({ saveError: { kind: "quota", message: "Could not save a local recovery copy — export your project now" } });
            return false;
          }
        }
        if (kind === "network") {
          try {
            await projectStorage.queueSave({ id: currentProjectId, ...content, version: currentProjectVersion ?? undefined, savedAt: Date.now() });
            if (queuedSyncInProgress) queuedSyncRequested = true;
            else if (isOnline()) triggerSync();
            await refreshQueuedSaveCount();
            markSnapshotClean();
          } catch {
            set({ saveError: { kind: "quota", message: "Could not queue your save — export your project now" } });
            return false;
          }
        }
        set({ saveError: { kind, message, ...(kind === "conflict" ? { projectId: currentProjectId } : {}) } });
        return kind === "network";
      }
    } finally {
      set({ isSaving: false });
    }
  },

  syncQueuedSaves: async () => {
    if (queuedSyncInProgress) {
      queuedSyncRequested = true;
      // Route loading must wait for an in-flight replay before reading the
      // server, otherwise an older GET can replace a newly synced snapshot.
      return queuedSyncCompletion ?? undefined;
    }
    queuedSyncInProgress = true;
    queuedSyncCompletion = new Promise<void>((resolve) => { resolveQueuedSync = resolve; });
    queuedSyncRequested = false;
    let didSync = false;
    let editorNeedsRecovery = false;
    try {
      let syncFailed = false;
      let rounds = 0;
      let firstRound = true;
      while (!syncFailed && (firstRound || isOnline()) && rounds < 20) {
        firstRound = false;
        rounds += 1;
        queuedSyncRequested = false;
        let queued: Awaited<ReturnType<typeof projectStorage.getQueuedSaves>>;
        try {
          queued = await projectStorage.getQueuedSaves();
        } catch (error) {
          set({ saveError: { kind: "quota", message: "Could not inspect locally queued saves" } });
          console.warn("Could not read offline save queue:", error);
          syncFailed = true;
          break;
        }
        useEditor.getState().setQueuedSaveCount(queued.length);
        // On mount inspect the queue even without connectivity, but do not
        // send its snapshots until the browser reports that it is online.
        if (!isOnline()) break;
        if (!queued.length) {
          if (queuedSyncRequested) continue;
          break;
        }
        // A snapshot without provenance cannot safely be rebased against another
        // tab's write. Preserve ambiguous legacy rows as independent drafts.
        const legacyByProject = new Map<string, QueuedSave[]>();
        for (const q of queued) {
          if (q.writerId) continue;
          const rows = legacyByProject.get(q.content.id) ?? [];
          rows.push(q);
          legacyByProject.set(q.content.id, rows);
        }
        const rowsToRecover = queued.filter((q) =>
          q.content.version === undefined || (!q.writerId && (legacyByProject.get(q.content.id)?.length ?? 0) > 1),
        );
        if (rowsToRecover.length) {
          try {
            for (const q of rowsToRecover.sort((a, b) => a.id - b.id)) {
              await recoverQueuedSave(q);
              await projectStorage.removeQueuedSave(q.id);
            }
            await refreshQueuedSaveCount();
            syncFailed = true;
            set({ saveError: { kind: "verification", message: "Older queued saves were preserved as local recovery drafts. Open Projects to continue." } });
          } catch {
            syncFailed = true;
            set({ saveError: { kind: "quota", message: "Could not preserve an older queued save as a recovery draft" } });
          }
          break;
        }

        // Sync one latest snapshot per project/tab. Other tabs keep their own
        // captured revision and will conflict into a recovery draft if stale.
        const latestByWriter = new Map<string, QueuedSave>();
        for (const q of [...queued].sort((a, b) => a.id - b.id)) {
          const source = q.writerId ?? "legacy-single-writer";
          latestByWriter.set(`${q.content.id}\u0000${source}`, q);
        }

        for (const q of latestByWriter.values()) {
          if (q.content.version === undefined) {
            try {
              await recoverQueuedSave(q);
              await projectStorage.removeQueuedSave(q.id);
              await refreshQueuedSaveCount();
              set({ saveError: { kind: "verification", message: "Queued save was preserved as a local recovery draft. Open Projects to continue." } });
            } catch {
              set({ saveError: { kind: "quota", message: "Could not preserve the queued save as a recovery draft" } });
            }
            syncFailed = true;
            break;
          }
          let writeReturned = false;
          try {
            const payload = {
              files: q.content.files,
              assets: q.content.assets,
              tilemaps: q.content.tilemaps,
              sounds: q.content.sounds,
              sheet: q.content.sheet,
              currentFile: q.content.currentFile,
            };
            const saved = await saveProjectContent(q.content.id, payload, q.content.version);
            writeReturned = true;
            const verified = await getProject(q.content.id);
            const sameContent = JSON.stringify({ files: verified.files, assets: verified.assets, tilemaps: verified.tilemaps ?? {}, sounds: verified.sounds ?? {}, sheet: verified.sheet, currentFile: verified.current_file })
              === JSON.stringify({ files: payload.files, assets: payload.assets, tilemaps: payload.tilemaps, sounds: payload.sounds, sheet: payload.sheet, currentFile: payload.currentFile });
            if (!Number.isFinite(saved.version) || saved.version !== verified.version || !sameContent) throw new Error("Queued save verification failed");
            const beforeCompletion = useEditor.getState();
            if (beforeCompletion.currentProjectId === q.content.id && beforeCompletion.dirtyFiles.size > 0
              && !editorMatchesQueuedSave(beforeCompletion, q.content)) {
              await projectStorage.saveAnonymousDraft({
                id: createRecoveryDraftId(q.content.id, "conflict"),
                project: { ...beforeCompletion.project, currentFile: beforeCompletion.currentFile },
                lastModified: Date.now(),
              });
            }
            await projectStorage.completeQueuedSave(q, verified.version!);
            const currentEditor = useEditor.getState();
            if (currentEditor.currentProjectId === q.content.id) {
              if (currentEditor.dirtyFiles.size > 0 && !editorMatchesQueuedSave(currentEditor, q.content)) {
                // A newer edit must never inherit the queued snapshot's revision.
                // Keep a separate recovery copy if it changed during completion.
                if (currentEditor !== beforeCompletion) {
                  await projectStorage.saveAnonymousDraft({
                    id: createRecoveryDraftId(q.content.id, "conflict"),
                    project: { ...currentEditor.project, currentFile: currentEditor.currentFile },
                    lastModified: Date.now(),
                  });
                }
                currentEditor.setCurrentProjectVersion(null);
                editorNeedsRecovery = true;
              } else if (!editorMatchesQueuedSave(currentEditor, q.content)) {
                // The loader showed an older, clean server copy while replay ran.
                currentEditor.changeCurrentProject(toEditorProject(verified), q.content.id, verified.version);
              } else {
                currentEditor.setCurrentProjectVersion(verified.version!);
                currentEditor.markClean();
              }
            }
            await refreshQueuedSaveCount();
            didSync = true;
          } catch (err) {
            syncFailed = true;
            const status = err instanceof ApiHttpError ? err.status : 0;
            const kind: SaveErrorKind = writeReturned || (err instanceof Error && err.message === "Queued save verification failed")
              ? "verification"
              : status === 409 ? "conflict"
              : status === 401 || status === 403 ? "auth"
              : "network";
            let recovered = false;
            if (kind === "conflict" || kind === "auth") {
              try {
                await recoverQueuedSave(q);
                await projectStorage.removeQueuedSave(q.id);
                await refreshQueuedSaveCount();
                recovered = true;
              } catch {
                set({ saveError: { kind: "quota", message: "Could not save a recovery copy of the queued project" } });
                break;
              }
            }
            set({ saveError: recovered
              ? { kind: "verification", message: "Queued edits were saved as a local recovery draft. Open Projects to continue." }
              : { kind, message: kind === "verification" ? "Queued save could not be verified — retained locally" : err instanceof Error ? err.message : "Queued save failed" } });
            console.warn("Failed to sync queued save, will retry:", err);
            break;
          }
        }
      }
      if (!syncFailed && isOnline()) {
        const remaining = await projectStorage.getQueuedSaves();
        useEditor.getState().setQueuedSaveCount(remaining.length);
        if (!remaining.length && !editorNeedsRecovery) set({ saveError: null });
        else if (editorNeedsRecovery) set({ saveError: { kind: "verification", message: "Offline edits synced; newer local edits were preserved in Projects. Open the recovery draft to continue." } });
        else set({ saveError: { kind: "network", message: "Additional local edits remain queued for sync" } });
      }

      // Refresh userProjects after at least one verified queued write.
      const { currentProjectId } = useEditor.getState();
      if (didSync && currentProjectId && !isExampleSessionId(currentProjectId) && !isAnonymousDraftId(currentProjectId)) {
        try {
          const refreshed = await getProjects();
          set({ userProjects: refreshed });
          projectStorage.cacheProjectMeta(refreshed as unknown as Record<string, unknown>[]).catch(() => {});
        } catch { /* refresh failed, keep current state */ }
      }
    } finally {
      queuedSyncInProgress = false;
      resolveQueuedSync?.();
      resolveQueuedSync = null;
      queuedSyncCompletion = null;
      if (queuedSyncRequested) {
        queuedSyncRequested = false;
        queueMicrotask(() => { void get().syncQueuedSaves(); });
      }
    }
  },

  setSaveError: (error) => set({ saveError: error }),

  downloadProject: async (id?: string) => {
    const editor = useEditor.getState();
    const isCurrentProject = !id || editor.currentProjectId === id;

    // The editor is also the only source of truth for anonymous drafts and
    // example sessions. Export it directly so signed-out students can download
    // their work and so the ZIP contains edits made since the last autosave.
    if (isCurrentProject || isExampleSessionId(id)) {
      const { project } = editor;
      const ide = get();
      const exportId = id || editor.currentProjectId || "untitled";
      const exampleKey = isExampleSessionId(id)
        ? id!.slice(EXAMPLE_SESSION_PREFIX.length)
        : "";
      const name = ide.userProjects.find((p) => p.id === exportId)?.name
        || project.name
        || exampleKey
        || "project";
      const files = Object.entries(project.files).map(([fname, content]) => ({ name: fname, content }));
      await downloadProjectZip({
        id: exportId,
        name,
        files,
        assets: project.assets,
        tilemaps: project.tilemaps,
        sounds: project.sounds || {},
        sheet: project.sheet,
        updatedAt: new Date().toISOString(),
        currentFile: editor.currentFile,
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
    const importedProject = await importZipFile(file, undefined, (msg) => {
      console.warn('ZIP import warning:', msg);
    });

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
