import { useCallback, useState } from "react";
import { useIde, useEditor, toEditorProject } from "../state/IdeState";
import { getProjects, createProject, deleteProject as apiDeleteProject, getProject, Project as ApiProject } from "../state/api";

export function useProjects() {
  const projects = useIde((s) => s.projects);
  const userProjects = useIde((s) => s.userProjects);
  const loading = useIde((s) => s.loading);
  const loadUserProjects = useIde((s) => s.loadUserProjects);
  const deleteUserProject = useIde((s) => s.deleteUserProject);
  const forkExample = useIde((s) => s.forkExample);
  const downloadProject = useIde((s) => s.downloadProject);
  const importProjectFromFile = useIde((s) => s.importProjectFromFile);
  const changeEditorCurrentProject = useEditor((s) => s.changeCurrentProject);
  const currentProjectId = useEditor((s) => s.currentProjectId);

  // API projects state for /projects page
  const [apiProjects, setApiProjects] = useState<ApiProject[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const projects = await getProjects();
      setApiProjects(projects);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setApiLoading(false);
    }
  }, []);

  const addProject = useCallback(async (name: string, description?: string) => {
    setApiLoading(true);
    setApiError(null);
    try {
      const project = await createProject({ name, description });
      setApiProjects((prev) => [...prev, project]);
      setApiLoading(false);
      return project;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to create project');
      setApiLoading(false);
      throw err;
    }
  }, []);

  const removeProject = useCallback(async (id: string) => {
    setApiLoading(true);
    setApiError(null);
    try {
      await apiDeleteProject(id);
      setApiProjects((prev) => prev.filter((p) => p.id !== id));
      setApiLoading(false);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to delete project');
      setApiLoading(false);
      throw err;
    }
  }, []);

  const loadProject = useCallback(async (id: string) => {
    setApiLoading(true);
    setApiError(null);
    try {
      const project = await getProject(id);
      const editorProject = toEditorProject(project);
      changeEditorCurrentProject(editorProject, id);
      setApiLoading(false);
      return project;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to load project');
      setApiLoading(false);
      throw err;
    }
  }, [changeEditorCurrentProject]);

  const handleOpenExample = useCallback(async (name: string) => {
    const exampleProject = projects[name];
    if (currentProjectId) {
      changeEditorCurrentProject(exampleProject);
    } else {
      changeEditorCurrentProject(exampleProject, undefined);
    }
  }, [projects, currentProjectId, changeEditorCurrentProject]);

  const handleForkExample = useCallback(async (exampleName: string) => {
    const exampleProject = projects[exampleName];
    const forkedApiProject = await forkExample(exampleName, exampleProject);
    const forkedProject = toEditorProject(forkedApiProject);
    changeEditorCurrentProject(forkedProject, forkedApiProject.id);
  }, [projects, forkExample, changeEditorCurrentProject]);

  const handleNewProject = useCallback(() => {
    changeEditorCurrentProject({
      files: { "main.py": '# New project\nprint("Hello World!")' },
      assets: {},
      tilemaps: {},
    }, undefined);
  }, [changeEditorCurrentProject]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await deleteUserProject(projectId);
    const firstUserProject = userProjects[0];
    if (firstUserProject) {
      const full = await getProject(firstUserProject.id);
      const editorProject = toEditorProject(full);
      changeEditorCurrentProject(editorProject, full.id);
    } else {
      const firstExample = Object.keys(projects)[0];
      if (firstExample) {
        changeEditorCurrentProject(projects[firstExample]);
      }
    }
  }, [deleteUserProject, userProjects, projects, changeEditorCurrentProject]);

  return {
    // Side panel (examples + user projects)
    projects,
    userProjects,
    loading,
    loadUserProjects,
    handleOpenExample,
    handleForkExample,
    handleNewProject,
    handleDeleteProject,
    downloadProject,
    importProjectFromFile,

    // Projects page (API projects)
    apiProjects,
    apiLoading,
    apiError,
    fetchProjects,
    addProject,
    removeProject,
    loadProject,
  };
}
