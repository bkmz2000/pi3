import { useCallback } from "react";
import { useIde, useEditor, toEditorProject } from "../state/IdeState";
import { getProject } from "../state/api";

/**
 * One facade over the canonical Zustand project collection.
 *
 * The old hook kept a second, component-local API list for /projects. Every
 * ProjectRow therefore received its own private collection, so deleting a row
 * could leave the parent list stale. All project surfaces now read and mutate
 * useIde.userProjects instead.
 */
export function useProjects() {
  const projects = useIde((s) => s.projects);
  const userProjects = useIde((s) => s.userProjects);
  const loading = useIde((s) => s.loading);
  const projectError = useIde((s) => s.projectError);
  const loadUserProjects = useIde((s) => s.loadUserProjects);
  const createNewProject = useIde((s) => s.createNewProject);
  const deleteUserProject = useIde((s) => s.deleteUserProject);
  const renameUserProject = useIde((s) => s.renameUserProject);
  const forkExample = useIde((s) => s.forkExample);
  const downloadProject = useIde((s) => s.downloadProject);
  const importProjectFromFile = useIde((s) => s.importProjectFromFile);
  const changeEditorCurrentProject = useEditor((s) => s.changeCurrentProject);

  const addProject = useCallback((name: string, description?: string) => (
    createNewProject(name, description)
  ), [createNewProject]);

  const loadProject = useCallback(async (id: string) => {
    const project = await getProject(id);
    changeEditorCurrentProject(toEditorProject(project), id);
    return project;
  }, [changeEditorCurrentProject]);

  const handleOpenExample = useCallback((name: string) => {
    const exampleProject = projects[name];
    if (exampleProject) changeEditorCurrentProject(exampleProject);
  }, [projects, changeEditorCurrentProject]);

  const handleForkExample = useCallback(async (exampleName: string) => {
    const exampleProject = projects[exampleName];
    const forkedApiProject = await forkExample(exampleName, exampleProject);
    changeEditorCurrentProject(toEditorProject(forkedApiProject), forkedApiProject.id);
  }, [projects, forkExample, changeEditorCurrentProject]);

  const handleNewProject = useCallback(() => {
    changeEditorCurrentProject({
      name: "Untitled",
      files: { "main.py": '# New project\nprint("Hello World!")' },
      currentFile: "main.py",
      assets: {},
      tilemaps: {},
      sounds: {},
    });
  }, [changeEditorCurrentProject]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await deleteUserProject(projectId);

    // Read post-delete state. The previous implementation captured the old
    // array and could immediately request the project it had just deleted.
    const firstUserProject = useIde.getState().userProjects[0];
    if (firstUserProject) {
      const full = await getProject(firstUserProject.id);
      changeEditorCurrentProject(toEditorProject(full), full.id);
      return;
    }

    const firstExample = Object.keys(projects)[0];
    if (firstExample) changeEditorCurrentProject(projects[firstExample]);
  }, [deleteUserProject, projects, changeEditorCurrentProject]);

  return {
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
    renameProject: renameUserProject,

    // Backward-compatible names for the project-library surface.
    apiProjects: userProjects,
    apiLoading: loading,
    apiError: projectError,
    fetchProjects: loadUserProjects,
    addProject,
    removeProject: deleteUserProject,
    loadProject,
  };
}
