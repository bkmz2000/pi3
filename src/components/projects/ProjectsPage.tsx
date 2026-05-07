import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from '../../state/useProjects';
import { useUser } from '../../state/useUser';
import { ProjectCard } from './ProjectCard';
import { NewProjectDialog } from './NewProjectDialog';
import { useNavigate } from 'react-router-dom';

export function ProjectsPage() {
  const { t } = useTranslation();
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-700 border-t-cyan-400" />
      </div>
    );
  }

  if (authState !== 'logged_in') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <h2 className="text-xl font-bold text-cyan-900">{t('auth.signInToViewProjects')}</h2>
        <p className="mt-2 text-gray-500">{t('auth.needSignInToSeeProjects')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cyan-900">{t('auth.myProjects')}</h1>
        <button
          onClick={() => setShowNewProject(true)}
          className="rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-400"
        >
          {t('sideMenu.newProject')}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded bg-red-100 p-3 text-sm text-red-600">{error}</div>
      )}

      {loading && projects.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-cyan-700 border-t-cyan-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-cyan-300 p-12 text-center">
          <h2 className="text-xl font-medium text-cyan-700">{t('sideMenu.noProjects')}</h2>
          <button
            onClick={() => setShowNewProject(true)}
            className="mt-4 rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-400"
          >
            {t('sideMenu.createProject')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={handleSelectProject}
              showManagement
            />
          ))}
        </div>
      )}

      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />
    </div>
  );
}
