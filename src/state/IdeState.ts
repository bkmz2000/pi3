import { create } from "zustand";

import HelloWorld from "../assets/examples/hello_world/hello_world.py?raw";
import BouncingActor from "../assets/examples/bouncing_actor/main.py?raw";
import Input from "../assets/examples/input/input.py?raw";
import P5 from "../assets/examples/p5/p5.py?raw";
import Snake from "../assets/examples/snake/snake.py?raw";
import Sokoban from "../assets/examples/sokoban/sokoban.py?raw";
import Asteroids from "../assets/examples/asteroids/files/main.py?raw";
import Catch from "../assets/examples/catch/catch.py?raw";
import Robot from "../assets/examples/robot/robot.py?raw";
import Swatches from "../assets/examples/swatches/swatches.py?raw";
import Dungeon from "../assets/examples/dungeon/dungeon.py?raw";
import Platformer from "../assets/examples/platformer/platformer.py?raw";
import ColorShifter from "../assets/examples/color_shifter/color_shifter.py?raw";
import SpritePainter from "../assets/examples/sprite_painter/sprite_painter.py?raw";
import GradientSky from "../assets/examples/gradient_sky/gradient_sky.py?raw";
import RandomWalls from "../assets/examples/random_walls/random_walls.py?raw";
import CaveGenerator from "../assets/examples/cave_generator/cave_generator.py?raw";
import ShipSvg from "../assets/examples/asteroids/assets/ship.svg?url";
import BulletSvg from "../assets/examples/asteroids/assets/bullet.svg?url";
import BigAsteroidSvg from "../assets/examples/asteroids/assets/big_asteroid.svg?url";
import SmallAsteroidSvg from "../assets/examples/asteroids/assets/small_asteroid.svg?url";
import { projectStorage, isOnline } from "../utils/storage";
import { importProjectFromFile as importZipFile } from "../utils/zip";
import { getProjects, createProject as apiCreateProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, saveProjectContent, Project as ApiProject } from "./api";
import { toEditorProject } from "./projectNormalization";
import { writeAnonStash } from "../utils/anonStash";

export type PanelId = "projects" | "assets" | "settings" | "docs" | null;

export type TilemapLayer = {
  name: string;
  tileSize: number;
  cells: Record<number, Record<number, string>>;
};

// Named cell-set zones brushed in the Tile Editor, used as collision/test
// regions in Python. Stored as a flat list of [col, row] cells. Areas span
// the whole tilemap and are not tied to a specific layer.
export type TilemapArea = {
  cells: Array<[number, number]>;
};

export type TilemapData = {
  layers: TilemapLayer[];
  // Area name → cell-set. Names are validated as /^[a-z][a-z0-9_]*$/ in the
  // editor so they map cleanly to Python attribute access (`level.areas.X`).
  areas?: Record<string, TilemapArea>;
};

export type AnimationData = {
  frames: string[];
  fps: number;
};

export type SheetAnimationStrip = {
  x: number;
  y: number;
  frameW: number;
  frameH: number;
  frameCount: number;
  fps?: number;
};

export type SheetSpriteEntry = {
  animations: Record<string, SheetAnimationStrip>;
};

export type SheetSprites = Record<string, SheetSpriteEntry>;

export type SheetData = {
  pixels: string;   // base64-encoded raw RGBA bytes (width × height × 4)
  width: number;
  height: number;
  sprites: SheetSprites;
};

// Sentinel id used while a built-in example is being edited but has not
// yet been forked into a real project. Persists across reloads via the
// anonymous stash (see utils/anonStash.ts).
export const EXAMPLE_SESSION_PREFIX = "__example_session_";

export function isExampleSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(EXAMPLE_SESSION_PREFIX);
}

export function exampleNameFromSessionId(id: string): string {
  return id.slice(EXAMPLE_SESSION_PREFIX.length);
}

function ensureSessionId(s: EditorState): { currentProjectId: string } | Record<string, never> {
  if (s.currentProjectId !== null) return {};
  const exampleName = Object.keys(Examples).find((key) => Examples[key] === s.project);
  return { currentProjectId: exampleName ? `${EXAMPLE_SESSION_PREFIX}${exampleName}` : `${EXAMPLE_SESSION_PREFIX}untitled` };
}

export type Project = {
  name?: string;
  files: Record<string, string>;
  currentFile?: string;
  assets: Record<string, string>;
  tilemaps: Record<string, TilemapData>;
  animations: Record<string, AnimationData>;
  sounds?: Record<string, string>;
  sheet?: SheetData;
};

// Re-export adapter for convenience
export { toEditorProject };


const Examples: Record<string, Project> = {
  "hello world": { files: { "main.py": HelloWorld }, assets: {}, tilemaps: {}, animations: {} },
  input: { files: { "input.py": Input }, assets: {}, tilemaps: {}, animations: {} },
  p5: { files: { "p5.py": P5 }, assets: {}, tilemaps: {}, animations: {} },
  "bouncing actor": { files: { "main.py": BouncingActor }, assets: {}, tilemaps: {}, animations: {} },
  snake: {
    files: { "snake.py": Snake },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  sokoban: {
    files: { "sokoban.py": Sokoban },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  asteroids: {
    files: { "main.py": Asteroids },
    assets: {
      "ship.svg": ShipSvg,
      "bullet.svg": BulletSvg,
      "big_asteroid.svg": BigAsteroidSvg,
      "small_asteroid.svg": SmallAsteroidSvg,
    },
    tilemaps: {},
    animations: {},
  },
  catch: {
    files: { "catch.py": Catch },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  robot: {
    files: { "robot.py": Robot },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  swatches: {
    files: { "swatches.py": Swatches },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  dungeon: {
    files: { "dungeon.py": Dungeon },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  platformer: {
    files: { "platformer.py": Platformer },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  // Pixel-art switch showcase — small, focused demos of the new APIs.
  "color shifter": {
    files: { "color_shifter.py": ColorShifter },
    assets: {}, tilemaps: {}, animations: {},
  },
  "gradient sky": {
    files: { "gradient_sky.py": GradientSky },
    assets: {}, tilemaps: {}, animations: {},
  },
  "random walls": {
    files: { "random_walls.py": RandomWalls },
    assets: {}, tilemaps: {}, animations: {},
  },
  "cave generator": {
    files: { "cave_generator.py": CaveGenerator },
    assets: {}, tilemaps: {}, animations: {},
  },
  // Advanced — uses set_pixel/flood_fill/palette_swap; no beginner recipe yet
  "sprite painter": {
    files: { "sprite_painter.py": SpritePainter },
    assets: {}, tilemaps: {}, animations: {},
  },
};

type EditorState = {
  currentFile: string;
  project: Project;
  currentProjectId: string | null;
  dirtyFiles: Set<string>;

  changeCurrentFile: (name: string) => void;
  changeCurrentProject: (project: Project, projectId?: string) => void;
  changeFile: (name: string, text: string) => void;
  saveFile: (name: string) => void;
  deleteFile: (name: string) => void;
  changeAsset: (name: string, url: string) => void;
  toggleAsset: (name: string, url: string) => void;
  addAssetInstance: (baseName: string, url: string) => void;
  removeAsset: (instanceName: string) => void;
  renameFile: (oldName: string, newName: string) => void;
  saveTilemap: (name: string, data: TilemapData) => void;
  deleteTilemap: (name: string) => void;
  saveAnimation: (name: string, data: AnimationData) => void;
  deleteAnimation: (name: string) => void;
  addSound: (name: string, url: string) => void;
  removeSound: (name: string) => void;
  setSheet: (data: SheetData) => void;
  markClean: () => void;
};

export const useEditor = create<EditorState>((set) => ({
  project: Examples["hello world"],
  currentFile: "main.py",
  currentProjectId: null,

  dirtyFiles: new Set(),

  changeFile: (name, text) =>
    set((s) => {
      // Clone example on first edit (copy-on-write)
      if (s.currentProjectId === null) {
        const exampleName = Object.keys(Examples).find(
          (key) => Examples[key] === s.project,
        );

        if (exampleName) {
          const files = { ...s.project.files, [name]: text };
          const project = { ...s.project, files };

          const dirty = new Set(s.dirtyFiles);
          dirty.add(name);

          // Mark as cloned session so re-opens show fresh example
          return { project, dirtyFiles: dirty, currentProjectId: `${EXAMPLE_SESSION_PREFIX}${exampleName}` };
        }

        // Non-example project (blank, ZIP import, etc.) — generate a session ID
        // so saves persist to anonymous stash.
        const sessionId = `${EXAMPLE_SESSION_PREFIX}untitled`;
        const files = { ...s.project.files, [name]: text };
        const project = { ...s.project, files };
        const dirty = new Set(s.dirtyFiles);
        dirty.add(name);
        return { project, dirtyFiles: dirty, currentProjectId: sessionId };
      }

      const files = { ...s.project.files, [name]: text };
      const project = { ...s.project, files };

      const dirty = new Set(s.dirtyFiles);
      dirty.add(name);

      return { project, dirtyFiles: dirty };
    }),

  saveFile: (name) =>
    set((s) => {
      const dirty = new Set(s.dirtyFiles);
      dirty.delete(name);
      return { dirtyFiles: dirty };
    }),

  changeCurrentFile: (name: string) => set({ currentFile: name }),

  changeCurrentProject: (project, projectId) =>
    set({
      project,
      currentFile: Object.keys(project.files)[0] ?? "",
      currentProjectId: projectId || null,
      dirtyFiles: new Set(),
    }),

  renameFile: (oldName, newName) =>
    set((s) => {
      const files = { ...s.project.files };

      const content = files[oldName];
      delete files[oldName];
      files[newName] = content;

      const project = { ...s.project, files };

      return {
        project,
        currentFile: s.currentFile === oldName ? newName : s.currentFile,
      };
    }),

  deleteFile: (name) =>
    set((s) => {
      const files = { ...s.project.files };
      delete files[name];
      const project = { ...s.project };
      project.files = files;
      return { project, currentFile: Object.keys(project.files)[0] ?? "" };
    }),

  changeAsset: (name, url) =>
    set((s) => {
      const assets = { ...(s.project.assets ?? {}) };
      assets[name] = url;
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*assets*");
      return { project: { ...s.project, assets }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  toggleAsset: (name, url) =>
    set((s) => {
      const assets = { ...(s.project.assets ?? {}) };
      if (assets[name]) {
        delete assets[name];
      } else {
        assets[name] = url;
      }

      const dirty = new Set(s.dirtyFiles);
      dirty.add("*assets*");

      return { ...s, project: { ...s.project, assets }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  addAssetInstance: (baseName, url) =>
    set((s) => {
      const assets = { ...(s.project.assets ?? {}) };
      let key = baseName;
      if (assets[key] !== undefined) {
        let n = 1;
        while (assets[`${baseName}_${n}`] !== undefined) n++;
        key = `${baseName}_${n}`;
      }
      assets[key] = url;
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*assets*");
      return { ...s, project: { ...s.project, assets }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  removeAsset: (instanceName) =>
    set((s) => {
      const assets = { ...(s.project.assets ?? {}) };
      delete assets[instanceName];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*assets*");
      return { ...s, project: { ...s.project, assets }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  saveTilemap: (name, data) =>
    set((s) => {
      const tilemaps = { ...(s.project.tilemaps ?? {}), [name]: data };
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*tilemaps*");
      return { project: { ...s.project, tilemaps }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  deleteTilemap: (name) =>
    set((s) => {
      const tilemaps = { ...(s.project.tilemaps ?? {}) };
      delete tilemaps[name];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*tilemaps*");
      return { project: { ...s.project, tilemaps }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  saveAnimation: (name, data) =>
    set((s) => {
      const animations = { ...(s.project.animations ?? {}), [name]: data };
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*animations*");
      return { project: { ...s.project, animations }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  deleteAnimation: (name) =>
    set((s) => {
      const animations = { ...(s.project.animations ?? {}) };
      delete animations[name];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*animations*");
      return { project: { ...s.project, animations }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  addSound: (name, url) =>
    set((s) => {
      const sounds = { ...(s.project.sounds ?? {}) };
      let key = name;
      if (sounds[key] !== undefined) {
        const base = name.replace(/\.[^.]+$/, "");
        const ext = name.slice(base.length);
        let n = 1;
        while (sounds[`${base}_${n}${ext}`] !== undefined) n++;
        key = `${base}_${n}${ext}`;
      }
      sounds[key] = url;
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*sounds*");
      return { project: { ...s.project, sounds }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  removeSound: (name) =>
    set((s) => {
      const sounds = { ...(s.project.sounds ?? {}) };
      delete sounds[name];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*sounds*");
      return { project: { ...s.project, sounds }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  setSheet: (data) =>
    set((s) => {
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*sheet*");
      return { project: { ...s.project, sheet: data }, dirtyFiles: dirty, ...ensureSessionId(s) };
    }),

  markClean: () => set({ dirtyFiles: new Set() }),
}));

export type SaveErrorKind = 'auth' | 'network';
export type SaveError = { kind: SaveErrorKind; message: string };

type IdeState = {
  activePanel: PanelId;
  projects: Record<string, Project>;
  userProjects: ApiProject[];
  loading: boolean;
  showHitboxes: boolean;
  showConsoleOnRun: boolean;
  enableLinting: boolean;
  enableAutocomplete: boolean;
  consoleOnRight: boolean;
  loadingProjectContent: boolean;
  saveError: SaveError | null;
  fromCache: boolean;

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
  showConsoleOnRun: localStorage.getItem("pi3_showConsoleOnRun") === "true",
  enableLinting: localStorage.getItem("pi3_enableLinting") === "true",
  enableAutocomplete: localStorage.getItem("pi3_enableAutocomplete") !== "false",
  consoleOnRight: localStorage.getItem("pi3_consoleOnRight") === "true",
  loadingProjectContent: false,
  saveError: null,
  fromCache: false,

  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) =>
    set((s) => ({ activePanel: panel === s.activePanel ? null : panel })),
  closePanels: () => set({ activePanel: null }),
  setShowHitboxes: (show: boolean) => {
    localStorage.setItem("pi3_showHitboxes", String(show));
    set({ showHitboxes: show });
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
      animations: {},
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
      animations: exampleProject.animations,
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

    // Example-session: persist to the anonymous stash. No API call, no
    // auth dependency. The user gets a chance to fork-and-claim on sign-in.
    if (isExampleSessionId(currentProjectId)) {
      writeAnonStash({
        exampleName: exampleNameFromSessionId(currentProjectId),
        project,
      });
      set({ saveError: null });
      return true;
    }

    // Always cache full content locally (offline resilience)
    const content = {
      files: project.files,
      assets: project.assets,
      tilemaps: project.tilemaps,
      animations: project.animations,
      sounds: project.sounds ?? {},
      sheet: project.sheet,
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
            animations: project.animations,
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
      const kind: SaveErrorKind = errorMessage === "Unauthorized" ? "auth" : "network";
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
      set({ saveError: { kind, message: errorMessage } });
      // Return true for both network and auth — the local cache has the data.
      return true;
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
          animations: q.content.animations,
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
      animations: project.animations,
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
      animations: importedProject.animations || {},
      sounds: importedProject.sounds || {},
      sheet: importedProject.sheet,
    });

    const { userProjects } = get();
    set({ userProjects: [created, ...userProjects] });
    return created;
  },
}));
