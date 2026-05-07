import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../state/api';
import { useProjects } from '../../state/useProjects';
import { ShareDialog } from './ShareDialog';

interface ProjectCardProps {
  project: Project;
  onSelect: (id: string) => void;
  showManagement?: boolean;
}

export function ProjectCard({ project, onSelect, showManagement }: ProjectCardProps) {
  const { t } = useTranslation();
  const { removeProject } = useProjects();
  const [showShare, setShowShare] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = project.role === 'owner';
  const roleLabel = project.role === 'owner' ? t('projects.roleOwner') : project.role === 'editor' ? t('projects.roleEditor') : t('projects.roleViewer');
  const roleColor = project.role === 'owner' ? 'bg-purple-100 text-purple-700' : project.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';

  const handleDelete = async () => {
    if (!confirm(t('projects.confirmDelete', { name: project.name }))) return;

    setDeleting(true);
    try {
      await removeProject(project.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-cyan-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h3 className="font-medium text-cyan-900">{project.name}</h3>
            {project.description && (
              <p className="mt-1 text-sm text-gray-500">{project.description}</p>
            )}
          </div>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${roleColor}`}>
            {roleLabel}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSelect(project.id)}
            className="rounded bg-cyan-500 px-3 py-1.5 text-sm text-white hover:bg-cyan-400"
          >
            {t('projects.open')}
          </button>

          {showManagement && isOwner && (
            <>
              <button
                onClick={() => setShowShare(true)}
                className="rounded border border-cyan-300 px-3 py-1.5 text-sm text-cyan-700 hover:bg-cyan-50"
              >
                {t('projects.share')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                {deleting ? t('projects.deleting') : t('projects.delete')}
              </button>
            </>
          )}
        </div>
      </div>

      <ShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  );
}
