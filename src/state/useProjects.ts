import { create } from 'zustand';
import { Project as ApiProject, getProjects, createProject, deleteProject, getProject } from './api';
import { useEditor, Project } from './IdeState';

interface ProjectsState {
  projects: ApiProject[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (name: string, description?: string) => Promise<ApiProject>;
  removeProject: (id: string) => Promise<void>;
  loadProject: (id: string) => Promise<ApiProject>;
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
      const editorProject: Project = {
        name: project.name,
        files: {},
        assets: {},
      };
      editor.changeCurrentProject(editorProject, id);
      set({ loading: false });
      return project;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load project', loading: false });
      throw err;
    }
  },
}));
