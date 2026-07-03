import { create } from "zustand";

import { Examples } from "./exampleProjects";
import type { Project, TilemapData, SheetData } from "./projectTypes";
import { EXAMPLE_SESSION_PREFIX } from "./sessionId";

type EditorState = {
  currentFile: string;
  project: Project;
  currentProjectId: string | null;
  dirtyFiles: Set<string>;
  queuedSaveCount: number;

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
  addSound: (name: string, url: string) => void;
  removeSound: (name: string) => void;
  setSheet: (data: SheetData) => void;
  markClean: (keys?: Iterable<string>) => void;
  incrementQueuedSaves: () => void;
  decrementQueuedSaves: () => void;
};

function ensureSessionId(s: EditorState): { currentProjectId: string } | Record<string, never> {
  if (s.currentProjectId !== null) return {};
  const exampleName = Object.keys(Examples).find((key) => Examples[key] === s.project);
  return { currentProjectId: exampleName ? `${EXAMPLE_SESSION_PREFIX}${exampleName}` : `${EXAMPLE_SESSION_PREFIX}untitled` };
}

export const useEditor = create<EditorState>((set) => ({
  project: Examples["hello world"],
  currentFile: "main.py",
  currentProjectId: null,

  dirtyFiles: new Set(),
  queuedSaveCount: 0,

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

  // When `keys` is provided, only those entries are cleared. This prevents a
  // race where an edit landed while a save was in flight: snapshotting before
  // the save and clearing only what we actually persisted avoids wiping the
  // dirty flag for a still-unsaved change.
  markClean: (keys?: Iterable<string>) => set((s) => {
    if (!keys) return { dirtyFiles: new Set() };
    const next = new Set(s.dirtyFiles);
    for (const k of keys) next.delete(k);
    return { dirtyFiles: next };
  }),

  incrementQueuedSaves: () => set((s) => ({ queuedSaveCount: s.queuedSaveCount + 1 })),
  decrementQueuedSaves: () => set((s) => ({ queuedSaveCount: Math.max(0, s.queuedSaveCount - 1) })),
}));
