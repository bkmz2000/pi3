import { useEffect, useState } from 'react';
import { useProjects } from '../../state/useProjects';
import { useUser } from '../../state/useUser';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import { useNavigate } from 'react-router-dom';

export function ProjectsPage() {
  const { projects, loading, error, fetchProjects } = useProjects();
  const { authState } = useUser();
  const [showNewProject, setShowNewProject] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authState === 'logged_in') {
      fetchProjects();
    }
  }, [authState, fetchProjects]);

  const handleSelectProject = (id: string) => {
    navigate(`/ide/${id}`);
  };

  if (authState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
      </div>
    );
  }

  if (authState !== 'logged_in') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold">Sign in to view your projects</h2>
        <p className="mt-2 text-gray-500">You need to sign in to see your projects.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <button
          onClick={() => setShowNewProject(true)}
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          New Project
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-600">{error}</div>
      )}

      {loading && projects.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
          <h2 className="text-xl font-medium text-gray-500">No projects yet</h2>
          <p className="mt-2 text-sm text-gray-400">Create your first project to get started!</p>
          <button
            onClick={() => setShowNewProject(true)}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={handleSelectProject}
            />
          ))}
        </div>
      )}

      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />
    </div>
  );
}
