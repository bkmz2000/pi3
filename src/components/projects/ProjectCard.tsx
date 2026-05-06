import { useState } from 'react';
import { Project } from '../../state/api';
import { useProjects } from '../../state/useProjects';
import { ShareDialog } from './ShareDialog';

interface ProjectCardProps {
  project: Project;
  onSelect: (id: string) => void;
}

export function ProjectCard({ project, onSelect }: ProjectCardProps) {
  const { removeProject } = useProjects();
  const [showShare, setShowShare] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = project.role === 'owner';
  const roleLabel = project.role === 'owner' ? 'Owner' : project.role === 'editor' ? 'Editor' : 'Viewer';
  const roleColor = project.role === 'owner' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    : project.role === 'editor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  const handleDelete = async () => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await removeProject(project.id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h3 className="font-medium">{project.name}</h3>
            {project.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
            )}
          </div>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${roleColor}`}>
            {roleLabel}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onSelect(project.id)}
            className="rounded bg-blue-500 px-3 py-1.5 text-sm text-white hover:bg-blue-600"
          >
            Open
          </button>

          {isOwner && (
            <>
              <button
                onClick={() => setShowShare(true)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Share
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {deleting ? 'Deleting...' : 'Delete'}
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
