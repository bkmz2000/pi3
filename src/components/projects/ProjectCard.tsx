import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Project } from '../../state/api';
import { useProjects } from '../../hooks/useProjects';
import { useThemeStore } from '../../state/useTheme';
import { ShareDialog } from './ShareDialog';
import { Icon } from '../Icons';

interface ProjectCardProps {
  project: Project;
  onSelect: (id: string) => void;
  showManagement?: boolean;
}

export function ProjectCard({ project, onSelect, showManagement }: ProjectCardProps) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const { removeProject } = useProjects();
  const [showShare, setShowShare] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = project.role === 'owner';
  const roleLabel = project.role === 'owner' ? t('projects.roleOwner') : project.role === 'editor' ? t('projects.roleEditor') : t('projects.roleViewer');
  const roleAccent = project.role === 'owner' ? theme.accent : project.role === 'editor' ? theme.runBg : theme.panelTxtMute;

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
      <div style={{
        background: theme.surfacePanel,
        border: `1px solid ${theme.panelBorder}`,
        borderRadius: 6,
        padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontWeight: 600, fontSize: 14, color: theme.panelTxt,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {project.name}
            </div>
            {project.description && (
              <div style={{
                marginTop: 4, fontSize: 12.5, color: theme.panelTxtMute,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {project.description}
              </div>
            )}
          </div>
          <span style={{
            padding: "2px 8px", borderRadius: 999,
            fontSize: 11, fontWeight: 600, flex: "none", marginLeft: 8,
            background: `${roleAccent}18`,
            color: roleAccent,
          }}>
            {roleLabel}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
          <button
            onClick={() => onSelect(project.id)}
            style={{
              all: "unset", cursor: "pointer",
              padding: "6px 12px", borderRadius: 5,
              background: theme.runBg, color: theme.runTxt,
              fontFamily: theme.fontUI, fontSize: 12, fontWeight: 600,
            }}
          >
            {t('projects.open')}
          </button>

          {showManagement && isOwner && (
            <>
              <button
                onClick={() => setShowShare(true)}
                style={{
                  all: "unset", cursor: "pointer",
                  padding: "6px 12px", borderRadius: 5,
                  border: `1px solid ${theme.panelBorder}`,
                  color: theme.panelTxt,
                  fontFamily: theme.fontUI, fontSize: 12, fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}
              >
                <Icon name="export" size={12} color="currentColor" />
                {t('projects.share')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  all: "unset", cursor: deleting ? "default" : "pointer",
                  padding: "6px 12px", borderRadius: 5,
                  border: `1px solid ${theme.stopBg}44`,
                  color: theme.stopBg,
                  fontFamily: theme.fontUI, fontSize: 12, fontWeight: 500,
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                <Icon name="trash" size={12} color="currentColor" />
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
