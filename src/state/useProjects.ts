import { create } from 'zustand';
import { Project, getProjects, createProject, deleteProject, getProject } from './api';
import { useEditor } from './IdeState';

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (name: string, description?: string) => Promise<Project>;
  removeProject: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
}

export const useProjects = create<ProjectsState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await getProjects();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load projects', loading: false });
    }
  },

  addProject: async (name: string, description?: string) => {
    set({ loading: true, error: null });
    try {
      const project = await createProject(name, description);
      set((state) => ({ projects: [...state.projects, project], loading: false }));
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create project', loading: false });
      throw err;
    }
  },

  removeProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await deleteProject(id);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete project', loading: false });
      throw err;
    }
  },

  loadProject: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const project = await getProject(id);
      const editor = useEditor.getState();
      editor.setProject({
        id: project.id,
        name: project.name,
        files: {},
      });
      set({ loading: false });
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load project', loading: false });
      throw err;
    }
  },
}));
