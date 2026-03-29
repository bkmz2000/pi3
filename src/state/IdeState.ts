import { create } from "zustand";
import i18n from "../i18n";

import HelloWorld from "../assets/examples/hello_world/hello_world.py?raw";
import Input from "../assets/examples/input/input.py?raw";
import P5 from "../assets/examples/p5/p5.py?raw";
import Snake from "../assets/examples/snake/snake.py?raw";
import SnakeCfg from "../assets/examples/snake/snake_cfg.py?raw";
import AppleCfg from "../assets/examples/snake/apple_cfg.py?raw";
import Sokoban from "../assets/examples/sokoban/sokoban.py?raw";
import Bounce from "../assets/examples/bounce/bounce.py?raw";
import Asteroids from "../assets/examples/asteroids/asteroids (1)/files/main.py?raw";
import { PACK_ASSET_LIST } from "./assets";
import { projectStorage, StoredProject } from "../utils/storage";
import { importProjectFromFile } from "../utils/zip";

export type PanelId = "projects" | "assets" | "settings" | null;

export type Project = {
  files: Record<string, string>;
  currentFile?: string;
  assets: Record<string, string>;
};

export type UserProject = StoredProject;

function pickAssets(...names: string[]): Record<string, string> {
  const byName = Object.fromEntries(
    PACK_ASSET_LIST.map((a) => [a.name, a.url]),
  );
  return Object.fromEntries(
    names.flatMap((n) => (byName[n] ? [[n, byName[n]]] : [])),
  );
}

const Examples: Record<string, Project> = {
  "hello world": { files: { "main.py": HelloWorld }, assets: {} },
  input: { files: { "input.py": Input }, assets: {} },
  p5: { files: { "p5.py": P5 }, assets: {} },
  snake: { files: { "snake.py": Snake, "snake_cfg.py": SnakeCfg, "apple_cfg.py": AppleCfg }, assets: {} },
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
  },
  "bounce (new API)": { files: { "bounce.py": Bounce }, assets: {} },
  asteroids: {
    files: { "main.py": Asteroids },
    assets: pickAssets("asteroid", "bullet", "spaceship"),
  },
};
type EditorState = {
  currentFile: string;
  project: Project;
  currentProjectId: string | null;
  dirtyFiles: Set<string>;
  lastSaveTime: number;

  changeCurrentFile: (name: string) => void;
  changeCurrentProject: (project: Project, projectId?: string) => void;
  changeFile: (name: string, text: string) => void;
  saveFile: (name: string) => void;
  deleteFile: (name: string) => void;
  changeAsset: (name: string, url: string) => void;
  toggleAsset: (name: string, url: string) => void;
  renameFile: (oldName: string, newName: string) => void;
  markClean: () => void;
  updateLastSaveTime: () => void;
};

export const useEditor = create<EditorState>((set) => ({
  project: Examples["hello world"],
  currentFile: "main.py",
  currentProjectId: null,

  dirtyFiles: new Set(),
  lastSaveTime: Date.now(),

  changeFile: (name, text) =>
    set((s) => {
      // Check if we're editing an example project (no currentProjectId)
      if (s.currentProjectId === null) {
        // Auto-fork the example
        const exampleName = Object.keys(Examples).find(
          (key) => Examples[key] === s.project,
        );

        if (exampleName) {
          // This will be handled by the component that calls changeFile
          // We'll just mark it as dirty for now
          const files = { ...s.project.files, [name]: text };
          const project = { ...s.project, files };

          const dirty = new Set(s.dirtyFiles);
          dirty.add(name);

          return { project, dirtyFiles: dirty };
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
      lastSaveTime: Date.now(),
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
      let assets = { ...(s.project.assets ?? {}) };
      assets = { ...assets, [name]: url };
      const project = { ...s.project };
      project.assets = assets;
      return { project };
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

  markClean: () => set({ dirtyFiles: new Set() }),
  updateLastSaveTime: () => set({ lastSaveTime: Date.now() }),
}));

type IdeState = {
  activePanel: PanelId;
  assets: Record<string, Blob>;
  projects: Record<string, Project>;
  userProjects: UserProject[];
  loading: boolean;
  showHitboxes: boolean;

  setActivePanel: (panel: PanelId) => void;
  togglePanel: (panel: Exclude<PanelId, null>) => void;
  closePanels: () => void;
  loadUserProjects: () => Promise<void>;
  createNewProject: (name: string) => Promise<UserProject>;
  deleteUserProject: (id: string) => Promise<void>;
  renameUserProject: (id: string, newName: string) => Promise<void>;
  forkExample: (
    exampleName: string,
    exampleProject: Project,
    newName?: string,
  ) => Promise<UserProject>;
  saveCurrentProject: () => Promise<void>;
  exportProject: (id: string) => Promise<void>;
  importProject: (zipData: ArrayBuffer, name?: string) => Promise<UserProject>;
  downloadProject: (id: string) => Promise<void>;
  importProjectFromFile: (file: File) => Promise<UserProject>;
  setShowHitboxes: (show: boolean) => void;
};

export const useIde = create<IdeState>((set, get) => ({
  activePanel: null,
  assets: {},
  projects: Examples,
  userProjects: [],
  loading: false,
  showHitboxes: false,

  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) =>
    set((s) => ({ activePanel: panel === s.activePanel ? null : panel })),
  closePanels: () => set({ activePanel: null }),
  setShowHitboxes: (show: boolean) => set({ showHitboxes: show }),

  loadUserProjects: async () => {
    set({ loading: true });
    try {
      const userProjects = await projectStorage.getUserProjects();
      set({ userProjects, loading: false });
    } catch (error) {
      console.error("Failed to load user projects:", error);
      set({ loading: false });
    }
  },

  createNewProject: async (name: string) => {
    const newProject = await projectStorage.createProject(name, {
      files: { "main.py": '# New project\nprint("Hello World!")' },
      assets: {},
    });

    const { userProjects } = get();
    set({ userProjects: [newProject, ...userProjects] });

    return newProject;
  },

  deleteUserProject: async (id: string) => {
    await projectStorage.deleteProject(id);
    const { userProjects } = get();
    set({ userProjects: userProjects.filter((p) => p.id !== id) });
  },

  renameUserProject: async (id: string, newName: string) => {
    const updatedProject = await projectStorage.updateProject(id, {
      name: newName,
    });
    const { userProjects } = get();
    set({
      userProjects: userProjects.map((p) => (p.id === id ? updatedProject : p)),
    });
  },

  forkExample: async (
    exampleName: string,
    exampleProject: Project,
    newName?: string,
  ) => {
    const forkedProject = await projectStorage.forkExample(
      exampleName,
      exampleProject,
      newName,
    );
    const { userProjects } = get();
    set({ userProjects: [forkedProject, ...userProjects] });
    return forkedProject;
  },

  forkCurrentExample: async (newName?: string) => {
    const { currentProjectId, project } = useEditor.getState();

    // Only fork if we're currently on an example (no currentProjectId)
    if (currentProjectId !== null) {
      throw new Error(i18n.t('errors.cannotFork'));
    }

    const exampleName = Object.keys(Examples).find(
      (key) => Examples[key] === project,
    );

    if (!exampleName) {
      throw new Error(i18n.t('errors.notExample'));
    }

    return await get().forkExample(exampleName, project, newName);
  },

  saveCurrentProject: async () => {
    const { currentProjectId, project } = useEditor.getState();
    if (!currentProjectId) return;

    const { userProjects } = get();
    const existingProject = userProjects.find((p) => p.id === currentProjectId);
    if (!existingProject) return;

    await projectStorage.updateProject(currentProjectId, {
      files: project.files,
      assets: project.assets,
      currentFile: useEditor.getState().currentFile,
    });

    const updatedUserProjects = userProjects.map((p) =>
      p.id === currentProjectId
        ? {
            ...p,
            files: project.files,
            assets: project.assets,
            updatedAt: new Date().toISOString(),
          }
        : p,
    );
    set({ userProjects: updatedUserProjects });
  },

  exportProject: async (id: string) => {
    await projectStorage.downloadProjectZip(id);
  },

  downloadProject: async (id: string) => {
    await projectStorage.downloadProjectZip(id);
  },

  importProjectFromFile: async (file: File) => {
    const importedProject = await importProjectFromFile(file);

    // Convert to our storage format
    const files: Record<string, string> = {};
    importedProject.files.forEach((file) => {
      files[file.name] = file.content;
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

    const storedProject = await projectStorage.createProject(
      importedProject.name,
      {
        files,
        assets,
        currentFile: importedProject.currentFile,
      },
    );

    const { userProjects } = get();
    set({ userProjects: [storedProject, ...userProjects] });
    return storedProject;
  },

  importProject: async (zipData: ArrayBuffer, name?: string) => {
    const importedProject = await projectStorage.importProjectFromZip(
      zipData,
      name,
    );
    const { userProjects } = get();
    set({ userProjects: [importedProject, ...userProjects] });
    return importedProject;
  },
}));
