import { useCallback } from "react";
import { useIde, useEditor } from "../state/IdeState";

export function useProjects() {
  const projects = useIde((s) => s.projects);
  const userProjects = useIde((s) => s.userProjects);
  const loading = useIde((s) => s.loading);
  const loadUserProjects = useIde((s) => s.loadUserProjects);
  const createNewProject = useIde((s) => s.createNewProject);
  const deleteUserProject = useIde((s) => s.deleteUserProject);
  const forkExample = useIde((s) => s.forkExample);
  const downloadProject = useIde((s) => s.downloadProject);
  const importProjectFromFile = useIde((s) => s.importProjectFromFile);
  const changeEditorCurrentProject = useEditor((s) => s.changeCurrentProject);
  const currentProjectId = useEditor((s) => s.currentProjectId);

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
    const forkedProject = await forkExample(exampleName, exampleProject);
    changeEditorCurrentProject(forkedProject, forkedProject.id);
  }, [projects, forkExample, changeEditorCurrentProject]);

  const handleNewProject = useCallback(async (name: string) => {
    const newProject = await createNewProject(name);
    changeEditorCurrentProject(newProject, newProject.id);
  }, [createNewProject, changeEditorCurrentProject]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await deleteUserProject(projectId);
    const firstUserProject = userProjects[0];
    if (firstUserProject) {
      changeEditorCurrentProject(firstUserProject, firstUserProject.id);
    } else {
      const firstExample = Object.keys(projects)[0];
      if (firstExample) {
        changeEditorCurrentProject(projects[firstExample]);
      }
    }
  }, [deleteUserProject, userProjects, projects, changeEditorCurrentProject]);

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
  };
}
