import { create } from "zustand";

import HelloWorld from "../assets/examples/hello_world/hello_world.py?raw";
import Input from "../assets/examples/input/input.py?raw";
import P5 from "../assets/examples/p5/p5.py?raw";
import Snake from "../assets/examples/snake/snake.py?raw";
import Sokoban from "../assets/examples/sokoban/sokoban.py?raw";
import Asteroids from "../assets/examples/asteroids/files/main.py?raw";
import Catch from "../assets/examples/catch/catch.py?raw";
import Robot from "../assets/examples/robot/robot.py?raw";
import Swatches from "../assets/examples/swatches/swatches.py?raw";
import Dungeon from "../assets/examples/dungeon/dungeon.py?raw";
import ThemesDemo from "../assets/examples/themes/themes.py?raw";
import ShipSvg from "../assets/examples/asteroids/assets/ship.svg?url";
import BulletSvg from "../assets/examples/asteroids/assets/bullet.svg?url";
import BigAsteroidSvg from "../assets/examples/asteroids/assets/big_asteroid.svg?url";
import SmallAsteroidSvg from "../assets/examples/asteroids/assets/small_asteroid.svg?url";
import { PACK_ASSET_LIST } from "./assets";
import { projectStorage } from "../utils/storage";
import { importProjectFromFile as importZipFile } from "../utils/zip";
import { getProjects, createProject as apiCreateProject, updateProject as apiUpdateProject, deleteProject as apiDeleteProject, saveProjectContent, Project as ApiProject } from "./api";
import { toEditorProject } from "./projectNormalization";

export type PanelId = "projects" | "assets" | "tilemaps" | "animations" | "settings" | "docs" | null;

export type TilemapLayer = {
  name: string;
  tileSize: number;
  cells: Record<number, Record<number, string>>;
};

export type TilemapData = {
  layers: TilemapLayer[];
};

export type AnimationData = {
  frames: string[];
  fps: number;
};

export type Project = {
  name?: string;
  files: Record<string, string>;
  currentFile?: string;
  assets: Record<string, string>;
  tilemaps: Record<string, TilemapData>;
  animations: Record<string, AnimationData>;
  theme?: string;
};

// Re-export adapter for convenience
export { toEditorProject };

function pickAssets(...names: string[]): Record<string, string> {
  const byName = Object.fromEntries(
    PACK_ASSET_LIST.map((a) => [a.name, a.url]),
  );
  return Object.fromEntries(
    names.flatMap((n) => (byName[n] ? [[n, byName[n]]] : [])),
  );
}

const Examples: Record<string, Project> = {
  "hello world": { files: { "main.py": HelloWorld }, assets: {}, tilemaps: {}, animations: {} },
  input: { files: { "input.py": Input }, assets: {}, tilemaps: {}, animations: {} },
  p5: { files: { "p5.py": P5 }, assets: {}, tilemaps: {}, animations: {} },
  snake: {
    files: { "snake.py": Snake },
    assets: {},
    tilemaps: {},
    animations: {},
  },
  sokoban: {
    files: { "sokoban.py": Sokoban },
    assets: pickAssets(
      "grassCenter",
      "castleCenter",
      "boxEmpty",
      "boxCoinAlt",
      "star",
      "p1_front",
    ),
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
    theme: "dungeon",
  },
  themes: {
    files: { "themes.py": ThemesDemo },
    assets: {},
    tilemaps: {},
    animations: {},
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
  setProjectTheme: (theme: string) => void;
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
          return { project, dirtyFiles: dirty, currentProjectId: `__example_session_${exampleName}` };
        }
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
      return { project: { ...s.project, assets }, dirtyFiles: dirty };
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

      return { ...s, project: { ...s.project, assets }, dirtyFiles: dirty };
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
      return { ...s, project: { ...s.project, assets }, dirtyFiles: dirty };
    }),

  removeAsset: (instanceName) =>
    set((s) => {
      const assets = { ...(s.project.assets ?? {}) };
      delete assets[instanceName];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*assets*");
      return { ...s, project: { ...s.project, assets }, dirtyFiles: dirty };
    }),

  saveTilemap: (name, data) =>
    set((s) => {
      const tilemaps = { ...(s.project.tilemaps ?? {}), [name]: data };
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*tilemaps*");
      return { project: { ...s.project, tilemaps }, dirtyFiles: dirty };
    }),

  deleteTilemap: (name) =>
    set((s) => {
      const tilemaps = { ...(s.project.tilemaps ?? {}) };
      delete tilemaps[name];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*tilemaps*");
      return { project: { ...s.project, tilemaps }, dirtyFiles: dirty };
    }),

  saveAnimation: (name, data) =>
    set((s) => {
      const animations = { ...(s.project.animations ?? {}), [name]: data };
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*animations*");
      return { project: { ...s.project, animations }, dirtyFiles: dirty };
    }),

  deleteAnimation: (name) =>
    set((s) => {
      const animations = { ...(s.project.animations ?? {}) };
      delete animations[name];
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*animations*");
      return { project: { ...s.project, animations }, dirtyFiles: dirty };
    }),

  setProjectTheme: (theme: string) =>
    set((s) => {
      const dirty = new Set(s.dirtyFiles);
      dirty.add("*theme*");
      return { project: { ...s.project, theme }, dirtyFiles: dirty };
    }),

  markClean: () => set({ dirtyFiles: new Set() }),
}));

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
  saveError: string | null;

  setActivePanel: (panel: PanelId) => void;
  togglePanel: (panel: Exclude<PanelId, null>) => void;
  closePanels: () => void;
  loadUserProjects: () => Promise<void>;
  createNewProject: (name: string) => Promise<ApiProject>;
  deleteUserProject: (id: string) => Promise<void>;
  renameUserProject: (id: string, newName: string) => Promise<void>;
  forkExample: (exampleName: string, exampleProject: Project, newName?: string) => Promise<ApiProject>;
  saveCurrentProject: () => Promise<boolean>;
  downloadProject: (id: string) => Promise<void>;
  importProjectFromFile: (file: File) => Promise<ApiProject>;
  setSaveError: (error: string | null) => void;
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
      set({ userProjects, loading: false });
      // Cache in IndexedDB for offline fallback
      projectStorage.cacheProjects(userProjects as unknown as Record<string, unknown>[]).catch(() => {});
    } catch (error) {
      console.error("Failed to load user projects, trying cache:", error);
      // Fall back to IndexedDB cache
      try {
        const cached = await projectStorage.getUserProjects();
        set({ userProjects: cached as unknown as ApiProject[], loading: false });
      } catch {
        set({ loading: false });
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
      currentFile: exampleProject.currentFile,
      theme: exampleProject.theme,
    });

    const { userProjects } = get();
    set({ userProjects: [forkedProject, ...userProjects] });
    return forkedProject;
  },

  saveCurrentProject: async () => {
    const { currentProjectId, project } = useEditor.getState();
    if (!currentProjectId) return false;

    try {
      await saveProjectContent(currentProjectId, {
        files: project.files,
        assets: project.assets,
        tilemaps: project.tilemaps,
        animations: project.animations,
        currentFile: useEditor.getState().currentFile,
        theme: project.theme,
      });

      // Update the local cache
      const { userProjects } = get();
      set({
        userProjects: userProjects.map((p) =>
          p.id === currentProjectId
            ? { ...p, files: project.files, assets: project.assets, updated_at: Date.now() }
            : p
        ),
        saveError: null,
      });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save project";
      set({ saveError: errorMessage });
      return false;
    }
  },

  setSaveError: (error) => set({ saveError: error }),

  downloadProject: async (id: string) => {
    await projectStorage.downloadProjectZip(id);
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
      animations: {},
      currentFile: importedProject.currentFile,
    });

    const { userProjects } = get();
    set({ userProjects: [created, ...userProjects] });
    return created;
  },
}));
